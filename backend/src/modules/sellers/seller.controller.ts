import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";

import { ApiResponse } from "../../utils/ApiResponse";

import { ApiError } from "../../utils/ApiError";

import { getAuthenticatedOwnerId } from "../../middlewares/ownerAuth.middleware";

import { getAuthenticatedSellerId } from "../../middlewares/sellerAuth.middleware";

import {
  createSeller,
  getSellerById,
  getAllSellers,
  updateSeller,
  updateSellerStatus,
  deleteSeller,
} from "./seller.service";

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

const getStringParam = (
  value: string | string[] | undefined,
  fieldName: string,
): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw ApiError.badRequest(`Invalid ${fieldName}.`);
  }

  return value;
};

/*
|--------------------------------------------------------------------------
| OWNER MANAGEMENT
|--------------------------------------------------------------------------
*/

/**
 * Create seller
 *
 * POST /sellers
 */
export const createSellerController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const ownerId = getAuthenticatedOwnerId(req);

    const seller = await createSeller(req.body as CreateSellerInput, ownerId);

    res
      .status(201)
      .json(
        ApiResponse.created(seller, "Seller created successfully.").serialize(),
      );
  },
);

/**
 * Get all sellers
 *
 * GET /sellers
 */
export const getAllSellersController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);

    const result = await getAllSellers(req.query as never as SellerQueryInput);

    res
      .status(200)
      .json(
        ApiResponse.ok(result, "Sellers retrieved successfully.").serialize(),
      );
  },
);

/**
 * Get seller by ID
 *
 * GET /sellers/:sellerId
 */
export const getSellerController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);

    const sellerId = getStringParam(req.params.sellerId, "sellerId");

    const seller = await getSellerById(sellerId);

    res
      .status(200)
      .json(
        ApiResponse.ok(seller, "Seller retrieved successfully.").serialize(),
      );
  },
);

/**
 * Update seller
 *
 * PATCH /sellers/:sellerId
 */
export const updateSellerController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const ownerId = getAuthenticatedOwnerId(req);

    const sellerId = getStringParam(req.params.sellerId, "sellerId");

    const seller = await updateSeller(
      sellerId,
      req.body as UpdateSellerInput,
      ownerId,
    );

    res
      .status(200)
      .json(ApiResponse.ok(seller, "Seller updated successfully.").serialize());
  },
);

/**
 * Update seller status
 *
 * PATCH /sellers/:sellerId/status
 */
export const updateSellerStatusController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const ownerId = getAuthenticatedOwnerId(req);

    const sellerId = getStringParam(req.params.sellerId, "sellerId");

    const seller = await updateSellerStatus(
      sellerId,
      ownerId,
      req.body as UpdateSellerStatusInput,
    );

    res
      .status(200)
      .json(
        ApiResponse.ok(
          seller,
          "Seller status updated successfully.",
        ).serialize(),
      );
  },
);

/**
 * Delete seller
 *
 * DELETE /sellers/:sellerId
 */
export const deleteSellerController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    getAuthenticatedOwnerId(req);

    const sellerId = getStringParam(req.params.sellerId, "sellerId");

    const result = await deleteSeller(sellerId);

    res
      .status(200)
      .json(ApiResponse.ok(result, "Seller deleted successfully.").serialize());
  },
);

/*
|--------------------------------------------------------------------------
| SELLER SELF-SERVICE
|--------------------------------------------------------------------------
*/

/**
 * Get my seller profile
 *
 * GET /sellers/me
 */
export const getMySellerController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const sellerId = getAuthenticatedSellerId(req);

    const seller = await getSellerById(sellerId);

    res
      .status(200)
      .json(
        ApiResponse.ok(
          seller,
          "Seller profile retrieved successfully.",
        ).serialize(),
      );
  },
);
