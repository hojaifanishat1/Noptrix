import { Router, Request, Response, NextFunction } from "express";

import { adminAuth } from "../../middlewares/adminAuth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import {
  sendBroadcast,
  listBroadcastCampaigns,
  getBroadcastCampaignDetails,
} from "./broadcast.service";

const router = Router();


router.get(
  "/history",
  adminAuth,
  requirePermission("broadcast.read"),
  async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);

      if (
        !Number.isFinite(page) ||
        !Number.isFinite(limit) ||
        page < 1 ||
        limit < 1
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid pagination parameters.",
        });
        return;
      }

      const data = await listBroadcastCampaigns(page, limit);

      res.json({ success: true, data });
    } catch {
      res.status(500).json({
        success: false,
        message: "Unable to load broadcast history.",
      });
    }
  },
);

router.get(
  "/history/:broadcastId",
  adminAuth,
  requirePermission("broadcast.read"),
  async (req: Request, res: Response) => {
    try {
      const broadcastId = String(req.params.broadcastId);
      const data = await getBroadcastCampaignDetails(broadcastId);

      res.json({ success: true, data });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load campaign.";

      res.status(message.includes("not found") ? 404 : 500).json({
        success: false,
        message,
      });
    }
  },
);

router.post(
  "/",
  adminAuth,
  requirePermission("broadcast.send"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        title,
        message,
        audience,
        customerIds,
        priority,
      } = req.body ?? {};

      if (typeof title !== "string" || typeof message !== "string") {
        res.status(400).json({
          success: false,
          message: "Title and message are required.",
        });
        return;
      }

      if (
        audience !== "ALL_ACTIVE_CUSTOMERS" &&
        audience !== "SELECTED_CUSTOMERS"
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid broadcast audience.",
        });
        return;
      }

      if (
        audience === "SELECTED_CUSTOMERS" &&
        (!Array.isArray(customerIds) ||
          customerIds.some((id: unknown) => typeof id !== "string"))
      ) {
        res.status(400).json({
          success: false,
          message: "customerIds must be an array of customer IDs.",
        });
        return;
      }

      if (
        priority !== undefined &&
        !["low", "normal", "high", "critical"].includes(priority)
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid notification priority.",
        });
        return;
      }

      const authUser = (req as Request & {
        user?: { _id?: unknown; id?: unknown; userId?: unknown };
        admin?: { _id?: unknown; id?: unknown };
      });

      const adminId =
        authUser.admin?._id ??
        authUser.admin?.id ??
        authUser.user?._id ??
        authUser.user?.id ??
        authUser.user?.userId;

      const result = await sendBroadcast({
        title,
        message,
        audience,
        customerIds,
        priority,
        adminId: adminId ? String(adminId) : undefined,
      });

      res.status(202).json({
        success: true,
        message: "Broadcast processing completed; queued counts are reported below.",
        data: result,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to send broadcast.";

      const clientError =
        /required|exceed|maximum|invalid|select|not exist|not active/i.test(message);

      res.status(clientError ? 400 : 500).json({
        success: false,
        message,
      });
    }
  },
);

export default router;
