import type { Request, Response } from "express";

import { getAuthenticatedAdminId } from "../../middlewares/adminAuth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import * as purchaseService from "./purchase.service";

import type {
  CreatePurchaseBody,
  UpdatePurchaseBody,
  PurchaseQuery,
  ReceivePurchaseBody,
  RecordPurchasePaymentBody,
  ApprovePurchaseBody,
  OrderPurchaseBody,
  CancelPurchaseBody,
} from "./purchase.validator";

export const createPurchaseController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const adminId = getAuthenticatedAdminId(req);
    const purchase = await purchaseService.createPurchase(
      req.body as CreatePurchaseBody,
      adminId,
    );

    res.status(201).json({
      success: true,
      message: "Purchase created successfully.",
      data: purchase,
    });
  },
);

export const listPurchasesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await purchaseService.listPurchases(
      req.query as unknown as PurchaseQuery,
    );

    res.status(200).json({
      success: true,
      message: "Purchases retrieved successfully.",
      data: result.items,
      pagination: result.pagination,
    });
  },
);

export const getPurchaseController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const purchase = await purchaseService.getPurchaseById(
      String(req.params.id),
    );

    res.status(200).json({
      success: true,
      message: "Purchase retrieved successfully.",
      data: purchase,
    });
  },
);

export const getPurchaseByNumberController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const purchase = await purchaseService.getPurchaseByNumber(
      String(req.params.purchaseNumber),
    );

    res.status(200).json({
      success: true,
      message: "Purchase retrieved successfully.",
      data: purchase,
    });
  },
);

export const updatePurchaseController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const adminId = getAuthenticatedAdminId(req);
    const purchase = await purchaseService.updatePurchase(
      String(req.params.id),
      req.body as UpdatePurchaseBody,
      adminId,
    );

    res.status(200).json({
      success: true,
      message: "Purchase updated successfully.",
      data: purchase,
    });
  },
);

export const linkPurchaseItemProductController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const purchase = await purchaseService.linkPurchaseItemToProduct(
      String(req.params.id),
      String(req.params.itemId),
      req.body.productId,
      req.body.variantId,
      getAuthenticatedAdminId(req),
    );

    res.status(200).json({
      success: true,
      message: "Purchase item linked to product successfully.",
      data: purchase,
    });
  },
);

export const approvePurchaseController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const adminId = getAuthenticatedAdminId(req);
    const purchase = await purchaseService.approvePurchase(
      String(req.params.id),
      req.body as ApprovePurchaseBody,
      adminId,
    );

    res.status(200).json({
      success: true,
      message: "Purchase approved successfully.",
      data: purchase,
    });
  },
);

export const orderPurchaseController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const adminId = getAuthenticatedAdminId(req);
    const purchase = await purchaseService.orderPurchase(
      String(req.params.id),
      req.body as OrderPurchaseBody,
      adminId,
    );

    res.status(200).json({
      success: true,
      message: "Purchase marked as ordered.",
      data: purchase,
    });
  },
);

export const receivePurchaseController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const adminId = getAuthenticatedAdminId(req);
    const purchase = await purchaseService.receivePurchase(
      String(req.params.id),
      req.body as ReceivePurchaseBody,
      adminId,
    );

    res.status(200).json({
      success: true,
      message: "Purchase stock received successfully.",
      data: purchase,
    });
  },
);

export const recordPurchasePaymentController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const adminId = getAuthenticatedAdminId(req);
    const purchase = await purchaseService.recordPurchasePayment(
      String(req.params.id),
      req.body as RecordPurchasePaymentBody,
      adminId,
    );

    res.status(200).json({
      success: true,
      message: "Purchase payment recorded successfully.",
      data: purchase,
    });
  },
);

export const cancelPurchaseController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const adminId = getAuthenticatedAdminId(req);
    const purchase = await purchaseService.cancelPurchase(
      String(req.params.id),
      req.body as CancelPurchaseBody,
      adminId,
    );

    res.status(200).json({
      success: true,
      message: "Purchase cancelled successfully.",
      data: purchase,
    });
  },
);

export const getPurchaseSummaryController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const summary = await purchaseService.getPurchaseSummary();

    res.status(200).json({
      success: true,
      message: "Purchase summary retrieved successfully.",
      data: summary,
    });
  },
);
