import {
  Router,
  type Request,
  type Response,
  type RequestHandler,
  type NextFunction,
} from "express";
import { Admin } from "../admins/admin.model";
import { loadRolePermissions } from "../../middlewares/permission.middleware";
import { ownerOrAdminAuth } from "../../middlewares/ownerOrAdminAuth.middleware";
import { listWebhookEventsController } from "./webhook-admin.controller";

import {
  generalWebhookController,
  sslCommerzIpnController,
} from "./webhook.controller";

const router = Router();

const requireWebhookReadPermission: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  void (async () => {
    if (req.ownerAuth?.ownerId && req.ownerAuth.role?.trim().toUpperCase() === "OWNER") {
      next();
      return;
    }

    const admin = req.adminAuth;
    if (!admin?.adminId) {
      res.status(401).json({ success: false, message: "Administrative authentication is required." });
      return;
    }

    const record = await Admin.findById(admin.adminId).select("roleId status").exec();
    if (!record || String(record.get("status")).toUpperCase() !== "ACTIVE" || !record.roleId) {
      res.status(403).json({ success: false, message: "Active administrative role is required." });
      return;
    }

    const permissions = await loadRolePermissions(record.roleId.toString());
    req.permissions = Object.freeze([...permissions]);

    if (!permissions.includes("webhooks.read")) {
      res.status(403).json({ success: false, message: "Missing permission: webhooks.read.", code: "INSUFFICIENT_WEBHOOK_PERMISSION" });
      return;
    }

    next();
  })().catch(next);
};

/*
 * These are public provider callback endpoints.
 * Do not attach customer/admin authentication middleware here.
 *
 * SSLCommerz uses server-side validation of val_id.
 * Other providers must send HMAC-SHA256 in a supported signature header.
 */
router.get("/events", ownerOrAdminAuth, requireWebhookReadPermission, listWebhookEventsController);
router.post("/sslcommerz", sslCommerzIpnController);
router.post("/:provider", generalWebhookController);

export default router;
