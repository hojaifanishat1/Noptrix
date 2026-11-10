import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";

import { Tracking } from "./tracking.model";
import { TrackingEvent } from "./tracking-event.model";
import { Rider } from "../riders/rider.model";

import {
  CreateTrackingInput,
  UpdateTrackingInput,
  UpdateTrackingStatusInput,
  UpdateTrackingLocationInput,
  TrackingQueryInput,
} from "./tracking.validator";

import { TrackingStatus } from "./tracking.model";

/*
|--------------------------------------------------------------------------
| Status Transitions
|--------------------------------------------------------------------------
*/

const TRACKING_STATUS_TRANSITIONS: Record<
  TrackingStatus,
  readonly TrackingStatus[]
> = {
  PENDING: ["ASSIGNED", "CANCELLED"],

  ASSIGNED: ["PICKED_UP", "CANCELLED"],

  PICKED_UP: ["IN_TRANSIT", "CANCELLED"],

  IN_TRANSIT: ["OUT_FOR_DELIVERY", "FAILED", "CANCELLED"],

  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED", "CANCELLED"],

  DELIVERED: [],

  FAILED: ["OUT_FOR_DELIVERY", "CANCELLED"],

  CANCELLED: [],
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const validateObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${fieldName}.`);
  }

  return new Types.ObjectId(value);
};

const canTransition = (from: TrackingStatus, to: TrackingStatus): boolean =>
  TRACKING_STATUS_TRANSITIONS[from].includes(to);

/*
|--------------------------------------------------------------------------
| Create Tracking
|--------------------------------------------------------------------------
*/

export const createTracking = async (
  input: CreateTrackingInput,
  actorId?: string,
) => {
  const orderId = validateObjectId(input.orderId, "order ID");

  const existing = await Tracking.findOne({
    orderId,
  });

  if (existing) {
    throw ApiError.conflict("Tracking already exists for this order.");
  }

  const tracking = await Tracking.create({
    orderId,

    riderId: input.riderId
      ? validateObjectId(input.riderId, "rider ID")
      : undefined,

    status: input.status ?? "PENDING",

    currentLatitude: input.currentLatitude,

    currentLongitude: input.currentLongitude,

    currentAddress: input.currentAddress,

    estimatedDeliveryAt: input.estimatedDeliveryAt,

    notes: input.notes,

    createdBy: actorId ? validateObjectId(actorId, "actor ID") : undefined,
  });

  return getTrackingById(tracking._id.toString());
};

/*
|--------------------------------------------------------------------------
| Get Tracking
|--------------------------------------------------------------------------
*/

export const getTrackingById = async (trackingId: string) => {
  validateObjectId(trackingId, "tracking ID");

  const tracking = await Tracking.findById(trackingId)
    .populate("riderId", "name email phone riderCode status")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .lean();

  if (!tracking) {
    throw ApiError.notFound("Tracking record not found.");
  }

  return tracking;
};

/*
|--------------------------------------------------------------------------
| Get Tracking By Order
|--------------------------------------------------------------------------
*/

export const getTrackingByOrderId = async (orderId: string) => {
  validateObjectId(orderId, "order ID");

  const tracking = await Tracking.findOne({
    orderId,
  })
    .populate("riderId", "name email phone riderCode status")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .lean();

  if (!tracking) {
    throw ApiError.notFound("Tracking record not found for this order.");
  }

  return tracking;
};

/*
|--------------------------------------------------------------------------
| Get All Tracking
|--------------------------------------------------------------------------
*/

export const getAllTracking = async (query: TrackingQueryInput) => {
  const page = query.page ?? 1;

  const limit = query.limit ?? 20;

  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.riderId) {
    filter.riderId = validateObjectId(query.riderId, "rider ID");
  }

  if (query.orderId) {
    filter.orderId = validateObjectId(query.orderId, "order ID");
  }

  const [trackings, total] = await Promise.all([
    Tracking.find(filter)
      .populate("riderId", "name email phone riderCode status")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    Tracking.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    trackings,
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

/*
|--------------------------------------------------------------------------
| Update Tracking
|--------------------------------------------------------------------------
*/

export const updateTracking = async (
  trackingId: string,
  input: UpdateTrackingInput,
  actorId?: string,
) => {
  const id = validateObjectId(trackingId, "tracking ID");

  const tracking = await Tracking.findById(id);

  if (!tracking) {
    throw ApiError.notFound("Tracking record not found.");
  }

  if (tracking.status === "DELIVERED" || tracking.status === "CANCELLED") {
    throw ApiError.conflict("This tracking record can no longer be updated.");
  }

  if (input.riderId !== undefined) {
    tracking.riderId = validateObjectId(input.riderId, "rider ID");
  }

  if (input.currentLatitude !== undefined) {
    tracking.currentLatitude = input.currentLatitude;
  }

  if (input.currentLongitude !== undefined) {
    tracking.currentLongitude = input.currentLongitude;
  }

  if (input.currentAddress !== undefined) {
    tracking.currentAddress = input.currentAddress;
  }

  if (input.estimatedDeliveryAt !== undefined) {
    tracking.estimatedDeliveryAt = input.estimatedDeliveryAt;
  }

  if (input.notes !== undefined) {
    tracking.notes = input.notes;
  }

  if (
    input.currentLatitude !== undefined ||
    input.currentLongitude !== undefined
  ) {
    tracking.lastLocationAt = new Date();
  }

  if (actorId) {
    tracking.updatedBy = validateObjectId(actorId, "actor ID");
  }

  await tracking.save();

  return getTrackingById(trackingId);
};

/*
|--------------------------------------------------------------------------
| Update Status
|--------------------------------------------------------------------------
*/

export const updateTrackingStatus = async (
  trackingId: string,
  input: UpdateTrackingStatusInput,
  actorId?: string,
) => {
  const id = validateObjectId(trackingId, "tracking ID");

  const tracking = await Tracking.findById(id);

  if (!tracking) {
    throw ApiError.notFound("Tracking record not found.");
  }

  const currentStatus = tracking.status;

  if (currentStatus === input.status) {
    throw ApiError.badRequest("Tracking is already in this status.");
  }

  if (!canTransition(currentStatus, input.status)) {
    throw ApiError.conflict(
      `Cannot change tracking status from ${currentStatus} to ${input.status}.`,
    );
  }

  if (input.status === "FAILED" && !input.reason) {
    throw ApiError.badRequest("Failure reason is required.");
  }

  tracking.status = input.status;

  if (input.notes) {
    tracking.notes = input.notes;
  }

  if (input.status === "DELIVERED") {
    tracking.deliveredAt = new Date();
  }

  if (input.status === "FAILED") {
    tracking.failedAt = new Date();

    tracking.failureReason = input.reason;
  }

  if (input.status === "CANCELLED") {
    tracking.cancelledAt = new Date();

    tracking.cancellationReason = input.reason;
  }

  if (input.status === "OUT_FOR_DELIVERY") {
    tracking.lastLocationAt = new Date();
  }

  if (actorId) {
    tracking.updatedBy = validateObjectId(actorId, "actor ID");
  }

  await tracking.save();

  return getTrackingById(trackingId);
};

/*
|--------------------------------------------------------------------------
| Update Location
|--------------------------------------------------------------------------
*/

export const updateTrackingLocation = async (
  trackingId: string,
  input: UpdateTrackingLocationInput,
  actorId?: string,
) => {
  const id = validateObjectId(trackingId, "tracking ID");

  const tracking = await Tracking.findById(id);

  if (!tracking) {
    throw ApiError.notFound("Tracking record not found.");
  }

  if (tracking.status === "DELIVERED" || tracking.status === "CANCELLED") {
    throw ApiError.conflict(
      "Location cannot be updated after delivery or cancellation.",
    );
  }

  if (actorId) {
    const riderUserObjectId = validateObjectId(actorId, "rider user ID");

    const rider = await Rider.findOne({
      userId: riderUserObjectId,
      status: "ACTIVE",
    })
      .select("_id")
      .lean();

    if (!rider || String(tracking.riderId ?? "") !== String(rider._id)) {
      throw ApiError.forbidden("You are not assigned to this tracking record.");
    }
  }

  tracking.currentLatitude = input.latitude;

  tracking.currentLongitude = input.longitude;

  tracking.currentAddress = input.address;

  tracking.lastLocationAt = new Date();

  if (actorId) {
    tracking.updatedBy = validateObjectId(actorId, "actor ID");
  }

  await tracking.save();

  // Keep the assigned rider's independent GPS location in sync.
  if (tracking.riderId) {
    await Rider.updateOne(
      {
        _id: tracking.riderId,
        status: "ACTIVE",
      },
      {
        $set: {
          currentLatitude: input.latitude,
          currentLongitude: input.longitude,
          lastLocationAt: tracking.lastLocationAt,
        },
      },
    );
  }

  await TrackingEvent.create({
    trackingId: tracking._id,
    orderId: tracking.orderId,
    riderId: tracking.riderId,
    type: "LOCATION_UPDATED",
    status: tracking.status,
    latitude: input.latitude,
    longitude: input.longitude,
    address: input.address,
    message: input.message,
    ...(actorId
      ? {
          createdBy: validateObjectId(actorId, "actor ID"),
        }
      : {}),
  });

  return getTrackingById(trackingId);
};

/*
|--------------------------------------------------------------------------
| Assign Rider
|--------------------------------------------------------------------------
*/

export const assignRider = async (
  trackingId: string,
  riderId: string,
  actorId?: string,
) => {
  const id = validateObjectId(trackingId, "tracking ID");

  const rider = validateObjectId(riderId, "rider ID");

  const tracking = await Tracking.findById(id);

  if (!tracking) {
    throw ApiError.notFound("Tracking record not found.");
  }

  if (tracking.status === "DELIVERED" || tracking.status === "CANCELLED") {
    throw ApiError.conflict(
      "Rider cannot be assigned to this tracking record.",
    );
  }

  tracking.riderId = rider;

  if (tracking.status === "PENDING") {
    tracking.status = "ASSIGNED";
  }

  if (actorId) {
    tracking.updatedBy = validateObjectId(actorId, "actor ID");
  }

  await tracking.save();

  return getTrackingById(trackingId);
};
