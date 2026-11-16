import { z } from "zod";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

export const riderLoginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .regex(EMAIL_REGEX, "Invalid email address.")
      .optional(),

    phone: z
      .string()
      .trim()
      .regex(PHONE_REGEX, "Invalid phone number.")
      .optional(),

    password: z
      .string()
      .min(1, "Password is required."),
  })
  .refine(
    (data) => Boolean(data.email || data.phone),
    {
      message: "Email or phone is required.",
      path: ["email"],
    },
  );

export const riderVerifyLoginSchema = z.object({
  challengeId: z
    .string()
    .trim()
    .min(32, "Invalid verification challenge."),

  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "Invalid verification code."),
});

export const riderResendLoginCodeSchema = z.object({
  challengeId: z
    .string()
    .trim()
    .min(32, "Invalid verification challenge."),
});

// Refresh token is read from the httpOnly cookie.
export const riderRefreshTokenSchema = z.object({});

// Logout uses the refresh-token cookie.
export const riderLogoutSchema = z.object({});

export const riderChangePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Current password is required."),

    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .max(128, "New password cannot exceed 128 characters."),

    confirmPassword: z
      .string()
      .min(1, "Password confirmation is required."),
  })
  .refine(
    (data) => data.newPassword === data.confirmPassword,
    {
      message: "Passwords do not match.",
      path: ["confirmPassword"],
    },
  );

export type RiderLoginInput = z.infer<
  typeof riderLoginSchema
>;

export type RiderVerifyLoginInput = z.infer<
  typeof riderVerifyLoginSchema
>;

export type RiderResendLoginCodeInput = z.infer<
  typeof riderResendLoginCodeSchema
>;

export type RiderRefreshTokenInput = z.infer<
  typeof riderRefreshTokenSchema
>;

export type RiderLogoutInput = z.infer<
  typeof riderLogoutSchema
>;

export type RiderChangePasswordInput = z.infer<
  typeof riderChangePasswordSchema
>;
