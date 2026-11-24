import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import {
  generateRiderPayouts,
  listRiderPayouts,
  updateRiderPayoutStatus,
} from "./riderPayout.service";
import type {
  GenerateRiderPayoutInput,
  RiderPayoutQueryInput,
  UpdateRiderPayoutStatusInput,
} from "./riderPayout.validator";

const getActorId = (req: Request): string => {
  const ownerId =
    (req as any).ownerAuth?.ownerId ??
    (req as any).ownerAuth?.userId;

  const adminId =
    (req as any).adminAuth?.adminId ??
    (req as any).adminAuth?.claims?.userId;

  const actorId = ownerId ?? adminId;

  if (!actorId) {
    throw new Error("Authenticated user ID not found.");
  }

  return String(actorId);
};

export const listRiderPayoutsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as RiderPayoutQueryInput;
    const result = await listRiderPayouts(query);

    res.status(200).json(
      ApiResponse.ok(result, "Rider payouts retrieved successfully."),
    );
  },
);

export const generateRiderPayoutsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = req.body as GenerateRiderPayoutInput;
    const result = await generateRiderPayouts(input);

    res.status(200).json(
      ApiResponse.ok(result, "Rider payouts generated successfully."),
    );
  },
);

export const updateRiderPayoutStatusController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const payoutId = String(req.params.payoutId ?? "");
    const input = req.body as UpdateRiderPayoutStatusInput;

    const result = await updateRiderPayoutStatus(
      payoutId,
      input,
      getActorId(req),
    );

    res.status(200).json(
      ApiResponse.ok(result, "Rider payout updated successfully."),
    );
  },
);
