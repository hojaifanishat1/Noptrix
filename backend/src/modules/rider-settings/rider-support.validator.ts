import { z } from "zod";
import { RIDER_SUPPORT_CATEGORIES } from "./rider-support-ticket.model";

export const createRiderSupportTicketSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  category: z.enum(RIDER_SUPPORT_CATEGORIES),
  description: z.string().trim().min(10).max(3000),
});

export const riderSupportReplySchema = z.object({
  message: z.string().trim().min(1).max(3000),
});
