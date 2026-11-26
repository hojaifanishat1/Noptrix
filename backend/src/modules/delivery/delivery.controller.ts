import type { Request, Response, NextFunction } from "express";

import { DeliveryService } from "./delivery.service";

import {
  createDeliverySchema,
  assignRiderSchema,
  updateDeliveryStatusSchema,
  deliveryIdSchema,
  listDeliveriesSchema,
} from "./delivery.validator";

function getActorId(req: Request): string | undefined {
  const user = (
    req as Request & {
      user?: { id?: string; _id?: string };
    }
  ).user;

  return user?.id ?? user?._id;
}

function handleError(error: unknown, res: Response, next: NextFunction) {
  if (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
}

export class DeliveryController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createDeliverySchema.parse({
        body: req.body,
      });

      const delivery = await DeliveryService.create(
        parsed.body,
        getActorId(req),
      );

      return res.status(201).json({
        success: true,
        message: "Delivery created",
        data: delivery,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = deliveryIdSchema.parse({
        params: req.params,
      });

      const delivery = await DeliveryService.getById(parsed.params.id);

      return res.status(200).json({
        success: true,
        data: delivery,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async assignRider(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = assignRiderSchema.parse({
        params: req.params,
        body: req.body,
      });

      const delivery = await DeliveryService.assignRider(
        parsed.params.id,
        parsed.body.riderId,
        parsed.body.riderEarningAmount,
      );

      return res.status(200).json({
        success: true,
        message: "Rider assigned",
        data: delivery,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = updateDeliveryStatusSchema.parse({
        params: req.params,
        body: req.body,
      });

      const delivery = await DeliveryService.updateStatus(
        parsed.params.id,
        parsed.body,
      );

      return res.status(200).json({
        success: true,
        message: "Delivery status updated",
        data: delivery,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = deliveryIdSchema.parse({
        params: req.params,
      });

      const reason =
        typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

      if (!reason || reason.length > 500) {
        return res.status(400).json({
          success: false,
          message: "A cancellation reason is required",
        });
      }

      const delivery = await DeliveryService.cancel(parsed.params.id, reason);

      return res.status(200).json({
        success: true,
        message: "Delivery cancelled",
        data: delivery,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = listDeliveriesSchema.parse({
        query: req.query,
      });

      const result = await DeliveryService.list(parsed.query);

      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async myDeliveries(req: Request, res: Response, next: NextFunction) {
    try {
      const riderId = req.riderAuth?.riderId;

      if (!riderId) {
        return res.status(401).json({
          success: false,
          message: "Authenticated rider identity not found",
        });
      }

      const page = Math.max(
        1,
        Number.parseInt(String(req.query.page ?? "1"), 10) || 1,
      );

      const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20),
      );

      const result = await DeliveryService.listForRider(riderId, page, limit);

      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  }
}
