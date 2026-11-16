import { Types } from "mongoose";

import { Seller } from "../sellers/seller.model";
import { Rider } from "../riders/rider.model";

import {
  deleteFromCloudinary,
  uploadBufferToCloudinary,
} from "../../services/cloudinary.service";

import { ApiError } from "../../utils/ApiError";

import {
  OnboardingDocument,
  OnboardingSubjectType,
  SellerDocumentType,
  RiderDocumentType,
} from "./onboarding-document.model";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export interface UploadOnboardingDocumentInput {
  subjectType: OnboardingSubjectType;
  subjectId: string;
  documentType: string;
  file: Express.Multer.File;
}

export interface ReviewOnboardingDocumentInput {
  documentId: string;
  reviewerId: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const SELLER_TYPES = new Set<string>([
  "IDENTITY_PROOF",
  "BUSINESS_REGISTRATION",
  "TAX_CERTIFICATE",
  "BANK_PROOF",
]);

const RIDER_TYPES = new Set<string>([
  "NATIONAL_ID",
  "DRIVING_LICENSE",
  "VEHICLE_REGISTRATION",
  "VEHICLE_INSURANCE",
]);

const validateObjectId = (value: string, field: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${field}.`);
  }

  return new Types.ObjectId(value);
};

const validateDocumentType = (
  subjectType: OnboardingSubjectType,
  documentType: string,
): void => {
  const allowed =
    subjectType === "SELLER" ? SELLER_TYPES : RIDER_TYPES;

  if (!allowed.has(documentType)) {
    throw ApiError.badRequest("Unsupported onboarding document type.");
  }
};

/*
|--------------------------------------------------------------------------
| Subject Validation
|--------------------------------------------------------------------------
*/

const assertSubjectCanUpload = async (
  subjectType: OnboardingSubjectType,
  subjectId: Types.ObjectId,
): Promise<void> => {
  if (subjectType === "SELLER") {
    const seller = await Seller.findById(subjectId)
      .select("_id status onboardingStatus")
      .lean()
      .exec();

    if (!seller) {
      throw ApiError.notFound("Seller profile not found.");
    }

    if (seller.status !== "ACTIVE") {
      throw ApiError.forbidden("Seller account is not active.");
    }

    if (seller.onboardingStatus === "COMPLETED") {
      throw ApiError.badRequest(
        "Seller onboarding is already completed.",
      );
    }

    return;
  }

  const rider = await Rider.findById(subjectId)
    .select("_id status onboardingStatus")
    .lean()
    .exec();

  if (!rider) {
    throw ApiError.notFound("Rider profile not found.");
  }

  if (rider.status !== "ACTIVE") {
    throw ApiError.forbidden("Rider account is not active.");
  }

  if (rider.onboardingStatus === "COMPLETED") {
    throw ApiError.badRequest(
      "Rider onboarding is already completed.",
    );
  }
};

/*
|--------------------------------------------------------------------------
| Upload Document
|--------------------------------------------------------------------------
*/

export const uploadOnboardingDocument = async (
  input: UploadOnboardingDocumentInput,
) => {
  const subjectId = validateObjectId(input.subjectId, "subject ID");

  const documentType = input.documentType.trim().toUpperCase();

  validateDocumentType(input.subjectType, documentType);

  if (!input.file?.buffer?.length) {
    throw ApiError.badRequest("A document file is required.");
  }

  if (input.file.size > 10 * 1024 * 1024) {
    throw ApiError.badRequest("Document cannot exceed 10 MB.");
  }

  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedMimeTypes.includes(input.file.mimetype.toLowerCase())) {
    throw ApiError.badRequest(
      "Only PDF, JPEG, PNG and WebP documents are allowed.",
    );
  }

  await assertSubjectCanUpload(input.subjectType, subjectId);

  const resourceType = input.file.mimetype.startsWith("image/")
    ? "image"
    : "raw";

  const folder =
    input.subjectType === "SELLER"
      ? "noptrix/onboarding/sellers"
      : "noptrix/onboarding/riders";

  const uploaded = await uploadBufferToCloudinary(
    {
      buffer: input.file.buffer,
      filename: input.file.originalname,
      mimeType: input.file.mimetype,
    },
    {
      folder,
      resourceType,
      useUniqueFilename: true,
      overwrite: false,
  accessMode: "authenticated",
      tags: [
        "onboarding",
        input.subjectType.toLowerCase(),
        documentType.toLowerCase(),
      ],
    },
  );

  let savedDocument;

  try {
    const existing = await OnboardingDocument.findOne({
      subjectType: input.subjectType,
      subjectId,
      documentType,
    });

    if (existing) {
      const oldPublicId = existing.publicId;
      const oldResourceType = existing.resourceType;

      existing.publicId = uploaded.publicId;
      existing.secureUrl = uploaded.secureUrl;
      existing.resourceType = uploaded.resourceType;
      existing.format = uploaded.format;
      existing.originalFilename = input.file.originalname;
      existing.mimeType = input.file.mimetype;
      existing.bytes = uploaded.bytes;

      existing.status = "PENDING";
      existing.rejectionReason = undefined;
      existing.reviewedBy = undefined;
      existing.reviewedAt = undefined;

      savedDocument = await existing.save();

      try {
        await deleteFromCloudinary(oldPublicId, oldResourceType as never);
      } catch {
        // New document is saved. Old asset cleanup can be retried separately.
      }
    } else {
      savedDocument = await OnboardingDocument.create({
        subjectType: input.subjectType,
        subjectId,
        documentType,
        publicId: uploaded.publicId,
        secureUrl: uploaded.secureUrl,
        resourceType: uploaded.resourceType,
        format: uploaded.format,
        originalFilename: input.file.originalname,
        mimeType: input.file.mimetype,
        bytes: uploaded.bytes,
        status: "PENDING",
      });
    }
  } catch (error) {
    try {
      await deleteFromCloudinary(
        uploaded.publicId,
        uploaded.resourceType as never,
      );
    } catch {
      // Preserve the original database error.
    }

    throw error;
  }

  await updateOnboardingProgress(input.subjectType, subjectId);

  return savedDocument;
};

/*
|--------------------------------------------------------------------------
| List Documents
|--------------------------------------------------------------------------
*/

export const getOnboardingDocuments = async (
  subjectType: OnboardingSubjectType,
  subjectId: string,
) => {
  const id = validateObjectId(subjectId, "subject ID");

  return OnboardingDocument.find({
    subjectType,
    subjectId: id,
  })
    .select("-__v")
    .sort({ createdAt: -1 })
    .lean()
    .exec();
};

/*
|--------------------------------------------------------------------------
| Owner Review
|--------------------------------------------------------------------------
*/

export const reviewOnboardingDocument = async (
  input: ReviewOnboardingDocumentInput,
) => {
  const documentId = validateObjectId(input.documentId, "document ID");
  const reviewerId = validateObjectId(input.reviewerId, "reviewer ID");

  if (
    input.status === "REJECTED" &&
    !input.rejectionReason?.trim()
  ) {
    throw ApiError.badRequest(
      "A rejection reason is required.",
    );
  }

  const document = await OnboardingDocument.findById(documentId);

  if (!document) {
    throw ApiError.notFound("Onboarding document not found.");
  }

  document.status = input.status;
  document.reviewedBy = reviewerId;
  document.reviewedAt = new Date();
  document.rejectionReason =
    input.status === "REJECTED"
      ? input.rejectionReason?.trim()
      : undefined;

  await document.save();

  await updateOnboardingProgress(
    document.subjectType,
    document.subjectId,
  );

  return document;
};

/*
|--------------------------------------------------------------------------
| Onboarding Progress
|--------------------------------------------------------------------------
|
| This only sets IN_PROGRESS.
| COMPLETED will be set by the final completion service
| after all profile and document requirements are checked.
|--------------------------------------------------------------------------
*/

export const updateOnboardingProgress = async (
  subjectType: OnboardingSubjectType,
  subjectId: Types.ObjectId,
): Promise<void> => {
  if (subjectType === "SELLER") {
    await Seller.updateOne(
      {
        _id: subjectId,
        onboardingStatus: "NOT_STARTED",
      },
      {
        $set: {
          onboardingStatus: "IN_PROGRESS",
        },
      },
    );

    return;
  }

  await Rider.updateOne(
    {
      _id: subjectId,
      onboardingStatus: "NOT_STARTED",
    },
    {
      $set: {
        onboardingStatus: "IN_PROGRESS",
      },
    },
  );
};

/*
|--------------------------------------------------------------------------
| Required Document Definitions
|--------------------------------------------------------------------------
*/

export const getRequiredSellerDocuments = (
  sellerType: string,
): SellerDocumentType[] => {
  if (sellerType === "INDIVIDUAL") {
    return ["IDENTITY_PROOF", "BANK_PROOF"];
  }

  return [
    "IDENTITY_PROOF",
    "BUSINESS_REGISTRATION",
    "BANK_PROOF",
  ];
};

export const getRequiredRiderDocuments = (): RiderDocumentType[] => [
  "NATIONAL_ID",
  "DRIVING_LICENSE",
  "VEHICLE_REGISTRATION",
  "VEHICLE_INSURANCE",
];
