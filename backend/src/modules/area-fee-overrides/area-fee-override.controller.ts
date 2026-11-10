import type { Request, Response, NextFunction } from "express";
import {
  createAreaFeeOverrideSchema, updateAreaFeeOverrideSchema,
  areaFeeOverrideIdSchema, listAreaFeeOverridesSchema,
} from "./area-fee-override.validator";
import { AreaFeeOverrideService } from "./area-fee-override.service";

function fail(error: any, res: Response, next: NextFunction) {
  if (typeof error?.statusCode === "number") {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  return next(error);
}

export class AreaFeeOverrideController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createAreaFeeOverrideSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({
        success: false, message: "Validation failed.", errors: parsed.error.flatten(),
      });
      const data = await AreaFeeOverrideService.create(parsed.data);
      return res.status(201).json({ success: true, message: "Area fee override created.", data });
    } catch (error) { return fail(error, res, next); }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = listAreaFeeOverridesSchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({
        success: false, message: "Invalid query parameters.", errors: parsed.error.flatten(),
      });
      const result = await AreaFeeOverrideService.list(parsed.data);
      return res.status(200).json({
        success: true, data: result.items, pagination: result.pagination,
      });
    } catch (error) { return fail(error, res, next); }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const params = areaFeeOverrideIdSchema.safeParse(req.params);
      if (!params.success) return res.status(400).json({ success: false, message: "Invalid ID." });
      const data = await AreaFeeOverrideService.getById(params.data.id);
      return res.status(200).json({ success: true, data });
    } catch (error) { return fail(error, res, next); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const params = areaFeeOverrideIdSchema.safeParse(req.params);
      const body = updateAreaFeeOverrideSchema.safeParse(req.body);
      if (!params.success || !body.success) return res.status(400).json({
        success: false, message: "Invalid override update.",
        errors: !params.success ? params.error.flatten() : body.success ? undefined : body.error.flatten(),
      });
      const data = await AreaFeeOverrideService.update(params.data.id, body.data);
      return res.status(200).json({ success: true, message: "Area fee override updated.", data });
    } catch (error) { return fail(error, res, next); }
  }

  static async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const params = areaFeeOverrideIdSchema.safeParse(req.params);
      const status = req.body?.status;
      if (!params.success || !["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid ID or status." });
      }
      const data = await AreaFeeOverrideService.setStatus(params.data.id, status);
      return res.status(200).json({ success: true, message: "Status updated.", data });
    } catch (error) { return fail(error, res, next); }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const params = areaFeeOverrideIdSchema.safeParse(req.params);
      if (!params.success) return res.status(400).json({ success: false, message: "Invalid ID." });
      const data = await AreaFeeOverrideService.remove(params.data.id);
      return res.status(200).json({ success: true, message: "Area fee override deleted.", data });
    } catch (error) { return fail(error, res, next); }
  }
}
