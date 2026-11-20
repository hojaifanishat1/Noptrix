import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import {
  acceptSellerInvitation,
  getSellerInvitationPreview,
} from "./seller-invitation.service";

export const acceptSellerInvitationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await acceptSellerInvitation(req.body);

    res.status(201).json(
      ApiResponse.created(
        result,
        "Seller account activated. Complete your onboarding to start selling.",
      ).serialize(),
    );
  },
);

export const getSellerInvitationPreviewController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const token = Array.isArray(req.params.token)
      ? req.params.token[0]
      : req.params.token;

    const result = await getSellerInvitationPreview(token);

    res.status(200).json(
      ApiResponse.ok(
        result,
        "Seller invitation details retrieved successfully.",
      ).serialize(),
    );
  },
);
