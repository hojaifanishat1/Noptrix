import { Router } from "express";
import exportJobRoutes from "../export-jobs/export-job.routes";

import {
  ownerAuth,
  ownerSecretVerified,
} from "../../middlewares/ownerAuth.middleware";

import {
  systemOverviewController,
  apiHealthController,
  databaseHealthController,
  redisHealthController,
  queueOverviewController,
  workerOverviewController,
  emailHealthController,
  smsHealthController,
  pushHealthController,
  socketHealthController,
  systemErrorsController,
  systemDiagnosticsController,
  adminQueueJobsController,
  adminFailedJobsController,
  retryAdminFailedJobController,
} from "./system-monitoring.controller";

const router = Router();

router.use(ownerAuth, ownerSecretVerified);
router.use("/exports", exportJobRoutes);

router.get("/overview", systemOverviewController);
router.get("/api", apiHealthController);
router.get("/database", databaseHealthController);
router.get("/redis", redisHealthController);
router.get("/queues", queueOverviewController);
router.get("/queues/jobs", adminQueueJobsController);
router.get("/queues/failed-jobs", adminFailedJobsController);
router.post("/queues/:queue/jobs/:jobId/retry", retryAdminFailedJobController);
router.get("/workers", workerOverviewController);
router.get("/email", emailHealthController);
router.get("/sms", smsHealthController);
router.get("/push", pushHealthController);
router.get("/sockets", socketHealthController);
router.get("/errors", systemErrorsController);
router.get("/diagnostics", systemDiagnosticsController);

export default router;
