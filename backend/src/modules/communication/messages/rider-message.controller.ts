import type { Request, Response } from "express";

import { asyncHandler } from "../../../utils/asyncHandler";
import { getAuthenticatedRiderId } from "../../../middlewares/riderAuth.middleware";
import {
  createMessageReply,
  getInbox,
  getMessageThread,
  getUnreadMessageCount,
} from "./message.service";

const getMessageId = (req: Request): string => {
  const value = req.params.messageId;
  return Array.isArray(value) ? value[0] : value;
};

export const getRiderMessageInboxController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const result = await getInbox({
      userId: getAuthenticatedRiderId(req),
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 100,
      sort: req.query.sort === "oldest" ? "oldest" : "newest",
    });

    res.status(200).json({
      success: true,
      message: "Rider message inbox retrieved successfully.",
      data: result,
    });
  },
);

export const getRiderMessageThreadController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const messages = await getMessageThread(
      getMessageId(req),
      getAuthenticatedRiderId(req),
    );

    res.status(200).json({
      success: true,
      message: "Rider conversation retrieved successfully.",
      data: { messages },
    });
  },
);

export const createRiderMessageReplyController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const message = await createMessageReply(
      getMessageId(req),
      getAuthenticatedRiderId(req),
      [],
      req.body.body,
      req.body.attachments ?? [],
    );

    res.status(201).json({
      success: true,
      message: "Reply sent successfully.",
      data: message,
    });
  },
);

export const getRiderUnreadMessageCountController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const count = await getUnreadMessageCount(
      getAuthenticatedRiderId(req),
    );

    res.status(200).json({
      success: true,
      message: "Unread rider message count retrieved successfully.",
      data: { count },
    });
  },
);
