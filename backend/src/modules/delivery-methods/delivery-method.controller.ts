import type { Request, Response, NextFunction } from "express";
import {
  createDeliveryMethodSchema, updateDeliveryMethodSchema,
  deliveryMethodIdSchema, listDeliveryMethodsSchema,
} from "./delivery-method.validator";
import { DeliveryMethodService } from "./delivery-method.service";

function fail(error: any, res: Response, next: NextFunction) {
  if (typeof error?.statusCode === "number") {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  return next(error);
}

export class DeliveryMethodController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createDeliveryMethodSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({
        success: false, message: "Validation failed.", errors: parsed.error.flatten(),
      });
      const data = await DeliveryMethodService.create(parsed.data);
      return res.status(201).json({ success: true, message: "Delivery method created.", data });
    } catch (error) { return fail(error, res, next); }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = listDeliveryMethodsSchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({
        success: false, message: "Invalid query parameters.", errors: parsed.error.flatten(),
      });
      const result = await DeliveryMethodService.list(parsed.data);
      return res.status(200).json({
        success: true, data: result.items, pagination: result.pagination,
      });
    } catch (error) { return fail(error, res, next); }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const params = deliveryMethodIdSchema.safeParse(req.params);
      if (!params.success) return res.status(400).json({ success: false, message: "Invalid ID." });
      const data = await DeliveryMethodService.getById(params.data.id);
      return res.status(200).json({ success: true, data });
    } catch (error) { return fail(error, res, next); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const params = deliveryMethodIdSchema.safeParse(req.params);
      const body = updateDeliveryMethodSchema.safeParse(req.body);
      if (!params.success || !body.success) return res.status(400).json({
        success: false, message: "Invalid delivery method update.",
        errors: !params.success ? params.error.flatten() : body.success ? undefined : body.error.flatten(),
      });
      const data = await DeliveryMethodService.update(params.data.id, body.data);
      return res.status(200).json({ success: true, message: "Delivery method updated.", data });
    } catch (error) { return fail(error, res, next); }
  }

  static async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const params = deliveryMethodIdSchema.safeParse(req.params);
      const status = req.body?.status;
      if (!params.success || !["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid ID or status." });
      }
      const data = await DeliveryMethodService.setStatus(params.data.id, status);
      return res.status(200).json({ success: true, message: "Status updated.", data });
    } catch (error) { return fail(error, res, next); }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const params = deliveryMethodIdSchema.safeParse(req.params);
      if (!params.success) return res.status(400).json({ success: false, message: "Invalid ID." });
      const data = await DeliveryMethodService.remove(params.data.id);
      return res.status(200).json({ success: true, message: "Delivery method deleted.", data });
    } catch (error) { return fail(error, res, next); }
  }
}
