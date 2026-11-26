import { Types } from "mongoose";

import {
  RiderEarning,
  RIDER_EARNING_STATUSES,
  type RiderEarningStatus,
  type RiderEarningType,
} from "./riderEarning.model";

import type {
  RiderEarningData,
  RiderEarningListResult,
  RiderEarningSummary,
} from "./riderEarning.types";

import { Rider } from "../riders/rider.model";

import { ApiError } from "../../utils/ApiError";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export interface CreateRiderEarningServiceInput {
  readonly riderId: string;
  readonly orderId?: string;
  readonly type: RiderEarningType;
  readonly amount: number;
  readonly currency?: string;
  readonly description?: string;
  readonly earningDate?: Date;
  readonly notes?: string;
  readonly createdBy?: string;
}

export interface UpdateRiderEarningServiceInput {
  readonly type?: RiderEarningType;
  readonly amount?: number;
  readonly currency?: string;
  readonly description?: string;
  readonly earningDate?: Date;
  readonly notes?: string;
  readonly updatedBy?: string;
}

export interface UpdateRiderEarningStatusServiceInput {
  readonly status: RiderEarningStatus;
  readonly reason?: string;
  readonly notes?: string;
  readonly updatedBy?: string;
}

export interface RiderEarningListOptions {
  readonly page?: number;
  readonly limit?: number;
  readonly status?: RiderEarningStatus;
  readonly type?: RiderEarningType;
  readonly riderId?: string;
  readonly orderId?: string;
  readonly currency?: string;
  readonly from?: Date;
  readonly to?: Date;
}

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const ensureObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${fieldName}.`);
  }

  return new Types.ObjectId(value);
};

const ensureRiderExists = async (riderId: string): Promise<void> => {
  const riderObjectId = ensureObjectId(riderId, "rider ID");

  const rider = await Rider.findById(riderObjectId).select("_id status").lean();

  if (!rider) {
    throw ApiError.notFound("Rider not found.");
  }

  if (rider.status === "TERMINATED") {
    throw ApiError.badRequest("Cannot create earnings for a terminated rider.");
  }
};

const normalizeCurrency = (currency?: string): string => {
  return (currency ?? "BDT").trim().toUpperCase();
};

const getAllowedStatusTransitions = (
  status: RiderEarningStatus,
): readonly RiderEarningStatus[] => {
  switch (status) {
    case "PENDING":
      return ["APPROVED", "CANCELLED"];

    case "APPROVED":
      return ["PAID", "CANCELLED"];

    case "PAID":
      return [];

    case "CANCELLED":
      return [];

    default:
      return [];
  }
};

/*
|--------------------------------------------------------------------------
| Create
|--------------------------------------------------------------------------
*/

export const createRiderEarning = async (
  input: CreateRiderEarningServiceInput,
): Promise<RiderEarningData> => {
  await ensureRiderExists(input.riderId);

  const riderId = ensureObjectId(input.riderId, "rider ID");

  const orderId = input.orderId
    ? ensureObjectId(input.orderId, "order ID")
    : undefined;

  const createdBy = input.createdBy
    ? ensureObjectId(input.createdBy, "creator ID")
    : undefined;

  const earning = await RiderEarning.create({
    riderId,
    orderId,
    type: input.type,
    amount: input.amount,
    currency: normalizeCurrency(input.currency),
    description: input.description?.trim(),
    earningDate: input.earningDate ?? new Date(),
    notes: input.notes?.trim(),
    createdBy,
    updatedBy: createdBy,
  });

  return earning.toObject() as RiderEarningData;
};

/*
|--------------------------------------------------------------------------
| Get By ID
|--------------------------------------------------------------------------
*/

export const getRiderEarningById = async (
  earningId: string,
): Promise<RiderEarningData> => {
  const id = ensureObjectId(earningId, "earning ID");

  const earning = await RiderEarning.findById(id).lean();

  if (!earning) {
    throw ApiError.notFound("Rider earning not found.");
  }

  return earning as RiderEarningData;
};

/*
|--------------------------------------------------------------------------
| Get By Rider
|--------------------------------------------------------------------------
*/

export const getRiderEarningsByRider = async (
  riderId: string,
  options: RiderEarningListOptions = {},
): Promise<RiderEarningListResult> => {
  ensureObjectId(riderId, "rider ID");

  return listRiderEarnings({
    ...options,
    riderId,
  });
};

/*
|--------------------------------------------------------------------------
| List
|--------------------------------------------------------------------------
*/

export const listRiderEarnings = async (
  options: RiderEarningListOptions = {},
): Promise<RiderEarningListResult> => {
  const page = Math.max(DEFAULT_PAGE, options.page ?? DEFAULT_PAGE);

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, options.limit ?? DEFAULT_LIMIT),
  );

  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (options.status) {
    filter.status = options.status;
  }

  if (options.type) {
    filter.type = options.type;
  }

  if (options.riderId) {
    filter.riderId = ensureObjectId(options.riderId, "rider ID");
  }

  if (options.orderId) {
    filter.orderId = ensureObjectId(options.orderId, "order ID");
  }

  if (options.currency) {
    filter.currency = normalizeCurrency(options.currency);
  }

  if (options.from || options.to) {
    filter.earningDate = {
      ...(options.from
        ? {
            $gte: options.from,
          }
        : {}),

      ...(options.to
        ? {
            $lte: options.to,
          }
        : {}),
    };
  }

  const [earnings, total] = await Promise.all([
    RiderEarning.find(filter)
      .sort({
        earningDate: -1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    RiderEarning.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    earnings: earnings as RiderEarningData[],

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
| Update
|--------------------------------------------------------------------------
*/

export const updateRiderEarning = async (
  earningId: string,
  input: UpdateRiderEarningServiceInput,
): Promise<RiderEarningData> => {
  const id = ensureObjectId(earningId, "earning ID");

  const earning = await RiderEarning.findById(id);

  if (!earning) {
    throw ApiError.notFound("Rider earning not found.");
  }

  if (earning.status === "PAID" || earning.status === "CANCELLED") {
    throw ApiError.badRequest(
      `Cannot update a ${earning.status.toLowerCase()} earning.`,
    );
  }

  if (input.type !== undefined) {
    earning.type = input.type;
  }

  if (input.amount !== undefined) {
    earning.amount = input.amount;
  }

  if (input.currency !== undefined) {
    earning.currency = normalizeCurrency(input.currency);
  }

  if (input.description !== undefined) {
    earning.description = input.description.trim();
  }

  if (input.earningDate !== undefined) {
    earning.earningDate = input.earningDate;
  }

  if (input.notes !== undefined) {
    earning.notes = input.notes.trim();
  }

  if (input.updatedBy) {
    earning.updatedBy = ensureObjectId(input.updatedBy, "updater ID");
  }

  await earning.save();

  return earning.toObject() as RiderEarningData;
};

/*
|--------------------------------------------------------------------------
| Status Update
|--------------------------------------------------------------------------
*/

export const updateRiderEarningStatus = async (
  earningId: string,
  input: UpdateRiderEarningStatusServiceInput,
): Promise<RiderEarningData> => {
  const id = ensureObjectId(earningId, "earning ID");

  const earning = await RiderEarning.findById(id);

  if (!earning) {
    throw ApiError.notFound("Rider earning not found.");
  }

  if (!RIDER_EARNING_STATUSES.includes(input.status)) {
    throw ApiError.badRequest("Invalid rider earning status.");
  }

  const allowedTransitions = getAllowedStatusTransitions(earning.status);

  if (!allowedTransitions.includes(input.status)) {
    throw ApiError.badRequest(
      `Cannot change earning status from ${earning.status} to ${input.status}.`,
    );
  }

  const now = new Date();

  earning.status = input.status;

  if (input.notes !== undefined) {
    earning.notes = input.notes.trim();
  }

  if (input.updatedBy) {
    earning.updatedBy = ensureObjectId(input.updatedBy, "updater ID");
  }

  if (input.status === "APPROVED") {
    earning.approvedAt = now;

    if (input.updatedBy) {
      earning.approvedBy = ensureObjectId(input.updatedBy, "approver ID");
    }
  }

  if (input.status === "PAID") {
    earning.paidAt = now;

    if (input.updatedBy) {
      earning.paidBy = ensureObjectId(input.updatedBy, "payer ID");
    }
  }

  if (input.status === "CANCELLED") {
    earning.cancelledAt = now;

    if (input.updatedBy) {
      earning.cancelledBy = ensureObjectId(input.updatedBy, "canceller ID");
    }

    earning.cancellationReason = input.reason?.trim();
  }

  await earning.save();

  return earning.toObject() as RiderEarningData;
};

/*
|--------------------------------------------------------------------------
| Convenience Status Methods
|--------------------------------------------------------------------------
*/

export const approveRiderEarning = async (
  earningId: string,
  approvedBy: string,
): Promise<RiderEarningData> => {
  return updateRiderEarningStatus(earningId, {
    status: "APPROVED",
    updatedBy: approvedBy,
  });
};

export const payRiderEarning = async (
  earningId: string,
  paidBy: string,
): Promise<RiderEarningData> => {
  return updateRiderEarningStatus(earningId, {
    status: "PAID",
    updatedBy: paidBy,
  });
};

export const cancelRiderEarning = async (
  earningId: string,
  cancelledBy: string,
  reason: string,
): Promise<RiderEarningData> => {
  return updateRiderEarningStatus(earningId, {
    status: "CANCELLED",
    reason,
    updatedBy: cancelledBy,
  });
};

/*
|--------------------------------------------------------------------------
| Delete
|--------------------------------------------------------------------------
*/

export const deleteRiderEarning = async (earningId: string): Promise<void> => {
  const id = ensureObjectId(earningId, "earning ID");

  const earning = await RiderEarning.findById(id);

  if (!earning) {
    throw ApiError.notFound("Rider earning not found.");
  }

  if (earning.status === "PAID") {
    throw ApiError.badRequest("Paid rider earnings cannot be deleted.");
  }

  await earning.deleteOne();
};

/*
|--------------------------------------------------------------------------
| Rider Summary
|--------------------------------------------------------------------------
*/

export const getRiderEarningSummary = async (
  riderId: string,
  currency = "BDT",
): Promise<RiderEarningSummary> => {
  const riderObjectId = ensureObjectId(riderId, "rider ID");

  const normalizedCurrency = normalizeCurrency(currency);

  const summary = await RiderEarning.aggregate([
    {
      $match: {
        riderId: riderObjectId,

        currency: normalizedCurrency,
      },
    },

    {
      $group: {
        _id: "$status",

        total: {
          $sum: "$amount",
        },
      },
    },
  ]);

  const result: RiderEarningSummary = {
    totalEarnings: 0,
    pendingEarnings: 0,
    approvedEarnings: 0,
    paidEarnings: 0,
    cancelledEarnings: 0,
    currency: normalizedCurrency,
  };

  for (const item of summary) {
    const amount = Number(item.total) || 0;

    switch (item._id) {
      case "PENDING":
        result.pendingEarnings += amount;
        break;

      case "APPROVED":
        result.approvedEarnings += amount;
        break;

      case "PAID":
        result.paidEarnings += amount;
        break;

      case "CANCELLED":
        result.cancelledEarnings += amount;
        break;
    }

    result.totalEarnings += amount;
  }

  return result;
};

/*
|--------------------------------------------------------------------------
| Rider Ownership Helper
|--------------------------------------------------------------------------
*/

export const requireRiderEarningForRider = async (
  earningId: string,
  riderId: string,
): Promise<RiderEarningData> => {
  const earningObjectId = ensureObjectId(earningId, "earning ID");
  const riderObjectId = ensureObjectId(riderId, "rider ID");

  const earning = await RiderEarning.findOne({
    _id: earningObjectId,
    riderId: riderObjectId,
  }).lean();

  if (!earning) {
    throw ApiError.notFound("Rider earning not found.");
  }

  return earning as RiderEarningData;
};
