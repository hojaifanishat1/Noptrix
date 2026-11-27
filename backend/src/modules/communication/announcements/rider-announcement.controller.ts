import type { Request, Response, NextFunction } from "express";
import { getAuthenticatedRiderId } from "../../../middlewares/riderAuth.middleware";

import {
  getMyRiderAnnouncements,
  getMyRiderAnnouncementById,
  markRiderAnnouncementAsRead,
} from "./announcement.service";

function parsePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function getRiderAnnouncementsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const riderId = getAuthenticatedRiderId(req);
    const result = await getMyRiderAnnouncements({
      riderId,
      page: parsePositiveInteger(req.query.page, 1),
      limit: parsePositiveInteger(req.query.limit, 20),
      unreadOnly: req.query.unreadOnly === "true",
    });

    res.status(200).json({
      success: true,
      message: "Rider notifications retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRiderAnnouncementController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const riderId = getAuthenticatedRiderId(req);
    const result = await getMyRiderAnnouncementById(
      String(req.params.announcementId),
      riderId,
    );

    res.status(200).json({
      success: true,
      message: "Notification retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function markRiderAnnouncementReadController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const riderId = getAuthenticatedRiderId(req);
    const result = await markRiderAnnouncementAsRead(
      String(req.params.announcementId),
      riderId,
    );

    res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
