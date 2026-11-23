import { Router } from "express";
import {
  ownerAuth,
  ownerSecretVerified,
} from "../../middlewares/ownerAuth.middleware";
import {
  exportDatasetCatalogController,
  createExportJobController,
  getExportJobsController,
  getExportDownloadController,
  retryExportJobController,
} from "./export-job.controller";

const router = Router();

router.use(ownerAuth, ownerSecretVerified);

router.get("/datasets", exportDatasetCatalogController);
router.get("/", getExportJobsController);
router.post("/", createExportJobController);
router.get("/:jobId/download", getExportDownloadController);
router.post("/:jobId/retry", retryExportJobController);

export default router;
