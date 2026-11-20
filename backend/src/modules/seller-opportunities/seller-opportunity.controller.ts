import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

import {
  CreateSellerOpportunityInput,
  UpdateSellerOpportunityInput,
  SellerOpportunityQueryInput,
  UpdateSellerOpportunityStatusInput,
} from "./seller-opportunity.validator";

import {
  createSellerOpportunity,
  getSellerOpportunityById,
  getSellerOpportunityBySlug,
  getSellerOpportunities,
  getPublicSellerOpportunities,
  updateSellerOpportunity,
  updateSellerOpportunityStatus,
  publishSellerOpportunity,
  pauseSellerOpportunity,
  closeSellerOpportunity,
  deleteSellerOpportunity,
} from "./seller-opportunity.service";

const getParam = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw ApiError.badRequest(`Invalid ${label}.`);
  }
  return value;
};

const getAdministrativeUserId = (req: Request): string => {
  const ownerUserId = req.ownerAuth?.userId;

  if (typeof ownerUserId === "string" && ownerUserId) {
    return ownerUserId;
  }

  const adminUserId = req.adminAuth?.claims?.userId;

  if (typeof adminUserId === "string" && adminUserId) {
    return adminUserId;
  }

  throw ApiError.unauthorized(
    "Administrative user identity could not be resolved.",
  );
};

export const createSellerOpportunityController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const opportunity = await createSellerOpportunity(
      getAdministrativeUserId(req),
      req.body as CreateSellerOpportunityInput,
    );

    res.status(201).json(
      ApiResponse.created(
        opportunity,
        "Seller opportunity created successfully.",
      ).serialize(),
    );
  },
);

export const getSellerOpportunityController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const opportunity = await getSellerOpportunityById(
      getParam(req.params.opportunityId, "opportunity ID"),
    );

    res.status(200).json(
      ApiResponse.ok(
        opportunity,
        "Seller opportunity retrieved successfully.",
      ).serialize(),
    );
  },
);

export const getSellerOpportunityBySlugController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const opportunity = await getSellerOpportunityBySlug(
      getParam(req.params.slug, "opportunity slug"),
    );

    res.status(200).json(
      ApiResponse.ok(
        opportunity,
        "Seller opportunity retrieved successfully.",
      ).serialize(),
    );
  },
);

export const getSellerOpportunitiesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await getSellerOpportunities(
      req.query as never as SellerOpportunityQueryInput,
    );

    res.status(200).json(
      ApiResponse.ok(
        result,
        "Seller opportunities retrieved successfully.",
      ).serialize(),
    );
  },
);

export const getPublicSellerOpportunitiesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await getPublicSellerOpportunities(
      req.query as never as SellerOpportunityQueryInput,
    );

    res.status(200).json(
      ApiResponse.ok(
        result,
        "Available seller opportunities retrieved successfully.",
      ).serialize(),
    );
  },
);

export const updateSellerOpportunityController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const opportunity = await updateSellerOpportunity(
      getParam(req.params.opportunityId, "opportunity ID"),
      getAdministrativeUserId(req),
      req.body as UpdateSellerOpportunityInput,
    );

    res.status(200).json(
      ApiResponse.ok(
        opportunity,
        "Seller opportunity updated successfully.",
      ).serialize(),
    );
  },
);

export const updateSellerOpportunityStatusController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const opportunity = await updateSellerOpportunityStatus(
      getParam(req.params.opportunityId, "opportunity ID"),
      getAdministrativeUserId(req),
      req.body as UpdateSellerOpportunityStatusInput,
    );

    res.status(200).json(
      ApiResponse.ok(
        opportunity,
        "Seller opportunity status updated successfully.",
      ).serialize(),
    );
  },
);

export const publishSellerOpportunityController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const opportunity = await publishSellerOpportunity(
      getParam(req.params.opportunityId, "opportunity ID"),
      getAdministrativeUserId(req),
    );

    res.status(200).json(
      ApiResponse.ok(
        opportunity,
        "Seller opportunity published successfully.",
      ).serialize(),
    );
  },
);

export const pauseSellerOpportunityController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const opportunity = await pauseSellerOpportunity(
      getParam(req.params.opportunityId, "opportunity ID"),
      getAdministrativeUserId(req),
    );

    res.status(200).json(
      ApiResponse.ok(
        opportunity,
        "Seller opportunity paused successfully.",
      ).serialize(),
    );
  },
);

export const closeSellerOpportunityController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const opportunity = await closeSellerOpportunity(
      getParam(req.params.opportunityId, "opportunity ID"),
      getAdministrativeUserId(req),
    );

    res.status(200).json(
      ApiResponse.ok(
        opportunity,
        "Seller opportunity closed successfully.",
      ).serialize(),
    );
  },
);

export const deleteSellerOpportunityController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await deleteSellerOpportunity(
      getParam(req.params.opportunityId, "opportunity ID"),
      getAdministrativeUserId(req),
    );

    res.status(200).json(
      ApiResponse.ok(
        result,
        "Seller opportunity deleted successfully.",
      ).serialize(),
    );
  },
);
