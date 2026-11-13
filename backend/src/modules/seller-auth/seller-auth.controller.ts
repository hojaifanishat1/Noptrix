import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import { getAuthenticatedSellerId } from "../../middlewares/sellerAuth.middleware";
import { getSellerById } from "../sellers/seller.service";

import {
  loginSeller,
  refreshSellerToken,
  logoutSeller,
  changeSellerPassword,
} from "./seller-auth.service";

export const loginSellerController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await loginSeller(req.body, {
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
      deviceId: req.get("x-device-id"),
    });

    res.status(200).json(
      ApiResponse.ok(result, "Seller login successful.").serialize(),
    );
  },
);

export const refreshSellerTokenController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await refreshSellerToken(req.body.refreshToken);

    res.status(200).json(
      ApiResponse.ok(result, "Seller token refreshed.").serialize(),
    );
  },
);

export const logoutSellerController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const sellerId = getAuthenticatedSellerId(req);
    const { sessionId } = req.body;

    await logoutSeller(sellerId, sessionId);

    res.status(200).json(
      ApiResponse.ok(null, "Seller logout successful.").serialize(),
    );
  },
);

export const changeSellerPasswordController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const sellerId = getAuthenticatedSellerId(req);
    const { currentPassword, newPassword } = req.body;

    await changeSellerPassword(
      sellerId,
      currentPassword,
      newPassword,
    );

    res.status(200).json(
      ApiResponse.ok(
        null,
        "Seller password changed successfully. Please log in again.",
      ).serialize(),
    );
  },
);

export const getSellerMeController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const sellerId = getAuthenticatedSellerId(req);
    const seller = await getSellerById(sellerId);

    res.status(200).json(
      ApiResponse.ok(seller, "Seller profile fetched.").serialize(),
    );
  },
);
