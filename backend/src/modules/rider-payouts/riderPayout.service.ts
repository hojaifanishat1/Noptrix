import { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import { RiderEarning } from "../rider-earnings/riderEarning.model";
import { RiderPayoutModel, type RiderPayoutStatus } from "./riderPayout.model";

const objectId = (value: string, label: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${label}.`);
  }
  return new Types.ObjectId(value);
};

export interface RiderPayoutQuery {
  page?: number;
  limit?: number;
  status?: RiderPayoutStatus;
  riderId?: string;
  currency?: string;
}

export interface GenerateRiderPayoutInput {
  riderId?: string;
}

export interface UpdateRiderPayoutInput {
  status: Exclude<RiderPayoutStatus, "PENDING">;
  paymentReference?: string;
  notes?: string;
}

export const generateRiderPayouts = async (
  input: GenerateRiderPayoutInput = {},
): Promise<{ created: number; skipped: number }> => {
  const filter: Record<string, unknown> = {
    status: "APPROVED",
    payoutId: { $exists: false },
  };

  if (input.riderId) {
    filter.riderId = objectId(input.riderId, "rider ID");
  }

  const earnings = await RiderEarning.find(filter)
    .select("_id riderId amount currency")
    .lean();

  const groups = new Map<string, {
    riderId: Types.ObjectId;
    currency: string;
    amount: number;
    earningIds: Types.ObjectId[];
  }>();

  for (const earning of earnings) {
    const currency = String(earning.currency).trim().toUpperCase();
    const riderId = earning.riderId as Types.ObjectId;
    const key = `${riderId.toString()}:${currency}`;

    const group = groups.get(key) ?? {
      riderId,
      currency,
      amount: 0,
      earningIds: [],
    };

    group.amount += Number(earning.amount);
    group.earningIds.push(earning._id as Types.ObjectId);
    groups.set(key, group);
  }

  let created = 0;
  let skipped = 0;

  for (const group of groups.values()) {
    const payoutId = new Types.ObjectId();

    const claim = await RiderEarning.updateMany(
      {
        _id: { $in: group.earningIds },
        riderId: group.riderId,
        status: "APPROVED",
        payoutId: { $exists: false },
        currency: group.currency,
      },
      {
        $set: { payoutId },
      },
    );

    if (claim.modifiedCount !== group.earningIds.length) {
      await RiderEarning.updateMany(
        { payoutId },
        { $unset: { payoutId: 1 } },
      );
      skipped += group.earningIds.length;
      continue;
    }

    try {
      await RiderPayoutModel.create({
        _id: payoutId,
        riderId: group.riderId,
        earningIds: group.earningIds,
        currency: group.currency,
        amount: Number(group.amount.toFixed(2)),
        status: "PENDING",
      });
      created += 1;
    } catch (error) {
      await RiderEarning.updateMany(
        { payoutId },
        { $unset: { payoutId: 1 } },
      );
      throw error;
    }
  }

  return { created, skipped };
};

export const listRiderPayouts = async (
  query: RiderPayoutQuery = {},
) => {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  const filter: Record<string, unknown> = {};

  if (query.status) filter.status = query.status;
  if (query.riderId) filter.riderId = objectId(query.riderId, "rider ID");
  if (query.currency) filter.currency = query.currency.trim().toUpperCase();

  const [items, total, summary] = await Promise.all([
    RiderPayoutModel.find(filter)
      .populate("riderId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    RiderPayoutModel.countDocuments(filter),

    RiderPayoutModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    items,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

export const updateRiderPayoutStatus = async (
  payoutId: string,
  input: UpdateRiderPayoutInput,
  actorId: string,
) => {
  const id = objectId(payoutId, "payout ID");
  const actor = objectId(actorId, "actor ID");

  const payout = await RiderPayoutModel.findById(id);

  if (!payout) {
    throw ApiError.notFound("Rider payout not found.");
  }

  const transitions: Record<RiderPayoutStatus, RiderPayoutStatus[]> = {
    PENDING: ["APPROVED", "CANCELLED"],
    APPROVED: ["PAID", "CANCELLED"],
    PAID: [],
    CANCELLED: [],
  };

  if (!transitions[payout.status].includes(input.status)) {
    throw ApiError.badRequest(
      `Cannot change payout status from ${payout.status} to ${input.status}.`,
    );
  }

  if (input.status === "PAID") {
    if (!input.paymentReference?.trim()) {
      throw ApiError.badRequest(
        "Payment reference is required when marking a payout paid.",
      );
    }

    const paidAt = new Date();

    const result = await RiderEarning.updateMany(
      {
        _id: { $in: payout.earningIds },
        payoutId: payout._id,
        status: "APPROVED",
      },
      {
        $set: {
          status: "PAID",
          paidAt,
          paidBy: actor,
          updatedBy: actor,
        },
      },
    );

    if (result.modifiedCount !== payout.earningIds.length) {
      throw ApiError.badRequest(
        "Payout earnings could not all be marked as paid. Please review the earning records.",
      );
    }

    payout.paidAt = paidAt;
    payout.paidBy = actor;
    payout.paymentReference = input.paymentReference.trim();
  }

  if (input.status === "APPROVED") {
    payout.approvedAt = new Date();
    payout.approvedBy = actor;
  }

  if (input.status === "CANCELLED") {
    await RiderEarning.updateMany(
      {
        _id: { $in: payout.earningIds },
        payoutId: payout._id,
        status: "APPROVED",
      },
      {
        $unset: { payoutId: 1 },
      },
    );
  }

  if (input.notes !== undefined) {
    payout.notes = input.notes.trim();
  }

  payout.status = input.status;
  await payout.save();

  return payout.toObject();
};
