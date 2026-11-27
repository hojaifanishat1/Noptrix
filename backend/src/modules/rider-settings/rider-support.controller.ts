import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler";
import { getAuthenticatedRiderId } from "../../middlewares/riderAuth.middleware";
import { RiderSupportTicketModel } from "./rider-support-ticket.model";
import {
  createRiderSupportTicketSchema,
  riderSupportReplySchema,
} from "./rider-support.validator";

const getTicketId = (req: Parameters<RequestHandler>[0]): string => {
  const value = req.params.ticketId;
  return Array.isArray(value) ? value[0] : value;
};

const makeTicketNumber = () =>
  `RDR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

export const listMyRiderSupportTickets: RequestHandler = asyncHandler(
  async (req, res) => {
    const riderId = getAuthenticatedRiderId(req);

    const tickets = await RiderSupportTicketModel.find({ riderId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({
      success: true,
      message: "Support tickets retrieved.",
      data: tickets,
    });
  },
);

export const createMyRiderSupportTicket: RequestHandler = asyncHandler(
  async (req, res) => {
    const riderId = getAuthenticatedRiderId(req);
    const input = createRiderSupportTicketSchema.parse(req.body);

    const ticket = await RiderSupportTicketModel.create({
      ticketNumber: makeTicketNumber(),
      riderId,
      ...input,
      status: "OPEN",
      messages: [],
    });

    res.status(201).json({
      success: true,
      message: "Support ticket created.",
      data: ticket,
    });
  },
);

export const getMyRiderSupportTicket: RequestHandler = asyncHandler(
  async (req, res) => {
    const riderId = getAuthenticatedRiderId(req);
    const ticketId = getTicketId(req);

    if (!Types.ObjectId.isValid(ticketId)) {
      res.status(404).json({ success: false, message: "Ticket not found." });
      return;
    }

    const ticket = await RiderSupportTicketModel.findOne({
      _id: ticketId,
      riderId,
    }).lean();

    if (!ticket) {
      res.status(404).json({ success: false, message: "Ticket not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Support ticket retrieved.",
      data: ticket,
    });
  },
);

export const replyToMyRiderSupportTicket: RequestHandler = asyncHandler(
  async (req, res) => {
    const riderId = getAuthenticatedRiderId(req);
    const ticketId = getTicketId(req);
    const input = riderSupportReplySchema.parse(req.body);

    if (!Types.ObjectId.isValid(ticketId)) {
      res.status(404).json({ success: false, message: "Ticket not found." });
      return;
    }

    const ticket = await RiderSupportTicketModel.findOne({
      _id: ticketId,
      riderId,
    });

    if (!ticket) {
      res.status(404).json({ success: false, message: "Ticket not found." });
      return;
    }

    if (ticket.status === "CLOSED") {
      res.status(400).json({
        success: false,
        message: "This ticket is closed.",
      });
      return;
    }

    ticket.messages.push({
      message: input.message,
      createdAt: new Date(),
    });

    if (ticket.status === "RESOLVED") {
      ticket.status = "OPEN";
    }

    await ticket.save();

    res.status(200).json({
      success: true,
      message: "Reply added.",
      data: ticket,
    });
  },
);

export const closeMyRiderSupportTicket: RequestHandler = asyncHandler(
  async (req, res) => {
    const riderId = getAuthenticatedRiderId(req);
    const ticketId = getTicketId(req);

    if (!Types.ObjectId.isValid(ticketId)) {
      res.status(404).json({ success: false, message: "Ticket not found." });
      return;
    }

    const ticket = await RiderSupportTicketModel.findOne({
      _id: ticketId,
      riderId,
    });

    if (!ticket) {
      res.status(404).json({ success: false, message: "Ticket not found." });
      return;
    }

    ticket.status = "CLOSED";
    await ticket.save();

    res.status(200).json({
      success: true,
      message: "Support ticket closed.",
      data: ticket,
    });
  },
);
