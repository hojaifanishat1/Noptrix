import { Types } from "mongoose";

import COD from "./cod.model";
import type { CODQuery } from "./cod.types";
import OrderModel from "../orders/order.model";
import { Rider } from "../riders/rider.model";

class CODServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "CODServiceError";
    this.statusCode = statusCode;
  }
}

function objectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new CODServiceError("Invalid ObjectId.", 400);
  }

  return new Types.ObjectId(value);
}

function getOrderTotal(order: unknown): {
  amount: number;
  currency: string;
} {
  if (!order || typeof order !== "object") {
    throw new CODServiceError("Order not found.", 404);
  }

  const record = order as Record<string, unknown>;
  const totals = record.totals;

  if (!totals || typeof totals !== "object") {
    throw new CODServiceError("Order totals are unavailable.", 422);
  }

  const totalRecord = totals as Record<string, unknown>;
  const amount = totalRecord.totalAmount;
  const currency = totalRecord.currency;

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new CODServiceError(
      "Order does not have a valid payable amount.",
      422,
    );
  }

  if (typeof currency !== "string" || !/^[A-Z]{3}$/i.test(currency)) {
    throw new CODServiceError("Order currency is invalid.", 422);
  }

  return {
    amount,
    currency: currency.toUpperCase(),
  };
}

export async function createCOD(
  input: { orderId: string; notes?: string },
  riderUserId: string,
) {
  const orderObjectId = objectId(input.orderId);
  const riderObjectId = objectId(riderUserId);

  const rider = await Rider.findOne({
    _id: riderObjectId,
    status: "ACTIVE",
  })
    .select("_id")
    .lean();

  if (!rider) {
    throw new CODServiceError("An active rider account is required.", 403);
  }

  const order = await OrderModel.findById(orderObjectId).lean();

  if (!order) {
    throw new CODServiceError("Order not found.", 404);
  }

  const { amount, currency } = getOrderTotal(order);

  const existing = await COD.findOne({
    orderId: orderObjectId,
  }).lean();

  if (existing) {
    throw new CODServiceError(
      "A COD record already exists for this order.",
      409,
    );
  }

  try {
    return await COD.create({
      orderId: orderObjectId,
      riderId: rider._id,
      amount,
      currency,
      status: "PENDING",
      notes: input.notes,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new CODServiceError(
        "A COD record already exists for this order.",
        409,
      );
    }

    throw error;
  }
}

export async function collectCOD(
  codId: string,
  riderUserId: string,
  input: { amount: number; notes?: string },
) {
  const riderObjectId = objectId(riderUserId);
  const codObjectId = objectId(codId);

  const rider = await Rider.findOne({
    _id: riderObjectId,
    status: "ACTIVE",
  })
    .select("_id")
    .lean();

  if (!rider) {
    throw new CODServiceError("An active rider account is required.", 403);
  }

  const cod = await COD.findOne({
    _id: codObjectId,
    riderId: rider._id,
  });

  if (!cod) {
    throw new CODServiceError("COD record not found or access denied.", 404);
  }

  if (cod.status !== "PENDING") {
    throw new CODServiceError(
      "Only pending COD records can be collected.",
      409,
    );
  }

  if (Math.round(input.amount * 100) !== Math.round(cod.amount * 100)) {
    throw new CODServiceError(
      "Collected amount must equal the COD amount.",
      422,
    );
  }

  // Atomic state transition prevents concurrent duplicate collection.
  const updated = await COD.findOneAndUpdate(
    {
      _id: cod._id,
      riderId: rider._id,
      status: "PENDING",
    },
    {
      $set: {
        status: "COLLECTED",
        collectedAt: new Date(),
        ...(input.notes ? { notes: input.notes } : {}),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updated) {
    throw new CODServiceError(
      "COD was already updated by another request.",
      409,
    );
  }

  return updated;
}

export async function remitCOD(codId: string, actorUserId: string) {
  const actorId = objectId(actorUserId);

  const updated = await COD.findOneAndUpdate(
    {
      _id: objectId(codId),
      status: "COLLECTED",
    },
    {
      $set: {
        status: "REMITTED",
        remittedAt: new Date(),
        updatedBy: actorId,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updated) {
    throw new CODServiceError(
      "Collected COD record not found or already processed.",
      409,
    );
  }

  return updated;
}

export async function reverseCOD(
  codId: string,
  actorUserId: string,
  notes: string,
) {
  const actorId = objectId(actorUserId);

  const updated = await COD.findOneAndUpdate(
    {
      _id: objectId(codId),
      status: { $in: ["PENDING", "COLLECTED"] },
    },
    {
      $set: {
        status: "REVERSED",
        reversedAt: new Date(),
        updatedBy: actorId,
        notes,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updated) {
    throw new CODServiceError(
      "COD record cannot be reversed in its current state.",
      409,
    );
  }

  return updated;
}

export async function getCODById(codId: string) {
  const cod = await COD.findById(objectId(codId))
    .populate("orderId")
    .populate("riderId")
    .lean();

  if (!cod) {
    throw new CODServiceError("COD record not found.", 404);
  }

  return cod;
}

export async function getCODByOrder(orderId: string) {
  const cod = await COD.findOne({
    orderId: objectId(orderId),
  }).lean();

  if (!cod) {
    throw new CODServiceError("COD record not found.", 404);
  }

  return cod;
}

export async function getMyCODRecords(riderUserId: string, query: CODQuery) {
  const rider = await Rider.findById(objectId(riderUserId))
    .select("_id")
    .lean();

  if (!rider) {
    throw new CODServiceError("Rider not found.", 404);
  }

  const filter: Record<string, unknown> = {
    riderId: rider._id,
  };

  if (query.status) filter.status = query.status;
  if (query.orderId) filter.orderId = objectId(query.orderId);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const [items, total] = await Promise.all([
    COD.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    COD.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getAllCODRecords(query: CODQuery) {
  const filter: Record<string, unknown> = {};

  if (query.status) filter.status = query.status;
  if (query.riderId) filter.riderId = objectId(query.riderId);
  if (query.orderId) filter.orderId = objectId(query.orderId);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const [items, total] = await Promise.all([
    COD.find(filter)
      .populate("orderId")
      .populate("riderId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    COD.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
