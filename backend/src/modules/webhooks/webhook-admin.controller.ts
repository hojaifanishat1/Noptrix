import type { Request, Response, NextFunction } from "express";
import { WebhookEvent, WEBHOOK_EVENT_STATUSES } from "./webhook.model";

export async function listWebhookEventsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter: Record<string, unknown> = {};

    if (typeof req.query.provider === "string" && req.query.provider.trim()) {
      filter.provider = req.query.provider.trim().toLowerCase();
    }

    if (
      typeof req.query.status === "string" &&
      WEBHOOK_EVENT_STATUSES.includes(
        req.query.status as (typeof WEBHOOK_EVENT_STATUSES)[number],
      )
    ) {
      filter.status = req.query.status;
    }

    const createdAt: Record<string, Date> = {};

    if (typeof req.query.from === "string") {
      const date = new Date(req.query.from);
      if (!Number.isNaN(date.getTime())) createdAt.$gte = date;
    }

    if (typeof req.query.to === "string") {
      const date = new Date(req.query.to);
      if (!Number.isNaN(date.getTime())) createdAt.$lte = date;
    }

    if (Object.keys(createdAt).length) filter.createdAt = createdAt;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      WebhookEvent.find(filter)
        .select("provider eventId eventType status transactionId failureCode processedAt createdAt updatedAt")
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      WebhookEvent.countDocuments(filter).exec(),
    ]);

    res.status(200).json({
      success: true,
      message: "Webhook events retrieved successfully.",
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: skip + items.length < total,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
}
