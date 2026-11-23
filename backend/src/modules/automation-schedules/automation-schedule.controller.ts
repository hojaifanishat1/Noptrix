import type { NextFunction, Request, Response } from "express";
import * as service from "./automation-schedule.service";

function scheduleId(req: Request): string {
  const value = req.params.scheduleId;
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function actorId(req: Request): string {
  const id = (req as Request & { ownerAuth?: { userId?: string } }).ownerAuth?.userId;
  if (!id) throw new Error("Owner authentication is required.");
  return id;
}

function handle(
  action: (req: Request, res: Response) => Promise<unknown>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await action(req, res);
    } catch (error) {
      next(error);
    }
  };
}

export const createScheduleController = handle(async (req, res) => {
  const result = await service.createAutomationSchedule(req.body, actorId(req));
  res.status(201).json({ success: true, data: result });
});

export const listSchedulesController = handle(async (req, res) => {
  const result = await service.listAutomationSchedules(req.query);
  res.status(200).json({ success: true, data: result });
});

export const getScheduleController = handle(async (req, res) => {
  const result = await service.getAutomationSchedule(scheduleId(req));
  res.status(200).json({ success: true, data: result });
});

export const updateScheduleController = handle(async (req, res) => {
  const result = await service.updateAutomationSchedule(
    scheduleId(req),
    req.body,
    actorId(req),
  );
  res.status(200).json({ success: true, data: result });
});

export const pauseScheduleController = handle(async (req, res) => {
  const result = await service.setAutomationScheduleStatus(
    scheduleId(req),
    "PAUSED",
    actorId(req),
  );
  res.status(200).json({ success: true, data: result });
});

export const resumeScheduleController = handle(async (req, res) => {
  const result = await service.setAutomationScheduleStatus(
    scheduleId(req),
    "ACTIVE",
    actorId(req),
  );
  res.status(200).json({ success: true, data: result });
});

export const deleteScheduleController = handle(async (req, res) => {
  const result = await service.deleteAutomationSchedule(scheduleId(req));
  res.status(200).json({ success: true, data: result });
});
