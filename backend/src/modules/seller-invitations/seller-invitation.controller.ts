import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import {
  acceptSellerInvitation,
  getSellerInvitationPreview,
  getAllSellerInvitations,
  revokeSellerInvitation,
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


/*
|--------------------------------------------------------------------------
| ADMIN: LIST SELLER INVITATIONS
|--------------------------------------------------------------------------
*/

export const getAllSellerInvitationsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await getAllSellerInvitations(
      req.query as never,
    );

    res.status(200).json(
      ApiResponse.ok(
        result,
        "Seller invitations retrieved successfully.",
      ).serialize(),
    );
  },
);

/*
|--------------------------------------------------------------------------
| ADMIN: REVOKE SELLER INVITATION
|--------------------------------------------------------------------------
*/

export const revokeSellerInvitationController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const invitationId = req.params.invitationId;

    if (typeof invitationId !== "string") {
      throw new Error("Invalid invitation ID.");
    }

    await revokeSellerInvitation(invitationId);

    res.status(200).json(
      ApiResponse.ok(
        null,
        "Seller invitation revoked successfully.",
      ).serialize(),
    );
  },
);
