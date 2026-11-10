import type { Request, Response, NextFunction } from "express";
import {
  createDeliveryAreaSchema, updateDeliveryAreaSchema,
  deliveryAreaIdSchema, listDeliveryAreasSchema,
} from "./delivery-area.validator";
import { DeliveryAreaService } from "./delivery-area.service";

function respondError(error: any, res: Response, next: NextFunction) {
  if (typeof error?.statusCode === "number") {
    return res.status(error.statusCode).json({
      success: false, message: error.message,
    });
  }
  return next(error);
}

export class DeliveryAreaController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createDeliveryAreaSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({
        success: false, message: "Validation failed.",
        errors: parsed.error.flatten(),
      });
      const data = await DeliveryAreaService.create(parsed.data);
      return res.status(201).json({
        success: true, message: "Delivery area created successfully.", data,
      });
    } catch (error) { return respondError(error, res, next); }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = listDeliveryAreasSchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({
        success: false, message: "Invalid query parameters.",
        errors: parsed.error.flatten(),
      });
      const result = await DeliveryAreaService.list(parsed.data);
      return res.status(200).json({
        success: true, data: result.items, pagination: result.pagination,
      });
    } catch (error) { return respondError(error, res, next); }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const params = deliveryAreaIdSchema.safeParse(req.params);
      if (!params.success) return res.status(400).json({
        success: false, message: "Invalid delivery area ID.",
      });
      const data = await DeliveryAreaService.getById(params.data.id);
      return res.status(200).json({ success: true, data });
    } catch (error) { return respondError(error, res, next); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const params = deliveryAreaIdSchema.safeParse(req.params);
      const body = updateDeliveryAreaSchema.safeParse(req.body);
      if (!params.success || !body.success) return res.status(400).json({
        success: false, message: "Invalid delivery area update.",
        errors: !params.success ? params.error.flatten() : body.success ? undefined : body.error.flatten(),
      });
      const data = await DeliveryAreaService.update(params.data.id, body.data);
      return res.status(200).json({
        success: true, message: "Delivery area updated successfully.", data,
      });
    } catch (error) { return respondError(error, res, next); }
  }

  static async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const params = deliveryAreaIdSchema.safeParse(req.params);
      const status = req.body?.status;
      if (!params.success || !["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({
          success: false, message: "Provide a valid ID and status.",
        });
      }
      const data = await DeliveryAreaService.setStatus(params.data.id, status);
      return res.status(200).json({
        success: true, message: "Delivery area status updated.", data,
      });
    } catch (error) { return respondError(error, res, next); }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const params = deliveryAreaIdSchema.safeParse(req.params);
      if (!params.success) return res.status(400).json({
        success: false, message: "Invalid delivery area ID.",
      });
      const data = await DeliveryAreaService.remove(params.data.id);
      return res.status(200).json({
        success: true, message: "Delivery area deleted successfully.", data,
      });
    } catch (error) { return respondError(error, res, next); }
  }
}
