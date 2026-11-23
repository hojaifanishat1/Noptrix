import { Router } from "express";
import {
  createScheduleController,
  listSchedulesController,
  getScheduleController,
  updateScheduleController,
  pauseScheduleController,
  resumeScheduleController,
  deleteScheduleController,
} from "./automation-schedule.controller";
import { ownerAuth, ownerSecretVerified } from "../../middlewares/ownerAuth.middleware";

const router = Router();

router.use(ownerAuth, ownerSecretVerified);

router.get("/", listSchedulesController);
router.post("/", createScheduleController);
router.get("/:scheduleId", getScheduleController);
router.patch("/:scheduleId", updateScheduleController);
router.patch("/:scheduleId/pause", pauseScheduleController);
router.patch("/:scheduleId/resume", resumeScheduleController);
router.delete("/:scheduleId", deleteScheduleController);

export default router;
