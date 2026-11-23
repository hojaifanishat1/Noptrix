import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import {
  ownerAuth,
  ownerSecretVerified,
} from "../../middlewares/ownerAuth.middleware";

import { AuditLog } from "../audit-logs/audit-log.model";
import { Session, SESSION_STATUSES } from "../sessions/session.model";
import { User } from "../users/user.model";
import { Owner } from "../owners/owner.model";

const router = Router();

const PAGE_SIZE_MAX = 100;

const SECURITY_VIEWS = [
  "login-history",
  "events",
  "suspicious",
  "permissions",
  "admin-activity",
  "audit-logs",
  "alerts",
] as const;

type SecurityView = (typeof SECURITY_VIEWS)[number];

function positiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function requireValidView(value: unknown): SecurityView {
  if (
    typeof value !== "string" ||
    !SECURITY_VIEWS.includes(value as SecurityView)
  ) {
    throw ApiError.badRequest("Invalid Security Center view.", {
      code: "INVALID_SECURITY_VIEW",
    });
  }

  return value as SecurityView;
}

function viewFilter(view: SecurityView): Record<string, unknown> {
  switch (view) {
    case "login-history":
      return {
        action: { $in: ["LOGIN", "LOGIN_FAILED", "LOGOUT"] },
      };

    case "events":
      return {
        action: {
          $in: [
            "SECURITY_EVENT",
            "PASSWORD_CHANGED",
            "PASSWORD_RESET",
            "LOGIN_FAILED",
          ],
        },
      };

    case "suspicious":
      return {
        action: "LOGIN_FAILED",
        success: false,
      };

    case "permissions":
      return { action: "PERMISSION_CHANGED" };

    case "admin-activity":
      return {
        actorType: { $in: ["OWNER", "ADMIN", "EMPLOYEE"] },
      };

    case "alerts":
      return {
        $or: [
          { action: "SECURITY_EVENT" },
          { action: "LOGIN_FAILED", success: false },
        ],
      };

    case "audit-logs":
      return {};
  }
}

/*
 * All endpoints in this router require:
 * 1. Valid Owner access token
 * 2. Verified Owner secret
 *
 * This router is intentionally independent from the existing
 * customer/admin session and audit-log routes.
 */
router.use(ownerAuth, ownerSecretVerified);

/* GET /security-center/overview */
router.get(
  "/overview",
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      activeSessions,
      failedLogins24h,
      securityEvents24h,
      permissionChanges24h,
      totalAuditLogs,
    ] = await Promise.all([
      Session.countDocuments({
        status: SESSION_STATUSES.ACTIVE,
        expiresAt: { $gt: now },
      }),
      AuditLog.countDocuments({
        action: "LOGIN_FAILED",
        success: false,
        createdAt: { $gte: last24Hours },
      }),
      AuditLog.countDocuments({
        action: "SECURITY_EVENT",
        createdAt: { $gte: last24Hours },
      }),
      AuditLog.countDocuments({
        action: "PERMISSION_CHANGED",
        createdAt: { $gte: last24Hours },
      }),
      AuditLog.countDocuments({}),
    ]);

    res.status(200).json({
      success: true,
      data: {
        activeSessions,
        failedLogins24h,
        securityEvents24h,
        permissionChanges24h,
        totalAuditLogs,
        generatedAt: now,
      },
    });
  }),
);

/* GET /security-center/sessions */
router.get(
  "/sessions",
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();

    const sessions = await Session.find({
      status: SESSION_STATUSES.ACTIVE,
      expiresAt: { $gt: now },
    })
      .select(
        "_id userId status secretVerified userAgent ipAddress deviceId lastUsedAt expiresAt createdAt",
      )
      .populate({
        path: "userId",
        select: "name email phone status",
      })
      .sort({ lastUsedAt: -1, createdAt: -1 })
      .limit(200)
      .exec();

    const userIds = sessions
      .map((session) => {
        const user = session.userId as unknown as { _id?: Types.ObjectId };
        return user?._id;
      })
      .filter((id): id is Types.ObjectId => Boolean(id));

    const owners = userIds.length
      ? await Owner.find({ userId: { $in: userIds } })
          .select("userId")
          .lean()
          .exec()
      : [];

    const ownerIds = new Set(owners.map((owner) => String(owner.userId)));

    const items = sessions.map((session) => {
      const user = session.userId as unknown as {
        _id?: Types.ObjectId;
        name?: string;
        email?: string;
        phone?: string;
        status?: string;
      };

      const userId = user?._id ? String(user._id) : "";

      return {
        sessionId: String(session._id),
        userId,
        name: user?.name ?? "Unknown user",
        email: user?.email ?? null,
        phone: user?.phone ?? null,
        userStatus: user?.status ?? null,
        accountType: ownerIds.has(userId) ? "OWNER" : "USER",
        status: session.status,
        secretVerified: session.secretVerified,
        userAgent: session.userAgent ?? null,
        ipAddress: session.ipAddress ?? null,
        deviceId: session.deviceId ?? null,
        lastUsedAt: session.lastUsedAt ?? null,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      data: { items, total: items.length },
    });
  }),
);

/* DELETE /security-center/sessions/:sessionId */
router.delete(
  "/sessions/:sessionId",
  asyncHandler(async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId;

    if (
      typeof sessionId !== "string" ||
      !Types.ObjectId.isValid(sessionId)
    ) {
      throw ApiError.badRequest("Invalid session ID.", {
        code: "INVALID_SESSION_ID",
      });
    }

    if (sessionId === req.ownerAuth?.sessionId) {
      throw ApiError.badRequest(
        "You cannot revoke the session currently being used.",
        { code: "CANNOT_REVOKE_CURRENT_SESSION" },
      );
    }

    const session = await Session.findOneAndUpdate(
      {
        _id: new Types.ObjectId(sessionId),
        status: SESSION_STATUSES.ACTIVE,
      },
      {
        $set: {
          status: SESSION_STATUSES.REVOKED,
          revokedAt: new Date(),
        },
      },
      { new: true },
    ).exec();

    if (!session) {
      throw ApiError.notFound("Active session not found.", {
        code: "SESSION_NOT_FOUND",
      });
    }

    res.status(200).json({
      success: true,
      message: "Session revoked successfully.",
      data: { sessionId },
    });
  }),
);

/* GET /security-center/records?view=... */
router.get(
  "/records",
  asyncHandler(async (req: Request, res: Response) => {
    const view = requireValidView(req.query.view);
    const page = positiveInteger(req.query.page, 1, 1000000);
    const limit = positiveInteger(req.query.limit, 20, PAGE_SIZE_MAX);

    const filter = viewFilter(view);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      AuditLog.countDocuments(filter).exec(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + items.length < total,
          hasPreviousPage: page > 1,
        },
        view,
        source: "audit-logs",
      },
    });
  }),
);

export default router;
