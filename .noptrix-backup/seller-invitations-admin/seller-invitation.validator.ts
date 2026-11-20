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
