import { z } from "zod";

export const acceptSellerInvitationSchema = z
  .object({
    token: z.string().trim().regex(/^[a-f0-9]{64}$/i, {
      message: "Invalid invitation token.",
    }),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type AcceptSellerInvitationInput = z.infer<
  typeof acceptSellerInvitationSchema
>;

export const sellerInvitationTokenParamsSchema = z.object({
  token: z.string().trim().regex(/^[a-f0-9]{64}$/i, {
    message: "Invalid invitation token.",
  }),
});

/*
|--------------------------------------------------------------------------
| ADMIN INVITATION MANAGEMENT
|--------------------------------------------------------------------------
*/

export const sellerInvitationIdParamSchema = z.object({
  invitationId: z.string().trim().regex(/^[a-f\d]{24}$/i, {
    message: "Invalid invitation ID.",
  }),
});

export const sellerInvitationAdminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.enum(["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]).optional(),
});
