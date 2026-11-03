import type { Request, Response, NextFunction } from "express";

import {
  adminPaymentParamsSchema,
  adminPaymentQuerySchema,
} from "./payment.admin.validator";

import {
  getAdminPaymentByTransactionId,
  listAdminPayments,
} from "./payment.admin.service";

export const getAdminPayments = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = adminPaymentQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid payment query.",
        errors: parsed.error.issues,
      });
      return;
    }

    const result = await listAdminPayments(parsed.data);

    res.status(200).json({
      success: true,
      data: result.payments,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminPaymentDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = adminPaymentParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid payment transaction ID.",
        errors: parsed.error.issues,
      });
      return;
    }

    const payment = await getAdminPaymentByTransactionId(
      parsed.data.transactionId,
    );

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};
