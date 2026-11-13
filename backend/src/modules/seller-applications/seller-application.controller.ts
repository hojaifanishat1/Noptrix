import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";

import { ApiResponse } from "../../utils/ApiResponse";

import { ApiError } from "../../utils/ApiError";

import { getAuthenticatedUserId } from "../../middlewares/userAuth.middleware";

import {
  getAuthenticatedOwnerId,
  getAuthenticatedOwnerUserId,
} from "../../middlewares/ownerAuth.middleware";

import {
  CreateSellerApplicationInput,
  UpdateSellerApplicationInput,
  UpdateSellerApplicationStatusInput,
  SellerApplicationQueryInput,
} from "./seller-application.validator";

import {
  createSellerApplication,
  getSellerApplicationById,
  getMySellerApplications,
  getAllSellerApplications,
  updateMySellerApplication,
  updateSellerApplicationStatus,
  withdrawSellerApplication,
  deleteSellerApplication,
  resendSellerApplicationInvitation,
} from "./seller-application.service";

/*
|--------------------------------------------------------------------------
| USER
|--------------------------------------------------------------------------
*/

/**
 * Create seller application
 */
export const createSellerApplicationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = getAuthenticatedUserId(req);

    const input = req.body as CreateSellerApplicationInput;

    const application = await createSellerApplication(userId, input);

    res
      .status(201)
      .json(
        ApiResponse.created(
          application,
          "Seller application submitted successfully.",
        ).serialize(),
      );
  },
);

/**
 * Get my applications
 */
export const getMySellerApplicationsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = getAuthenticatedUserId(req);

    const query = req.query as never as SellerApplicationQueryInput;

    const result = await getMySellerApplications(userId, query);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          result,
          "Seller applications retrieved successfully.",
        ).serialize(),
      );
  },
);

/**
 * Get my single application
 */
export const getMySellerApplicationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = getAuthenticatedUserId(req);

    const applicationId = req.params.applicationId;

    if (typeof applicationId !== "string") {
      throw ApiError.badRequest("Invalid application ID.");
    }

    const application = await getSellerApplicationById(applicationId);

    if (application.applicantId.toString() !== userId) {
      throw ApiError.forbidden(
        "You are not allowed to access this seller application.",
      );
    }

    res
      .status(200)
      .json(
        ApiResponse.ok(
          application,
          "Seller application retrieved successfully.",
        ).serialize(),
      );
  },
);

/**
 * Update my application
 */
export const updateMySellerApplicationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = getAuthenticatedUserId(req);

    const applicationId = req.params.applicationId;

    if (typeof applicationId !== "string") {
      throw ApiError.badRequest("Invalid application ID.");
    }

    const input = req.body as UpdateSellerApplicationInput;

    const application = await updateMySellerApplication(
      applicationId,
      userId,
      input,
    );

    res
      .status(200)
      .json(
        ApiResponse.ok(
          application,
          "Seller application updated successfully.",
        ).serialize(),
      );
  },
);

/**
 * Withdraw my application
 */
export const withdrawSellerApplicationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = getAuthenticatedUserId(req);

    const applicationId = req.params.applicationId;

    if (typeof applicationId !== "string") {
      throw ApiError.badRequest("Invalid application ID.");
    }

    const application = await withdrawSellerApplication(applicationId, userId);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          application,
          "Seller application withdrawn successfully.",
        ).serialize(),
      );
  },
);

/*
|--------------------------------------------------------------------------
| OWNER
|--------------------------------------------------------------------------
*/

/**
 * Get all seller applications
 */
export const getAllSellerApplicationsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);

    const query = req.query as never as SellerApplicationQueryInput;

    const result = await getAllSellerApplications(query);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          result,
          "Seller applications retrieved successfully.",
        ).serialize(),
      );
  },
);

/**
 * Get any application
 */
export const getSellerApplicationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);

    const applicationId = req.params.applicationId;

    if (typeof applicationId !== "string") {
      throw ApiError.badRequest("Invalid application ID.");
    }

    const application = await getSellerApplicationById(applicationId);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          application,
          "Seller application retrieved successfully.",
        ).serialize(),
      );
  },
);

/**
 * Update application status
 */
export const updateSellerApplicationStatusController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);
    const reviewerUserId = getAuthenticatedOwnerUserId(req);

    const applicationId = req.params.applicationId;

    if (typeof applicationId !== "string") {
      throw ApiError.badRequest("Invalid application ID.");
    }

    const input = req.body as UpdateSellerApplicationStatusInput;

    const application = await updateSellerApplicationStatus(
      applicationId,
      reviewerUserId,
      input,
    );

    res
      .status(200)
      .json(
        ApiResponse.ok(
          application,
          "Seller application status updated successfully.",
        ).serialize(),
      );
  },
);

/**
 * Delete application
 */
export const deleteSellerApplicationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);

    const applicationId = req.params.applicationId;

    if (typeof applicationId !== "string") {
      throw ApiError.badRequest("Invalid application ID.");
    }

    await deleteSellerApplication(applicationId);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          null,
          "Seller application deleted successfully.",
        ).serialize(),
      );
  },
);


/*
|--------------------------------------------------------------------------
| Resend Seller Invitation
|--------------------------------------------------------------------------
*/

export const resendSellerApplicationInvitationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);
    const reviewerUserId = getAuthenticatedOwnerUserId(req);

    const applicationId = req.params.applicationId;

    if (typeof applicationId !== "string") {
      throw ApiError.badRequest("Invalid application ID.");
    }

    const result = await resendSellerApplicationInvitation(
      applicationId,
      reviewerUserId,
    );

    res.status(200).json(
      ApiResponse.ok(
        result,
        "Seller invitation sent successfully.",
      ).serialize(),
    );
  },
);
