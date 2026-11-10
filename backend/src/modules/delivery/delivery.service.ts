import { randomUUID } from "node:crypto";
import { Types } from "mongoose";

import { logger } from "../../utils/logger";
import { Delivery } from "./delivery.model";

import type { DeliveryStatus } from "./delivery.types";

export class DeliveryServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "DeliveryServiceError";
  }
}

const transitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ["assigned", "cancelled"],
  assigned: ["accepted", "cancelled"],
  accepted: ["picked_up", "cancelled"],
  picked_up: ["in_transit", "failed"],
  in_transit: ["arriving", "delivered", "failed", "returned"],
  arriving: ["delivered", "failed", "returned"],
  delivered: [],
  failed: ["assigned", "cancelled", "returned"],
  cancelled: [],
  returned: [],
};

function assertTransition(current: DeliveryStatus, next: DeliveryStatus): void {
  if (current === next) return;

  if (!transitions[current].includes(next)) {
    throw new DeliveryServiceError(
      `Invalid delivery transition: ${current} -> ${next}`,
      409,
    );
  }
}

export class DeliveryService {
  static async create(
    input: {
      orderId: string;
      shipmentId?: string;
      customerId?: string;
      recipientName: string;
      recipientPhone: string;
      address: string;
      city: string;
      deliveryFee: number;
      currency?: string;
      idempotencyKey?: string;
    },
    createdBy?: string,
  ) {
    if (input.idempotencyKey) {
      const existing = await Delivery.findOne({
        idempotencyKey: input.idempotencyKey,
      });

      if (existing) return existing;
    }

    const deliveryNumber = `DLV-${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    try {
      return await Delivery.create({
        ...input,
        orderId: new Types.ObjectId(input.orderId),
        shipmentId: input.shipmentId
          ? new Types.ObjectId(input.shipmentId)
          : undefined,
        customerId: input.customerId
          ? new Types.ObjectId(input.customerId)
          : undefined,
        createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
        deliveryNumber,
        currency: (input.currency ?? "SAR").toUpperCase(),
        status: "pending",
        attemptCount: 0,
        events: [
          {
            eventId: `created:${randomUUID()}`,
            status: "pending",
            description: "Delivery created",
            occurredAt: new Date(),
          },
        ],
      });
    } catch (error) {
      if (
        input.idempotencyKey &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        const existing = await Delivery.findOne({
          idempotencyKey: input.idempotencyKey,
        });

        if (existing) return existing;
      }

      throw error;
    }
  }

  static async getById(id: string) {
    const delivery = await Delivery.findById(id);

    if (!delivery) {
      throw new DeliveryServiceError("Delivery not found", 404);
    }

    return delivery;
  }

  static async assignRider(id: string, riderId: string) {
    const delivery = await Delivery.findById(id);

    if (!delivery) {
      throw new DeliveryServiceError("Delivery not found", 404);
    }

    if (!["pending", "failed"].includes(delivery.status)) {
      throw new DeliveryServiceError(
        "Rider can only be assigned to pending or failed deliveries",
        409,
      );
    }

    delivery.riderId = new Types.ObjectId(riderId);
    delivery.status = "assigned";
    delivery.assignedAt = new Date();
    delivery.failureReason = undefined;

    delivery.events.push({
      eventId: `assigned:${randomUUID()}`,
      status: "assigned",
      description: "Rider assigned",
      occurredAt: new Date(),
    });

    await delivery.save();

    logger.info(
      {
        deliveryId: id,
        riderId,
      },
      "Rider assigned to delivery",
    );

    return delivery;
  }

  static async updateStatus(
    id: string,
    input: {
      status: DeliveryStatus;
      eventId: string;
      description: string;
      location?: string;
      occurredAt?: Date;
      failureReason?: string;
      proofOfDeliveryUrl?: string;
      recipientSignatureUrl?: string;
    },
  ) {
    const delivery = await Delivery.findById(id);

    if (!delivery) {
      throw new DeliveryServiceError("Delivery not found", 404);
    }

    if (delivery.events.some((event) => event.eventId === input.eventId)) {
      return delivery;
    }

    assertTransition(delivery.status, input.status);

    if (
      input.status === "delivered" &&
      !["in_transit", "arriving"].includes(delivery.status)
    ) {
      throw new DeliveryServiceError(
        "Delivery must be in transit before completion",
        409,
      );
    }

    const now = input.occurredAt ?? new Date();

    delivery.status = input.status;

    delivery.events.push({
      eventId: input.eventId,
      status: input.status,
      description: input.description,
      location: input.location,
      occurredAt: now,
    });

    if (input.status === "accepted") {
      delivery.acceptedAt = now;
    }

    if (input.status === "picked_up") {
      delivery.pickedUpAt = now;
    }

    if (input.status === "delivered") {
      delivery.deliveredAt = now;
      delivery.proofOfDeliveryUrl = input.proofOfDeliveryUrl;
      delivery.recipientSignatureUrl = input.recipientSignatureUrl;
      delivery.failureReason = undefined;
    }

    if (input.status === "failed") {
      delivery.attemptCount += 1;
      delivery.failureReason = input.failureReason ?? input.description;
    }

    if (input.status === "cancelled") {
      delivery.cancelledAt = now;
    }

    try {
      await delivery.save();
    } catch (error) {
      logger.warn({ deliveryId: id, error }, "Delivery update failed");

      throw new DeliveryServiceError(
        "Delivery was changed concurrently; reload and retry",
        409,
      );
    }

    logger.info(
      {
        deliveryId: id,
        status: input.status,
        eventId: input.eventId,
      },
      "Delivery status updated",
    );

    return delivery;
  }

  static async cancel(id: string, reason: string) {
    return this.updateStatus(id, {
      status: "cancelled",
      eventId: `cancel:${randomUUID()}`,
      description: reason,
    });
  }

  static async list(query: {
    page: number;
    limit: number;
    status?: DeliveryStatus;
    search?: string;
    orderId?: string;
    riderId?: string;
    customerId?: string;
    sort: "newest" | "oldest";
  }) {
    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.orderId) filter.orderId = query.orderId;
    if (query.riderId) filter.riderId = query.riderId;
    if (query.customerId) filter.customerId = query.customerId;
    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { deliveryNumber: { $regex: escaped, $options: "i" } },
        { recipientName: { $regex: escaped, $options: "i" } },
        { recipientPhone: { $regex: escaped, $options: "i" } },
        { city: { $regex: escaped, $options: "i" } },
        ...(Types.ObjectId.isValid(query.search)
          ? [{ orderId: new Types.ObjectId(query.search) }]
          : []),
      ];
    }

    const [items, total] = await Promise.all([
      Delivery.find(filter)
        .sort({ createdAt: query.sort === "oldest" ? 1 : -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      Delivery.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  static async listForRider(riderId: string, page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      Delivery.find({
        riderId,
        status: {
          $in: ["assigned", "accepted", "picked_up", "in_transit", "arriving"],
        },
      })
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Delivery.countDocuments({
        riderId,
        status: {
          $in: ["assigned", "accepted", "picked_up", "in_transit", "arriving"],
        },
      }),
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
}
