import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import {
  generateSellerPayouts,
  listSellerPayouts,
  updateSellerPayoutStatus,
} from "./sellerPayout.service";
import type {
  SellerPayoutQuery,
  UpdateSellerPayoutStatusInput,
} from "./sellerPayout.validator";

const getActorId = (req: Request): string => {
  const request = req as Request & {
    ownerAuth?: { ownerId?: string; userId?: string };
    adminAuth?: { adminId?: string; claims?: { userId?: string } };
  };

  const actorId =
    request.ownerAuth?.ownerId ??
    request.ownerAuth?.userId ??
    request.adminAuth?.adminId ??
    request.adminAuth?.claims?.userId;

  if (!actorId) {
    throw new Error("Authenticated administrative user ID is missing.");
  }

  return actorId;
};

export const listSellerPayoutsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await listSellerPayouts(
      req.query as unknown as SellerPayoutQuery,
    );

    res.status(200).json(
      ApiResponse.ok(result, "Seller payouts retrieved successfully."),
    );
  },
);

export const generateSellerPayoutsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await generateSellerPayouts(
      (req.body as { sellerId?: string }).sellerId,
    );

    res.status(200).json(
      ApiResponse.ok(result, "Seller payout generation completed."),
    );
  },
);

export const updateSellerPayoutStatusController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { payoutId } = req.params as { payoutId: string };

    const result = await updateSellerPayoutStatus(
      payoutId,
      getActorId(req),
      req.body as UpdateSellerPayoutStatusInput,
    );

    res.status(200).json(
      ApiResponse.ok(result, "Seller payout status updated successfully."),
    );
  },
);
