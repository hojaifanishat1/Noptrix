import { Seller } from "../sellers/seller.model";
import { Rider } from "../riders/rider.model";
import { OnboardingDocument } from "./onboarding-document.model";

import {
  getRequiredSellerDocuments,
  getRequiredRiderDocuments,
} from "./onboarding-document.service";

import { ApiError } from "../../utils/ApiError";

type ProfileInput = Record<string, unknown>;

const validateProfileInput = (
  input: unknown,
  allowedFields: readonly string[],
): Record<string, string> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw ApiError.badRequest("A valid profile object is required.");
  }

  const body = input as ProfileInput;
  const protectedFields = [
    "status",
    "onboardingStatus",
    "onboardingCompletedAt",
    "verifiedAt",
    "isAvailable",
    "documentStatus",
    "reviewedAt",
    "reviewedBy",
  ];

  for (const field of protectedFields) {
    if (field in body) {
      throw ApiError.badRequest(`${field} cannot be updated by this endpoint.`);
    }
  }

  const updates: Record<string, string> = {};

  for (const field of allowedFields) {
    if (!(field in body)) continue;

    const value = body[field];

    if (typeof value !== "string") {
      throw ApiError.badRequest(`${field} must be a string.`);
    }

    const normalized = value.trim();

    if (normalized.length > 500) {
      throw ApiError.badRequest(`${field} is too long.`);
    }

    updates[field] = normalized;
  }

  if (Object.keys(updates).length === 0) {
    throw ApiError.badRequest("No valid profile fields were provided.");
  }

  return updates;
};

const hasValue = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

export const refreshOnboardingCompletion = async (
  subjectType: "SELLER" | "RIDER",
  subjectId: string,
) => {
  if (subjectType === "SELLER") {
    const seller = await Seller.findById(subjectId);

    if (!seller) {
      throw ApiError.notFound("Seller not found.");
    }

    const requiredDocuments = [
      ...getRequiredSellerDocuments(seller.type),
    ];

    if (hasValue(seller.taxNumber)) {
      requiredDocuments.push("TAX_CERTIFICATE");
    }

    const approvedDocuments = await OnboardingDocument.find({
      subjectType: "SELLER",
      subjectId: seller._id,
      status: "APPROVED",
    }).select("documentType");

    const approvedTypes = new Set(
      approvedDocuments.map((document) => document.documentType),
    );

    const documentsApproved = requiredDocuments.every((type) =>
      approvedTypes.has(type),
    );

    const profileComplete =
      hasValue(seller.businessName) &&
      hasValue(seller.phone) &&
      (seller.type !== "INDIVIDUAL" || hasValue(seller.legalName)) &&
      (seller.type !== "BUSINESS" ||
        hasValue(seller.registrationNumber));

    const complete = documentsApproved && profileComplete;

    seller.onboardingStatus = complete ? "COMPLETED" : "IN_PROGRESS";

    if (complete) {
      seller.onboardingCompletedAt ??= new Date();
    } else {
      seller.onboardingCompletedAt = undefined;
    }

    await seller.save();

    return {
      onboardingStatus: seller.onboardingStatus,
      onboardingCompletedAt: seller.onboardingCompletedAt,
    };
  }

  const rider = await Rider.findById(subjectId);

  if (!rider) {
    throw ApiError.notFound("Rider not found.");
  }

  const requiredDocuments = getRequiredRiderDocuments();

  const approvedDocuments = await OnboardingDocument.find({
    subjectType: "RIDER",
    subjectId: rider._id,
    status: "APPROVED",
  }).select("documentType");

  const approvedTypes = new Set(
    approvedDocuments.map((document) => document.documentType),
  );

  const documentsApproved = requiredDocuments.every((type) =>
    approvedTypes.has(type),
  );

  const profileComplete =
    hasValue(rider.name) &&
    hasValue(rider.phone) &&
    hasValue(rider.vehicleType) &&
    hasValue(rider.vehicleNumber) &&
    hasValue(rider.licenseNumber) &&
    hasValue(rider.nationalId);

  const complete = documentsApproved && profileComplete;

  rider.onboardingStatus = complete ? "COMPLETED" : "IN_PROGRESS";

  if (complete) {
    rider.onboardingCompletedAt ??= new Date();
  } else {
    rider.onboardingCompletedAt = undefined;
  }

  await rider.save();

  return {
    onboardingStatus: rider.onboardingStatus,
    onboardingCompletedAt: rider.onboardingCompletedAt,
  };
};

export const updateSellerOnboardingProfile = async (
  sellerId: string,
  input: unknown,
) => {
  const seller = await Seller.findById(sellerId);

  if (!seller) {
    throw ApiError.notFound("Seller not found.");
  }

  if (seller.status !== "ACTIVE") {
    throw ApiError.forbidden("Your seller account is not active.");
  }

  if (seller.onboardingStatus === "COMPLETED") {
    throw ApiError.conflict("Seller onboarding is already completed.");
  }

  const updates = validateProfileInput(input, [
    "businessName",
    "legalName",
    "phone",
    "taxNumber",
    "registrationNumber",
    "description",
    "website",
  ]);

  Object.assign(seller, updates);
  seller.onboardingStatus = "IN_PROGRESS";

  await seller.save();

  const progress = await refreshOnboardingCompletion(
    "SELLER",
    seller.id,
  );

  return {
    profile: {
      id: seller._id,
      type: seller.type,
      businessName: seller.businessName,
      legalName: seller.legalName,
      phone: seller.phone,
      taxNumber: seller.taxNumber,
      registrationNumber: seller.registrationNumber,
      onboardingStatus: progress.onboardingStatus,
      onboardingCompletedAt: progress.onboardingCompletedAt,
    },
  };
};

export const updateRiderOnboardingProfile = async (
  riderId: string,
  input: unknown,
) => {
  const rider = await Rider.findById(riderId);

  if (!rider) {
    throw ApiError.notFound("Rider not found.");
  }

  if (rider.status !== "ACTIVE") {
    throw ApiError.forbidden("Your rider account is not active.");
  }

  if (rider.onboardingStatus === "COMPLETED") {
    throw ApiError.conflict("Rider onboarding is already completed.");
  }

  const updates = validateProfileInput(input, [
    "name",
    "phone",
    "vehicleType",
    "vehicleNumber",
    "licenseNumber",
    "nationalId",
  ]);

  Object.assign(rider, updates);
  rider.onboardingStatus = "IN_PROGRESS";

  await rider.save();

  const progress = await refreshOnboardingCompletion(
    "RIDER",
    rider.id,
  );

  return {
    profile: {
      id: rider._id,
      name: rider.name,
      phone: rider.phone,
      vehicleType: rider.vehicleType,
      vehicleNumber: rider.vehicleNumber,
      onboardingStatus: progress.onboardingStatus,
      onboardingCompletedAt: progress.onboardingCompletedAt,
    },
  };
};
