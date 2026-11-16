import { Router } from "express";
import {
  adminAuth,
  adminSecretVerified,
} from "../../middlewares/adminAuth.middleware";
import { requirePermissionMatch } from "../../middlewares/permission.middleware";
import { validate } from "../../middlewares/validation.middleware";
import {
  acceptRiderInvitationController,
  getRiderInvitationByTokenController,
  listRiderInvitationsController,
  revokeRiderInvitationController,
} from "./rider-invitation.controller";
import {
  acceptRiderInvitationSchema,
  riderInvitationIdParamSchema,
  riderInvitationQuerySchema,
  riderInvitationTokenSchema,
} from "./rider-invitation.validator";

const router = Router();
const managementAuth = [adminAuth, adminSecretVerified];

router.get(
  "/validate",
  validate(riderInvitationTokenSchema, "query"),
  getRiderInvitationByTokenController,
);

router.post(
  "/accept",
  validate(acceptRiderInvitationSchema, "body"),
  acceptRiderInvitationController,
);

router.get(
  "/",
  ...managementAuth,
  requirePermissionMatch("rider_invitations.read", "rider_invitations.manage"),
  validate(riderInvitationQuerySchema, "query"),
  listRiderInvitationsController,
);

router.post(
  "/:invitationId/revoke",
  ...managementAuth,
  requirePermissionMatch("rider_invitations.revoke", "rider_invitations.manage"),
  validate(riderInvitationIdParamSchema, "params"),
  revokeRiderInvitationController,
);

export default router;
