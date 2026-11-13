import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { getSettingsByCategory } from "../settings/settings.service";
import { createSellerInvitation } from "../seller-invitations/seller-invitation.service";

import {
  SellerApplication,
  ISellerApplication,
} from "./seller-application.model";

import {
  CreateSellerApplicationInput,
  UpdateSellerApplicationInput,
  UpdateSellerApplicationStatusInput,
  SellerApplicationQueryInput,
} from "./seller-application.validator";

import { SellerApplicationStatus } from "./seller-application.types";

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const ACTIVE_APPLICATION_STATUSES: readonly SellerApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
];

const APPLICATION_STATUS_TRANSITIONS: Record<
  SellerApplicationStatus,
  readonly SellerApplicationStatus[]
> = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED", "WITHDRAWN"],

  UNDER_REVIEW: ["APPROVED", "REJECTED", "WITHDRAWN"],

  APPROVED: [],

  REJECTED: [],

  WITHDRAWN: [],
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

/*
|--------------------------------------------------------------------------
| Status Transition
|--------------------------------------------------------------------------
*/

export const canTransitionSellerApplicationStatus = (
  currentStatus: SellerApplicationStatus,
  nextStatus: SellerApplicationStatus,
): boolean => {
  return APPLICATION_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
};

/*
|--------------------------------------------------------------------------
| Create Application
|--------------------------------------------------------------------------
*/

export const createSellerApplication = async (
  applicantId: string,
  input: CreateSellerApplicationInput,
): Promise<ISellerApplication> => {
  const applicantObjectId = validateObjectId(applicantId, "applicantId");

  const applicationSettings = await getSettingsByCategory("seller-applications");

  if (applicationSettings.values.enabled !== true) {
    throw ApiError.forbidden("Seller application submissions are currently disabled.", {
      code: "SELLER_APPLICATIONS_DISABLED",
    });
  }

  const email = normalizeEmail(input.email);

  const existingActiveApplication = await SellerApplication.findOne({
    applicantId: applicantObjectId,
    status: {
      $in: ACTIVE_APPLICATION_STATUSES,
    },
  });

  if (existingActiveApplication) {
    throw ApiError.conflict("You already have an active seller application.");
  }

  const application = await SellerApplication.create({
    applicantId: applicantObjectId,

    businessName: input.businessName,

    legalName: input.legalName,

    type: input.type,

    email,

    phone: input.phone,

    taxNumber: input.taxNumber,

    registrationNumber: input.registrationNumber,

    description: input.description,

    logoUrl: input.logoUrl,

    website: input.website,

    address: input.address,

    city: input.city,

    country: input.country,

    status: "SUBMITTED",
  });

  return application;
};

/*
|--------------------------------------------------------------------------
| Get Application By ID
|--------------------------------------------------------------------------
*/

export const getSellerApplicationById = async (
  applicationId: string,
): Promise<ISellerApplication> => {
  const applicationObjectId = validateObjectId(applicationId, "applicationId");

  const application = await SellerApplication.findById(applicationObjectId)
    .populate("applicantId", "name email phone status")
    .populate("reviewedBy", "name email");

  if (!application) {
    throw ApiError.notFound("Seller application not found.");
  }

  return application;
};

/*
|--------------------------------------------------------------------------
| Get My Applications
|--------------------------------------------------------------------------
*/

export const getMySellerApplications = async (
  applicantId: string,
  query: SellerApplicationQueryInput,
) => {
  const applicantObjectId = validateObjectId(applicantId, "applicantId");

  const page = query.page ?? 1;

  const limit = query.limit ?? 20;

  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    applicantId: applicantObjectId,
  };

  if (query.status) {
    filter.status = query.status;
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.search) {
    const search = query.search.trim();

    if (search) {
      filter.$or = [
        {
          businessName: {
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
      ];
    }
  }

  const [applications, total] = await Promise.all([
    SellerApplication.find(filter)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .populate("reviewedBy", "name email"),

    SellerApplication.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    applications,

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
| Get All Applications
|--------------------------------------------------------------------------
*/

export const getAllSellerApplications = async (
  query: SellerApplicationQueryInput,
) => {
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

  if (query.applicantId) {
    filter.applicantId = validateObjectId(query.applicantId, "applicantId");
  }

  if (query.search) {
    const search = query.search.trim();

    if (search) {
      filter.$or = [
        {
          businessName: {
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
      ];
    }
  }

  const [applications, total] = await Promise.all([
    SellerApplication.find(filter)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .populate("applicantId", "name email phone status")
      .populate("reviewedBy", "name email"),

    SellerApplication.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    applications,

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
| Update Own Application
|--------------------------------------------------------------------------
*/

export const updateMySellerApplication = async (
  applicationId: string,
  applicantId: string,
  input: UpdateSellerApplicationInput,
): Promise<ISellerApplication> => {
  const applicationObjectId = validateObjectId(applicationId, "applicationId");

  const applicantObjectId = validateObjectId(applicantId, "applicantId");

  const application = await SellerApplication.findOne({
    _id: applicationObjectId,

    applicantId: applicantObjectId,
  });

  if (!application) {
    throw ApiError.notFound("Seller application not found.");
  }

  if (!["SUBMITTED", "UNDER_REVIEW"].includes(application.status)) {
    throw ApiError.badRequest(
      "This seller application can no longer be updated.",
    );
  }

  if (input.email !== undefined) {
    input.email = normalizeEmail(input.email);
  }

  Object.assign(application, input);

  await application.save();

  return application;
};

/*
|--------------------------------------------------------------------------
| Update Application Status
|--------------------------------------------------------------------------
*/

export const updateSellerApplicationStatus = async (
  applicationId: string,
  reviewerId: string,
  input: UpdateSellerApplicationStatusInput,
): Promise<ISellerApplication> => {
  const applicationObjectId = validateObjectId(applicationId, "applicationId");

  const reviewerObjectId = validateObjectId(reviewerId, "reviewerId");

  const application = await SellerApplication.findById(applicationObjectId);

  if (!application) {
    throw ApiError.notFound("Seller application not found.");
  }

  const currentStatus = application.status;

  const nextStatus = input.status;

  if (!canTransitionSellerApplicationStatus(currentStatus, nextStatus)) {
    throw ApiError.badRequest(
      `Cannot change seller application status from ${currentStatus} to ${nextStatus}.`,
    );
  }

  if (nextStatus === "REJECTED" && !input.rejectionReason?.trim()) {
    throw ApiError.badRequest("Rejection reason is required.");
  }

  const now = new Date();

  application.status = nextStatus;

  application.reviewedBy = reviewerObjectId;

  application.reviewedAt = now;

  if (input.notes !== undefined) {
    application.notes = input.notes;
  }

  if (nextStatus === "APPROVED") {
    application.approvedAt = now;

    application.rejectionReason = undefined;
  }

  if (nextStatus === "REJECTED") {
    application.rejectedAt = now;

    application.rejectionReason = input.rejectionReason;
  }

  await application.save();

  /*
   * Approval does not create a Seller profile.
   * It only sends an invitation to the existing customer account.
   * If email delivery fails, the application remains APPROVED and
   * an Owner can use the resend endpoint.
   */
  if (nextStatus === "APPROVED") {
    await createSellerInvitation(
      application._id.toString(),
      reviewerObjectId.toString(),
    );
  }

  return application;
};

/*
|--------------------------------------------------------------------------
| Resend Seller Invitation
|--------------------------------------------------------------------------
*/

export const resendSellerApplicationInvitation = async (
  applicationId: string,
  reviewerUserId: string,
): Promise<{ sent: boolean; expiresAt: Date }> => {
  const applicationObjectId = validateObjectId(applicationId, "applicationId");
  const reviewerObjectId = validateObjectId(reviewerUserId, "reviewerUserId");

  const application = await SellerApplication.findById(applicationObjectId)
    .select("_id status")
    .exec();

  if (!application) {
    throw ApiError.notFound("Seller application not found.");
  }

  if (application.status !== "APPROVED") {
    throw ApiError.badRequest(
      "Only approved seller applications can receive an invitation.",
    );
  }

  return createSellerInvitation(
    applicationObjectId.toString(),
    reviewerObjectId.toString(),
  );
};

/*
|--------------------------------------------------------------------------
| Withdraw Application
|--------------------------------------------------------------------------
*/

export const withdrawSellerApplication = async (
  applicationId: string,
  applicantId: string,
): Promise<ISellerApplication> => {
  const applicationObjectId = validateObjectId(applicationId, "applicationId");

  const applicantObjectId = validateObjectId(applicantId, "applicantId");

  const application = await SellerApplication.findOne({
    _id: applicationObjectId,

    applicantId: applicantObjectId,
  });

  if (!application) {
    throw ApiError.notFound("Seller application not found.");
  }

  if (!["SUBMITTED", "UNDER_REVIEW"].includes(application.status)) {
    throw ApiError.badRequest("This seller application cannot be withdrawn.");
  }

  application.status = "WITHDRAWN";

  application.withdrawnAt = new Date();

  await application.save();

  return application;
};

/*
|--------------------------------------------------------------------------
| Delete Application
|--------------------------------------------------------------------------
*/

export const deleteSellerApplication = async (
  applicationId: string,
): Promise<void> => {
  const applicationObjectId = validateObjectId(applicationId, "applicationId");

  const application = await SellerApplication.findById(applicationObjectId);

  if (!application) {
    throw ApiError.notFound("Seller application not found.");
  }

  if (application.status === "APPROVED") {
    throw ApiError.badRequest(
      "Approved seller applications cannot be deleted.",
    );
  }

  await SellerApplication.deleteOne({
    _id: applicationObjectId,
  });
};
