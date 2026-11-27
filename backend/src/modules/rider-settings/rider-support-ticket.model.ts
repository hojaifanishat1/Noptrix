import { Schema, model, models, Types } from "mongoose";

export const RIDER_SUPPORT_CATEGORIES = [
  "ACCOUNT",
  "ORDERS",
  "PAYMENTS",
  "VEHICLE",
  "APP",
  "OTHER",
] as const;

export const RIDER_SUPPORT_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

interface RiderSupportMessage {
  message: string;
  createdAt: Date;
}

interface RiderSupportTicket {
  ticketNumber: string;
  riderId: Types.ObjectId;
  subject: string;
  category: (typeof RIDER_SUPPORT_CATEGORIES)[number];
  description: string;
  status: (typeof RIDER_SUPPORT_STATUSES)[number];
  messages: RiderSupportMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const riderSupportMessageSchema = new Schema<RiderSupportMessage>(
  {
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const riderSupportTicketSchema = new Schema<RiderSupportTicket>(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true },
    riderId: {
      type: Schema.Types.ObjectId,
      ref: "Rider",
      required: true,
      index: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    category: {
      type: String,
      enum: RIDER_SUPPORT_CATEGORIES,
      required: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    status: {
      type: String,
      enum: RIDER_SUPPORT_STATUSES,
      default: "OPEN",
      index: true,
    },
    messages: { type: [riderSupportMessageSchema], default: [] },
  },
  { timestamps: true },
);

riderSupportTicketSchema.index({ riderId: 1, createdAt: -1 });

export const RiderSupportTicketModel =
  models.RiderSupportTicket ||
  model<RiderSupportTicket>("RiderSupportTicket", riderSupportTicketSchema);
