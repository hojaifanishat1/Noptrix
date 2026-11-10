import { randomUUID } from "node:crypto";
import { Types } from "mongoose";

import { logger } from "../../utils/logger";
import { Shipping } from "./shipping.model";

import type { IShippingAddress, ShippingStatus } from "./shipping.types";

type CreateShippingInput = {
  orderId: string;
  customerId?: string;
  riderId?: string;
  provider?: string;
  providerShipmentId?: string;
  address: IShippingAddress;
  shippingFee: number;
  currency?: string;
  estimatedDeliveryAt?: Date;
  idempotencyKey?: string;
};

type StatusInput = {
  status: ShippingStatus;
  eventId: string;
  description: string;
  location?: string;
  occurredAt?: Date;
  failureReason?: string;
};

class ShippingServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ShippingServiceError";
  }
}

const transitions: Record<ShippingStatus, ShippingStatus[]> = {
  created: ["ready_to_ship", "cancelled"],
  ready_to_ship: ["picked_up", "cancelled"],
  picked_up: ["in_transit", "failed"],
  in_transit: ["out_for_delivery", "failed", "returned"],
  out_for_delivery: ["delivered", "failed", "returned"],
  delivered: [],
  failed: ["ready_to_ship", "returned", "cancelled"],
  returned: [],
  cancelled: [],
};

function ensureValidTransition(
  current: ShippingStatus,
  next: ShippingStatus,
): void {
  if (current === next) return;

  if (!transitions[current].includes(next)) {
    throw new ShippingServiceError(
      `Invalid shipping status transition: ${current} -> ${next}`,
      409,
    );
  }
}

function generateShipmentNumber(): string {
  return `SHP-${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function generateTrackingNumber(): string {
  return `NPX${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
}

export class ShippingService {
  static async create(input: CreateShippingInput, createdBy?: string) {
    if (input.idempotencyKey) {
      const existing = await Shipping.findOne({
        idempotencyKey: input.idempotencyKey,
      });

      if (existing) return existing;
    }

    const shipment = await Shipping.create({
      ...input,
      orderId: new Types.ObjectId(input.orderId),
      customerId: input.customerId
        ? new Types.ObjectId(input.customerId)
        : undefined,
      riderId: input.riderId ? new Types.ObjectId(input.riderId) : undefined,
      createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
      shipmentNumber: generateShipmentNumber(),
      trackingNumber: generateTrackingNumber(),
      provider: input.provider ?? "internal",
      currency: (input.currency ?? "SAR").toUpperCase(),
      status: "created",
      trackingEvents: [
        {
          eventId: `created:${randomUUID()}`,
          status: "created",
          description: "Shipment created",
          occurredAt: new Date(),
        },
      ],
    });

    logger.info(
      {
        shipmentId: shipment._id.toString(),
        orderId: input.orderId,
        trackingNumber: shipment.trackingNumber,
      },
      "Shipment created",
    );

    return shipment;
  }

  static async getById(id: string) {
    const shipment = await Shipping.findById(id);

    if (!shipment) {
      throw new ShippingServiceError("Shipment not found", 404);
    }

    return shipment;
  }

  static async track(trackingNumber: string) {
    const shipment = await Shipping.findOne({
      trackingNumber,
    }).select(
      "shipmentNumber trackingNumber provider status address.city estimatedDeliveryAt shippedAt deliveredAt trackingEvents createdAt updatedAt",
    );

    if (!shipment) {
      throw new ShippingServiceError("Tracking number not found", 404);
    }

    return shipment;
  }

  static async updateStatus(id: string, input: StatusInput) {
    const shipment = await Shipping.findById(id);

    if (!shipment) {
      throw new ShippingServiceError("Shipment not found", 404);
    }

    const duplicate = shipment.trackingEvents.some(
      (event) => event.eventId === input.eventId,
    );

    if (duplicate) return shipment;

    ensureValidTransition(shipment.status, input.status);

    const occurredAt = input.occurredAt ?? new Date();

    if (
      input.status !== "cancelled" &&
      input.status !== "failed" &&
      shipment.trackingEvents.length > 0
    ) {
      const latestEvent =
        shipment.trackingEvents[shipment.trackingEvents.length - 1];

      if (
        latestEvent &&
        occurredAt.getTime() < latestEvent.occurredAt.getTime()
      ) {
        throw new ShippingServiceError(
          "Event time cannot be earlier than the latest tracking event",
          409,
        );
      }
    }

    shipment.status = input.status;

    shipment.trackingEvents.push({
      eventId: input.eventId,
      status: input.status,
      description: input.description,
      location: input.location,
      occurredAt,
    });

    if (input.status === "picked_up" && !shipment.shippedAt) {
      shipment.shippedAt = occurredAt;
    }

    if (input.status === "delivered") {
      shipment.deliveredAt = occurredAt;
    }

    if (input.status === "cancelled") {
      shipment.cancelledAt = occurredAt;
    }

    if (input.status === "failed") {
      shipment.failureReason = input.failureReason ?? input.description;
    } else {
      shipment.failureReason = undefined;
    }

    try {
      await shipment.save();
    } catch (error) {
      // Optimistic concurrency can reject concurrent status updates.
      logger.warn(
        { shipmentId: id, error },
        "Concurrent shipment update rejected",
      );

      throw new ShippingServiceError(
        "Shipment was modified concurrently; reload and retry",
        409,
      );
    }

    logger.info(
      {
        shipmentId: id,
        status: input.status,
        eventId: input.eventId,
      },
      "Shipment status updated",
    );

    return shipment;
  }

  static async assignRider(id: string, riderId: string) {
    const shipment = await Shipping.findById(id);

    if (!shipment) {
      throw new ShippingServiceError("Shipment not found", 404);
    }

    if (["delivered", "cancelled", "returned"].includes(shipment.status)) {
      throw new ShippingServiceError(
        "Cannot assign a rider to a completed shipment",
        409,
      );
    }

    shipment.riderId = new Types.ObjectId(riderId);

    await shipment.save();

    return shipment;
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
    status?: ShippingStatus;
    search?: string;
    orderId?: string;
    customerId?: string;
    riderId?: string;
    provider?: string;
    sort: "newest" | "oldest";
  }) {
    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.orderId) filter.orderId = query.orderId;
    if (query.customerId) filter.customerId = query.customerId;
    if (query.riderId) filter.riderId = query.riderId;
    if (query.provider) filter.provider = query.provider;
    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { shipmentNumber: { $regex: escaped, $options: "i" } },
        { trackingNumber: { $regex: escaped, $options: "i" } },
        { provider: { $regex: escaped, $options: "i" } },
        ...(Types.ObjectId.isValid(query.search)
          ? [{ orderId: new Types.ObjectId(query.search) }]
          : []),
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const sort = query.sort === "oldest" ? 1 : -1;

    const [items, total] = await Promise.all([
      Shipping.find(filter)
        .sort({ createdAt: sort })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      Shipping.countDocuments(filter),
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
}

export { ShippingServiceError };
