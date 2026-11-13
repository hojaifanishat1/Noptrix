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
        "Seller account created. Your account is pending Owner verification.",
      ).serialize(),
    );
  },
);

export const getSellerInvitationPreviewController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await getSellerInvitationPreview(req.params.token);

    res.status(200).json(
      ApiResponse.ok(
        result,
        "Seller invitation details retrieved successfully.",
      ).serialize(),
    );
  },
);
