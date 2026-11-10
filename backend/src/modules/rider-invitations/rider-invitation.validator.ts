import { z } from "zod";
import { RIDER_TYPES, RIDER_VEHICLE_TYPES } from "../riders/rider.types";
import { RIDER_INVITATION_STATUSES } from "./rider-invitation.model";

export const createRiderInvitationSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z.string().trim().max(30).optional(),
    type: z.enum(RIDER_TYPES).default("INTERNAL"),
    vehicleType: z.enum(RIDER_VEHICLE_TYPES).optional(),
    vehicleNumber: z.string().trim().max(50).optional(),
    licenseNumber: z.string().trim().max(100).optional(),
    nationalId: z.string().trim().max(100).optional(),
  })
  .strict();

export const riderInvitationIdParamSchema = z
  .object({ invitationId: z.string().regex(/^[a-f\d]{24}$/i) })
  .strict();

export const riderInvitationTokenSchema = z
  .object({ token: z.string().trim().min(1) })
  .strict();

export const acceptRiderInvitationSchema = z
  .object({
    token: z.string().trim().min(1),
    password: z.string().min(8).max(128).optional(),
  })
  .strict();

export const riderInvitationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(RIDER_INVITATION_STATUSES).optional(),
    search: z.string().trim().max(150).optional(),
  })
  .strict();

export type CreateRiderInvitationInput = z.infer<
  typeof createRiderInvitationSchema
>;
export type AcceptRiderInvitationInput = z.infer<
  typeof acceptRiderInvitationSchema
>;
export type RiderInvitationQuery = z.infer<typeof riderInvitationQuerySchema>;
