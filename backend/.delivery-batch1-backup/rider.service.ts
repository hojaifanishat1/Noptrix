import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";

import { Rider, IRider } from "./rider.model";

import {
  CreateRiderInput,
  UpdateRiderInput,
  UpdateRiderStatusInput,
  RiderQueryInput,
} from "./rider.validator";

import { RiderStatus } from "./rider.types";

/*
|--------------------------------------------------------------------------
| Status Transitions
|--------------------------------------------------------------------------
*/

export const RIDER_STATUS_TRANSITIONS: Record<
  RiderStatus,
  readonly RiderStatus[]
> = {
  PENDING: ["ACTIVE", "INACTIVE", "BLOCKED"],

  ACTIVE: ["INACTIVE", "SUSPENDED", "BLOCKED", "TERMINATED"],

  INACTIVE: ["ACTIVE", "SUSPENDED", "TERMINATED"],

  SUSPENDED: ["ACTIVE", "INACTIVE", "BLOCKED", "TERMINATED"],

  BLOCKED: ["ACTIVE", "TERMINATED"],

  TERMINATED: [],
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

const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

const normalizeRiderCode = (riderCode: string): string => {
  return riderCode.trim().toUpperCase();
};

export const canTransitionRiderStatus = (
  currentStatus: RiderStatus,
  nextStatus: RiderStatus,
): boolean => {
  return RIDER_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
};

/*
|--------------------------------------------------------------------------
| Create Rider
|--------------------------------------------------------------------------
*/

export const createRider = async (
  input: CreateRiderInput,
  actorId?: string,
): Promise<IRider> => {
  const userId = validateObjectId(input.userId, "userId");

  const riderCode = normalizeRiderCode(input.riderCode);

  const email = normalizeEmail(input.email);

  const existingUser = await Rider.findOne({
    userId,
  });

  if (existingUser) {
    throw ApiError.conflict("A rider already exists for this user.");
  }

  const existingCode = await Rider.findOne({
    riderCode,
  });

  if (existingCode) {
    throw ApiError.conflict("Rider code already exists.");
  }

  const existingEmail = await Rider.findOne({
    email,
  });

  if (existingEmail) {
    throw ApiError.conflict("A rider already exists with this email.");
  }

  const rider = await Rider.create({
    userId,

    riderCode,

    type: input.type,

    name: input.name,

    email,

    phone: input.phone,

    vehicleType: input.vehicleType,

    vehicleNumber: input.vehicleNumber,

    licenseNumber: input.licenseNumber,

    nationalId: input.nationalId,

    joinedAt: input.joinedAt,

    status: "PENDING",

    notes: input.notes,

    createdBy: actorId ? validateObjectId(actorId, "actorId") : undefined,
  });

  return rider;
};

/*
|--------------------------------------------------------------------------
| Get Rider By ID
|--------------------------------------------------------------------------
*/

export const getRiderById = async (riderId: string): Promise<IRider> => {
  const riderObjectId = validateObjectId(riderId, "riderId");

  const rider = await Rider.findById(riderObjectId)
    .populate("userId", "name email phone status")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .populate("suspendedBy", "name email")
    .populate("terminatedBy", "name email");

  if (!rider) {
    throw ApiError.notFound("Rider not found.");
  }

  return rider;
};

/*
|--------------------------------------------------------------------------
| Get Rider By User
|--------------------------------------------------------------------------
*/

export const getRiderByUserId = async (userId: string): Promise<IRider> => {
  const userObjectId = validateObjectId(userId, "userId");

  const rider = await Rider.findOne({
    userId: userObjectId,
  }).populate("userId", "name email phone status");

  if (!rider) {
    throw ApiError.notFound("Rider profile not found.");
  }

  return rider;
};

/*
|--------------------------------------------------------------------------
| Get All Riders
|--------------------------------------------------------------------------
*/

export const getAllRiders = async (query: RiderQueryInput) => {
  const page = query.page ?? 1;

  const limit = query.limit ?? 20;

  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.vehicleType) {
    filter.vehicleType = query.vehicleType;
  }

  if (query.userId) {
    filter.userId = validateObjectId(query.userId, "userId");
  }

  if (query.search) {
    const search = query.search.trim();

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
        {
          riderCode: {
            $regex: search,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: search,
            $options: "i",
          },
        },
        {
          vehicleNumber: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }
  }

  const [riders, total] = await Promise.all([
    Rider.find(filter)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email phone status"),

    Rider.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    riders,

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
| Update Rider
|--------------------------------------------------------------------------
*/

export const updateRider = async (
  riderId: string,
  input: UpdateRiderInput,
  actorId?: string,
): Promise<IRider> => {
  const riderObjectId = validateObjectId(riderId, "riderId");

  const rider = await Rider.findById(riderObjectId);

  if (!rider) {
    throw ApiError.notFound("Rider not found.");
  }

  if (rider.status === "TERMINATED") {
    throw ApiError.badRequest("Terminated riders cannot be updated.");
  }

  if (input.riderCode !== undefined) {
    const riderCode = normalizeRiderCode(input.riderCode);

    if (riderCode !== rider.riderCode) {
      const duplicate = await Rider.findOne({
        riderCode,
        _id: {
          $ne: riderObjectId,
        },
      });

      if (duplicate) {
        throw ApiError.conflict("Rider code already exists.");
      }

      rider.riderCode = riderCode;
    }
  }

  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);

    if (email !== rider.email) {
      const duplicate = await Rider.findOne({
        email,
        _id: {
          $ne: riderObjectId,
        },
      });

      if (duplicate) {
        throw ApiError.conflict("A rider already exists with this email.");
      }

      rider.email = email;
    }
  }

  if (input.type !== undefined) {
    rider.type = input.type;
  }

  if (input.name !== undefined) {
    rider.name = input.name;
  }

  if (input.phone !== undefined) {
    rider.phone = input.phone;
  }

  if (input.vehicleType !== undefined) {
    rider.vehicleType = input.vehicleType;
  }

  if (input.vehicleNumber !== undefined) {
    rider.vehicleNumber = input.vehicleNumber;
  }

  if (input.licenseNumber !== undefined) {
    rider.licenseNumber = input.licenseNumber;
  }

  if (input.nationalId !== undefined) {
    rider.nationalId = input.nationalId;
  }

  if (input.joinedAt !== undefined) {
    rider.joinedAt = input.joinedAt;
  }

  if (input.notes !== undefined) {
    rider.notes = input.notes;
  }

  if (actorId) {
    rider.updatedBy = validateObjectId(actorId, "actorId");
  }

  await rider.save();

  return rider;
};

/*
|--------------------------------------------------------------------------
| Update Rider Status
|--------------------------------------------------------------------------
*/

export const updateRiderStatus = async (
  riderId: string,
  actorId: string,
  input: UpdateRiderStatusInput,
): Promise<IRider> => {
  const riderObjectId = validateObjectId(riderId, "riderId");

  const actorObjectId = validateObjectId(actorId, "actorId");

  const rider = await Rider.findById(riderObjectId);

  if (!rider) {
    throw ApiError.notFound("Rider not found.");
  }

  if (rider.status === input.status) {
    throw ApiError.badRequest(`Rider is already ${input.status}.`);
  }

  if (!canTransitionRiderStatus(rider.status, input.status)) {
    throw ApiError.badRequest(
      `Cannot change rider status from ${rider.status} to ${input.status}.`,
    );
  }

  const now = new Date();

  rider.status = input.status;

  rider.updatedBy = actorObjectId;

  if (input.status === "SUSPENDED") {
    if (!input.reason?.trim()) {
      throw ApiError.badRequest("Suspension reason is required.");
    }

    rider.suspendedAt = now;

    rider.suspendedBy = actorObjectId;

    rider.suspensionReason = input.reason;
  }

  if (input.status === "BLOCKED") {
    if (!input.reason?.trim()) {
      throw ApiError.badRequest("Block reason is required.");
    }

    rider.suspensionReason = input.reason;
  }

  if (input.status === "TERMINATED") {
    if (!input.reason?.trim()) {
      throw ApiError.badRequest("Termination reason is required.");
    }

    rider.terminatedAt = now;

    rider.terminatedBy = actorObjectId;

    rider.terminationReason = input.reason;
  }

  if (input.status === "ACTIVE") {
    rider.suspendedAt = undefined;

    rider.suspendedBy = undefined;

    rider.suspensionReason = undefined;
  }

  await rider.save();

  return rider;
};

/*
|--------------------------------------------------------------------------
| Convenience Status Methods
|--------------------------------------------------------------------------
*/

export const activateRider = async (
  riderId: string,
  actorId: string,
): Promise<IRider> => {
  return updateRiderStatus(riderId, actorId, {
    status: "ACTIVE",
  });
};

export const suspendRider = async (
  riderId: string,
  actorId: string,
  reason: string,
): Promise<IRider> => {
  return updateRiderStatus(riderId, actorId, {
    status: "SUSPENDED",
    reason,
  });
};

export const blockRider = async (
  riderId: string,
  actorId: string,
  reason: string,
): Promise<IRider> => {
  return updateRiderStatus(riderId, actorId, {
    status: "BLOCKED",
    reason,
  });
};

export const terminateRider = async (
  riderId: string,
  actorId: string,
  reason: string,
): Promise<IRider> => {
  return updateRiderStatus(riderId, actorId, {
    status: "TERMINATED",
    reason,
  });
};

/*
|--------------------------------------------------------------------------
| Delete Rider
|--------------------------------------------------------------------------
*/

export const deleteRider = async (riderId: string): Promise<void> => {
  const riderObjectId = validateObjectId(riderId, "riderId");

  const rider = await Rider.findById(riderObjectId);

  if (!rider) {
    throw ApiError.notFound("Rider not found.");
  }

  if (rider.status === "ACTIVE") {
    throw ApiError.badRequest("Active riders cannot be deleted.");
  }

  await Rider.deleteOne({
    _id: riderObjectId,
  });
};
