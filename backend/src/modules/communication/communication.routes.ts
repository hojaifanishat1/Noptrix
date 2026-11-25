import { Router } from "express";

import messageRoutes from "./messages/message.routes";
import riderMessageRoutes from "./messages/rider-message.routes";
import announcementRoutes from "./announcements/announcement.routes";
import broadcastRoutes from "./broadcast.routes";

const router = Router();

/*
|--------------------------------------------------------------------------
| Communication Routes
|--------------------------------------------------------------------------
|
| Internal administrative communication:
|
| - Messages
| - Announcements
|
|--------------------------------------------------------------------------
*/

// Rider-authenticated messaging endpoints must be registered before
// the administrative message router.
router.use("/messages/rider", riderMessageRoutes);
router.use("/messages", messageRoutes);

router.use("/announcements", announcementRoutes);

router.use("/broadcast", broadcastRoutes);

export default router;
