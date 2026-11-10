import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";

import { ApiError } from "../../utils/ApiError";

import { ApiResponse } from "../../utils/ApiResponse";

import { Admin } from "../admins/admin.model";

import { getAuthenticatedUserId } from "../../middlewares/userAuth.middleware";

import {
  getAuthenticatedAdminId,
  getAuthenticatedAdminRole,
} from "../../middlewares/adminAuth.middleware";

import {
  createJobApplication,
  getJobApplicationById,
  getMyJobApplications,
  getAllJobApplications,
  updateJobApplicationStatus,
  withdrawJobApplication,
  getRecruitmentReports,
  getVacancyApplicationSummary,
  requestRiderConversion,
} from "./application.service";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const getStringParam = (
  value: string | string[] | undefined,
  fieldName: string,
): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw ApiError.badRequest(`${fieldName} is required.`, {
      code: `${fieldName.replace(/\s+/g, "_").toUpperCase()}_REQUIRED`,
    });
  }

  return value.trim();
};

/*
|--------------------------------------------------------------------------
| Resolve Management Actor User ID
|--------------------------------------------------------------------------
*/

const getManagementActorUserId = async (req: Request): Promise<string> => {
  const role = getAuthenticatedAdminRole(req);

  /*
        |--------------------------------------------------------------------------
        | OWNER
        |--------------------------------------------------------------------------
        |
        | OWNER uses the administrative authentication pipeline on management
        | routes. For an OWNER token, adminAuth.adminId is the OWNER User ID.
        |
        |--------------------------------------------------------------------------
        */

  if (role === "OWNER") {
    return getAuthenticatedAdminId(req);
  }

  /*
        |--------------------------------------------------------------------------
        | ADMIN / STAFF
        |--------------------------------------------------------------------------
        |
        | Normal administrative accounts store their Admin document ID in
        | adminAuth.adminId. Resolve that Admin document to its User ID.
        |
        |--------------------------------------------------------------------------
        */

  const adminId = getAuthenticatedAdminId(req);

  const admin = await Admin.findById(adminId)
    .select("userId status")
    .lean()
    .exec();

  if (!admin) {
    throw ApiError.forbidden("Admin account not found.", {
      code: "ADMIN_ACCOUNT_NOT_FOUND",
    });
  }

  if (admin.status !== "ACTIVE") {
    throw ApiError.forbidden(
      "Inactive admins cannot manage job applications.",
      {
        code: "ADMIN_INACTIVE",
      },
    );
  }

  if (!admin.userId) {
    throw ApiError.internal("Admin user account is not configured.", {
      code: "ADMIN_USER_ACCOUNT_MISSING",
    });
  }

  return admin.userId.toString();
};

/*
|--------------------------------------------------------------------------
| Applicant Controllers
|--------------------------------------------------------------------------
*/

export const createJobApplicationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const applicantId = getAuthenticatedUserId(req);

    const application = await createJobApplication(applicantId, req.body);

    res
      .status(201)
      .json(
        ApiResponse.created(
          application,
          "Job application submitted successfully.",
        ).serialize(),
      );
  },
);

export const getMyJobApplicationsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const applicantId = getAuthenticatedUserId(req);

    const result = await getMyJobApplications(applicantId, req.query as never);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          result,
          "Applications retrieved successfully.",
        ).serialize(),
      );
  },
);

export const getMyJobApplicationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const applicantId = getAuthenticatedUserId(req);

    const applicationId = getStringParam(
      req.params.applicationId,
      "application ID",
    );

    const application = await getJobApplicationById(applicationId);

    if (application.applicantId.toString() !== applicantId) {
      throw ApiError.notFound("Job application not found.");
    }

    res
      .status(200)
      .json(
        ApiResponse.ok(
          application,
          "Application retrieved successfully.",
        ).serialize(),
      );
  },
);

export const withdrawJobApplicationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const applicantId = getAuthenticatedUserId(req);

    const applicationId = getStringParam(
      req.params.applicationId,
      "application ID",
    );

    const application = await withdrawJobApplication(
      applicationId,
      applicantId,
    );

    res
      .status(200)
      .json(
        ApiResponse.ok(
          application,
          "Job application withdrawn successfully.",
        ).serialize(),
      );
  },
);

/*
|--------------------------------------------------------------------------
| Management Controllers
|--------------------------------------------------------------------------
*/

export const getAllJobApplicationsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await getAllJobApplications(req.query as never);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          result,
          "Job applications retrieved successfully.",
        ).serialize(),
      );
  },
);

export const getJobApplicationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const applicationId = getStringParam(
      req.params.applicationId,
      "application ID",
    );

    const application = await getJobApplicationById(applicationId);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          application,
          "Job application retrieved successfully.",
        ).serialize(),
      );
  },
);

export const updateJobApplicationStatusController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const reviewerId = await getManagementActorUserId(req);

    const applicationId = getStringParam(
      req.params.applicationId,
      "application ID",
    );

    const application = await updateJobApplicationStatus(
      applicationId,
      reviewerId,
      req.body,
    );

    res
      .status(200)
      .json(
        ApiResponse.ok(
          application,
          "Job application status updated successfully.",
        ).serialize(),
      );
  },
);

export const requestRiderConversionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const requesterId = await getManagementActorUserId(req);

    const applicationId = getStringParam(
      req.params.applicationId,
      "application ID",
    );

    const application = await requestRiderConversion(
      applicationId,
      requesterId,
    );

    res
      .status(200)
      .json(
        ApiResponse.ok(
          application,
          "Rider conversion request submitted for owner approval.",
        ).serialize(),
      );
  },
);

export const getVacancyApplicationSummaryController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const vacancyId = getStringParam(req.params.vacancyId, "vacancy ID");

    const summary = await getVacancyApplicationSummary(vacancyId);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          summary,
          "Application summary retrieved successfully.",
        ).serialize(),
      );
  },
);

export const getRecruitmentReportsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const report = await getRecruitmentReports(req.query as never);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          report,
          "Recruitment report retrieved successfully.",
        ).serialize(),
      );
  },
);
