import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ApiResponse } from "../../utils/ApiResponse";
import {
  getAuthenticatedAdminId,
  getAuthenticatedAdminRole,
} from "../../middlewares/adminAuth.middleware";
import { Admin } from "../admins/admin.model";
import {
  acceptRiderInvitation,
  createRiderInvitation,
  getRiderInvitationByToken,
  listRiderInvitations,
  revokeRiderInvitation,
} from "./rider-invitation.service";

const getActorUserId = async (req: Request) => {
  const adminId = getAuthenticatedAdminId(req);
  if (getAuthenticatedAdminRole(req) === "OWNER") return adminId;

  const admin = await Admin.findById(adminId).select("userId status").lean().exec();
  if (!admin || admin.status !== "ACTIVE" || !admin.userId) {
    throw ApiError.forbidden("Active admin account not found.");
  }
  return admin.userId.toString();
};

const getParam = (value: string | string[] | undefined, fieldName: string) => {
  if (typeof value !== "string" || !value.trim()) {
    throw ApiError.badRequest(`${fieldName} is required.`);
  }
  return value.trim();
};

export const createRiderInvitationController = asyncHandler(
  async (req: Request, res: Response) => {
    const invitedBy = await getActorUserId(req);
    const invitation = await createRiderInvitation(invitedBy, req.body);
    res
      .status(201)
      .json(
        ApiResponse.created(
          invitation,
          "Rider invitation sent successfully.",
        ).serialize(),
      );
  },
);

export const getRiderInvitationByTokenController = asyncHandler(
  async (req: Request, res: Response) => {
    const token = getParam(req.query.token as string | undefined, "Token");
    const invitation = await getRiderInvitationByToken(token);
    res
      .status(200)
      .json(ApiResponse.ok(invitation, "Rider invitation is valid.").serialize());
  },
);

export const acceptRiderInvitationController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await acceptRiderInvitation(req.body);
    res
      .status(201)
      .json(ApiResponse.created(result, "Rider invitation accepted.").serialize());
  },
);

export const listRiderInvitationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listRiderInvitations(req.query as never);
    res
      .status(200)
      .json(ApiResponse.ok(result, "Rider invitations retrieved.").serialize());
  },
);

export const revokeRiderInvitationController = asyncHandler(
  async (req: Request, res: Response) => {
    const revokedBy = await getActorUserId(req);
    const invitationId = getParam(req.params.invitationId, "Invitation ID");
    const result = await revokeRiderInvitation(invitationId, revokedBy);
    res
      .status(200)
      .json(ApiResponse.ok(result, "Rider invitation revoked.").serialize());
  },
);
