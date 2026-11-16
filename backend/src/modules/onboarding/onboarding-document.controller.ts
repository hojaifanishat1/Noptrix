import type { Request } from "express";
import { Types } from "mongoose";
import { refreshOnboardingCompletion } from "./onboarding-progress.service";
import { createPrivateCloudinaryDownloadUrl } from "../../services/cloudinary.service";

import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

import {
  getAuthenticatedSellerId,
} from "../../middlewares/sellerAuth.middleware";

import {
  getAuthenticatedRiderId,
} from "../../middlewares/riderAuth.middleware";

import {
  getAuthenticatedOwnerId,
} from "../../middlewares/ownerAuth.middleware";

import {
  getOnboardingDocuments,
  reviewOnboardingDocument,
  uploadOnboardingDocument,
} from "./onboarding-document.service";

import {
  ONBOARDING_DOCUMENT_STATUSES,
  ONBOARDING_SUBJECT_TYPES,
} from "./onboarding-document.model";

type UploadedFileRequest = Request & {
  file?: Express.Multer.File;
};

type ReviewRequestBody = {
  status?: unknown;
  rejectionReason?: unknown;
};

const getUploadedFile = (req: UploadedFileRequest) => {
  if (!req.file) {
    throw ApiError.badRequest("Document file is required.");
  }

  return req.file;
};

const getSubjectType = (
  value: unknown,
): (typeof ONBOARDING_SUBJECT_TYPES)[number] => {
  if (
    typeof value !== "string" ||
    !ONBOARDING_SUBJECT_TYPES.includes(
      value as (typeof ONBOARDING_SUBJECT_TYPES)[number],
    )
  ) {
    throw ApiError.badRequest("Invalid onboarding subject type.");
  }

  return value as (typeof ONBOARDING_SUBJECT_TYPES)[number];
};

const getSafeDocument = (document: any) => ({
  id: document._id,
  documentType: document.documentType,
  status: document.status,
  rejectionReason: document.rejectionReason,
  reviewedAt: document.reviewedAt,
  createdAt: document.createdAt,
});

export const uploadSellerOnboardingDocumentController = asyncHandler(
  async (req: UploadedFileRequest, res): Promise<void> => {
    const sellerId = getAuthenticatedSellerId(req);
    const file = getUploadedFile(req);

    const document = await uploadOnboardingDocument({
      subjectType: "SELLER",
      subjectId: sellerId,
      documentType: req.body.documentType,
      file,
    });

    res.status(201).json(
      ApiResponse.ok(
        { document: getSafeDocument(document) },
        "Document uploaded successfully. Awaiting review.",
      ),
    );
  },
);

export const uploadRiderOnboardingDocumentController = asyncHandler(
  async (req: UploadedFileRequest, res): Promise<void> => {
    const riderId = getAuthenticatedRiderId(req);
    const file = getUploadedFile(req);

    const document = await uploadOnboardingDocument({
      subjectType: "RIDER",
      subjectId: riderId,
      documentType: req.body.documentType,
      file,
    });

    res.status(201).json(
      ApiResponse.ok(
        { document: getSafeDocument(document) },
        "Document uploaded successfully. Awaiting review.",
      ),
    );
  },
);

export const getSellerOnboardingDocumentsController = asyncHandler(
  async (req, res): Promise<void> => {
    const sellerId = getAuthenticatedSellerId(req);

    const documents = await getOnboardingDocuments(
      "SELLER",
      sellerId,
    );

    res.json(
      ApiResponse.ok(
        { documents: documents.map(getSafeDocument) },
        "Onboarding documents retrieved.",
      ),
    );
  },
);

export const getRiderOnboardingDocumentsController = asyncHandler(
  async (req, res): Promise<void> => {
    const riderId = getAuthenticatedRiderId(req);

    const documents = await getOnboardingDocuments(
      "RIDER",
      riderId,
    );

    res.json(
      ApiResponse.ok(
        { documents: documents.map(getSafeDocument) },
        "Onboarding documents retrieved.",
      ),
    );
  },
);

export const getOwnerOnboardingDocumentsController = asyncHandler(
  async (req, res): Promise<void> => {
    getAuthenticatedOwnerId(req);

    const subjectType = getSubjectType(req.query.subjectType);
    const subjectId = req.query.subjectId;

    if (
      typeof subjectId !== "string" ||
      !Types.ObjectId.isValid(subjectId)
    ) {
      throw ApiError.badRequest("A valid subjectId is required.");
    }

    const documents = await getOnboardingDocuments(
      subjectType,
      subjectId,
    );

    const ownerDocuments = documents.map((document: any) => ({
      id: document._id,
      subjectType: document.subjectType,
      subjectId: document.subjectId,
      documentType: document.documentType,
      originalFilename: document.originalFilename,
      mimeType: document.mimeType,
      bytes: document.bytes,
      status: document.status,
      rejectionReason: document.rejectionReason,
      reviewedAt: document.reviewedAt,
      createdAt: document.createdAt,
      downloadUrl: createPrivateCloudinaryDownloadUrl(
        document.publicId,
        document.format,
        document.resourceType,
      ),
    }));

    res.json(
      ApiResponse.ok(
        { documents: ownerDocuments },
        "Onboarding documents retrieved for review.",
      ),
    );
  },
);

export const reviewOnboardingDocumentController = asyncHandler(
  async (req, res): Promise<void> => {
    const ownerId = getAuthenticatedOwnerId(req);

    const { documentId } = req.params;
    const { status, rejectionReason } =
      req.body as ReviewRequestBody;

    if (
      typeof documentId !== "string" ||
      !Types.ObjectId.isValid(documentId)
    ) {
      throw ApiError.badRequest("Invalid document ID.");
    }

    if (
      typeof status !== "string" ||
      !ONBOARDING_DOCUMENT_STATUSES.includes(
        status as (typeof ONBOARDING_DOCUMENT_STATUSES)[number],
      ) ||
      status === "PENDING"
    ) {
      throw ApiError.badRequest(
        "Review status must be APPROVED or REJECTED.",
      );
    }

    if (
      status === "REJECTED" &&
      (typeof rejectionReason !== "string" ||
        !rejectionReason.trim())
    ) {
      throw ApiError.badRequest(
        "A rejection reason is required.",
      );
    }

    const document = await reviewOnboardingDocument({
      documentId,
      status: status as "APPROVED" | "REJECTED",
      rejectionReason:
        typeof rejectionReason === "string"
          ? rejectionReason.trim()
          : undefined,
      reviewerId: ownerId,
    });

    
    await refreshOnboardingCompletion(
      document.subjectType,
      String(document.subjectId),
    );

res.json(
      ApiResponse.ok(
        { document: getSafeDocument(document) },
        `Document ${status.toLowerCase()} successfully.`,
      ),
    );
  },
);
