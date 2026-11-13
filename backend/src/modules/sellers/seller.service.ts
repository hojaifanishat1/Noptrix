import bcrypt from "bcryptjs";
import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";

import { Seller } from "./seller.model";

import { SellerStatus } from "./seller.types";

import {
  CreateSellerInput,
  SellerQueryInput,
  UpdateSellerInput,
  UpdateSellerStatusInput,
} from "./seller.validator";

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

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const normalizeSellerCode = (sellerCode: string): string =>
  sellerCode.trim().toUpperCase();

/*
|--------------------------------------------------------------------------
| Status Transitions
|--------------------------------------------------------------------------
*/

const SELLER_STATUS_TRANSITIONS: Record<SellerStatus, readonly SellerStatus[]> =
  {
    PENDING: ["ACTIVE", "REJECTED", "INACTIVE"],

    ACTIVE: ["INACTIVE", "SUSPENDED"],

    INACTIVE: ["ACTIVE", "SUSPENDED"],

    SUSPENDED: ["ACTIVE", "INACTIVE"],

    REJECTED: [],
  };

const canTransitionSellerStatus = (
  currentStatus: SellerStatus,
  nextStatus: SellerStatus,
): boolean => {
  return SELLER_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
};

/*
|--------------------------------------------------------------------------
| Create Seller
|--------------------------------------------------------------------------
*/

export const createSeller = async (
  input: CreateSellerInput,
  actorId?: string,
) => {
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedSellerCode = normalizeSellerCode(input.sellerCode);

  const [existingSellerByCode, existingSellerByEmail] = await Promise.all([
    Seller.findOne({ sellerCode: normalizedSellerCode }),
    Seller.findOne({ email: normalizedEmail }),
  ]);

  if (existingSellerByCode) {
    throw ApiError.conflict("Seller code already exists.");
  }

  if (existingSellerByEmail) {
    throw ApiError.conflict("Seller email already exists.");
  }

  const actorObjectId = actorId
    ? validateObjectId(actorId, "actorId")
    : undefined;

  const password = await bcrypt.hash(input.password, 12);

  const seller = await Seller.create({
    sellerCode: normalizedSellerCode,
    type: input.type,
    businessName: input.businessName,
    legalName: input.legalName,
    email: normalizedEmail,
    phone: input.phone,
    password,
    failedLoginAttempts: 0,
    taxNumber: input.taxNumber,
    registrationNumber: input.registrationNumber,
    description: input.description,
    logoUrl: input.logoUrl,
    website: input.website,
    status: "PENDING",
    notes: input.notes,
    createdBy: actorObjectId,
    updatedBy: actorObjectId,
  });

  return seller;
};

/*
|--------------------------------------------------------------------------
| Get Seller By ID
|--------------------------------------------------------------------------
*/

export const getSellerById = async (sellerId: string) => {
  const sellerObjectId = validateObjectId(sellerId, "sellerId");

  const seller = await Seller.findById(sellerObjectId)
    .populate("verifiedBy", "name email")
    .populate("suspendedBy", "name email")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");

  if (!seller) {
    throw ApiError.notFound("Seller not found.");
  }

  return seller;
};


/*
|--------------------------------------------------------------------------
| List Sellers
|--------------------------------------------------------------------------
*/

export const getAllSellers = async (query: SellerQueryInput) => {
  const { page, limit, status, type, search } = query;

  const filter: Record<string, unknown> = {};

  if (status) {
    filter.status = status;
  }

  if (type) {
    filter.type = type;
  }


  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const searchRegex = new RegExp(escapedSearch, "i");

    filter.$or = [
      {
        sellerCode: searchRegex,
      },
      {
        businessName: searchRegex,
      },
      {
        legalName: searchRegex,
      },
      {
        email: searchRegex,
      },
      {
        phone: searchRegex,
      },
    ];
  }

  const skip = (page - 1) * limit;

  const [sellers, total] = await Promise.all([
    Seller.find(filter)
        .populate("verifiedBy", "name email")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit),

    Seller.countDocuments(filter),
  ]);

  return {
    sellers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    },
  };
};

/*
|--------------------------------------------------------------------------
| Update Seller
|--------------------------------------------------------------------------
*/

export const updateSeller = async (
  sellerId: string,
  input: UpdateSellerInput,
  actorId?: string,
) => {
  const sellerObjectId = validateObjectId(sellerId, "sellerId");

  const seller = await Seller.findById(sellerObjectId);

  if (!seller) {
    throw ApiError.notFound("Seller not found.");
  }

  const actorObjectId = actorId
    ? validateObjectId(actorId, "actorId")
    : undefined;

  if (input.sellerCode !== undefined) {
    const normalizedCode = normalizeSellerCode(input.sellerCode);

    const duplicate = await Seller.findOne({
      sellerCode: normalizedCode,
      _id: {
        $ne: sellerObjectId,
      },
    });

    if (duplicate) {
      throw ApiError.conflict("Seller code already exists.");
    }

    seller.sellerCode = normalizedCode;
  }

  if (input.email !== undefined) {
    const normalizedEmail = normalizeEmail(input.email);

    const duplicate = await Seller.findOne({
      email: normalizedEmail,
      _id: {
        $ne: sellerObjectId,
      },
    });

    if (duplicate) {
      throw ApiError.conflict("Seller email already exists.");
    }

    seller.email = normalizedEmail;
  }

  if (input.type !== undefined) {
    seller.type = input.type;
  }

  if (input.businessName !== undefined) {
    seller.businessName = input.businessName;
  }

  if (input.legalName !== undefined) {
    seller.legalName = input.legalName;
  }

  if (input.phone !== undefined) {
    seller.phone = input.phone;
  }

  if (input.taxNumber !== undefined) {
    seller.taxNumber = input.taxNumber;
  }

  if (input.registrationNumber !== undefined) {
    seller.registrationNumber = input.registrationNumber;
  }

  if (input.description !== undefined) {
    seller.description = input.description;
  }

  if (input.logoUrl !== undefined) {
    seller.logoUrl = input.logoUrl;
  }

  if (input.website !== undefined) {
    seller.website = input.website;
  }

  if (input.notes !== undefined) {
    seller.notes = input.notes;
  }

  if (actorObjectId) {
    seller.updatedBy = actorObjectId;
  }

  await seller.save();

  return seller;
};

/*
|--------------------------------------------------------------------------
| Update Seller Status
|--------------------------------------------------------------------------
*/

export const updateSellerStatus = async (
  sellerId: string,
  actorId: string,
  input: UpdateSellerStatusInput,
) => {
  const sellerObjectId = validateObjectId(sellerId, "sellerId");

  const actorObjectId = validateObjectId(actorId, "actorId");

  const seller = await Seller.findById(sellerObjectId);

  if (!seller) {
    throw ApiError.notFound("Seller not found.");
  }

  const nextStatus = input.status;

  if (seller.status === nextStatus) {
    throw ApiError.badRequest(`Seller is already ${nextStatus}.`);
  }

  if (!canTransitionSellerStatus(seller.status, nextStatus)) {
    throw ApiError.badRequest(
      `Cannot change seller status from ${seller.status} to ${nextStatus}.`,
    );
  }

  /*
    |--------------------------------------------------------------------------
    | Rejection
    |--------------------------------------------------------------------------
    */

  if (nextStatus === "REJECTED") {
    if (!input.reason) {
      throw ApiError.badRequest("Rejection reason is required.");
    }

    seller.rejectionReason = input.reason;

    seller.suspendedAt = undefined;

    seller.suspendedBy = undefined;

    seller.suspensionReason = undefined;
  }

  /*
    |--------------------------------------------------------------------------
    | Suspension
    |--------------------------------------------------------------------------
    */

  if (nextStatus === "SUSPENDED") {
    if (!input.reason) {
      throw ApiError.badRequest("Suspension reason is required.");
    }

    seller.suspendedAt = new Date();

    seller.suspendedBy = actorObjectId;

    seller.suspensionReason = input.reason;
  }

  /*
    |--------------------------------------------------------------------------
    | Activation
    |--------------------------------------------------------------------------
    */

  if (nextStatus === "ACTIVE") {
    seller.verifiedAt = seller.verifiedAt ?? new Date();

    seller.verifiedBy = seller.verifiedBy ?? actorObjectId;

    seller.suspendedAt = undefined;

    seller.suspendedBy = undefined;

    seller.suspensionReason = undefined;

    seller.rejectionReason = undefined;
  }

  seller.status = nextStatus;

  seller.updatedBy = actorObjectId;

  await seller.save();

  return seller;
};

/*
|--------------------------------------------------------------------------
| Activate Seller
|--------------------------------------------------------------------------
*/

export const activateSeller = async (sellerId: string, actorId: string) => {
  return updateSellerStatus(sellerId, actorId, {
    status: "ACTIVE",
  });
};

/*
|--------------------------------------------------------------------------
| Suspend Seller
|--------------------------------------------------------------------------
*/

export const suspendSeller = async (
  sellerId: string,
  actorId: string,
  reason: string,
) => {
  return updateSellerStatus(sellerId, actorId, {
    status: "SUSPENDED",
    reason,
  });
};

/*
|--------------------------------------------------------------------------
| Deactivate Seller
|--------------------------------------------------------------------------
*/

export const deactivateSeller = async (sellerId: string, actorId: string) => {
  return updateSellerStatus(sellerId, actorId, {
    status: "INACTIVE",
  });
};

/*
|--------------------------------------------------------------------------
| Delete Seller
|--------------------------------------------------------------------------
|
| Hard deletion is intentionally avoided.
| Sellers should normally be deactivated/suspended instead.
|
*/

export const deleteSeller = async (sellerId: string) => {
  const sellerObjectId = validateObjectId(sellerId, "sellerId");

  const seller = await Seller.findById(sellerObjectId);

  if (!seller) {
    throw ApiError.notFound("Seller not found.");
  }

  if (seller.status === "ACTIVE") {
    throw ApiError.badRequest(
      "Active sellers cannot be deleted. Deactivate the seller first.",
    );
  }

  await Seller.deleteOne({
    _id: sellerObjectId,
  });

  return {
    deleted: true,
    sellerId,
  };
};

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

export { canTransitionSellerStatus, SELLER_STATUS_TRANSITIONS };
