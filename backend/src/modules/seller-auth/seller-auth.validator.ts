import { z } from "zod";

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

/*
|--------------------------------------------------------------------------
| Seller Login
|--------------------------------------------------------------------------
*/

export const sellerLoginSchema = z
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

    password: z.string().min(1, "Password is required."),
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: "Email or phone is required.",
    path: ["email"],
  });

/*
|--------------------------------------------------------------------------
| Refresh Token
|--------------------------------------------------------------------------
*/

export const sellerRefreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1, "Refresh token is required."),
});

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
|
| Session-based logout.
|
*/

export const sellerLogoutSchema = z.object({
  sessionId: z.string().trim().min(1, "Session ID is required."),
});

/*
|--------------------------------------------------------------------------
| Change Password
|--------------------------------------------------------------------------
*/

export const sellerChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),

    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .max(128, "New password cannot exceed 128 characters."),

    confirmPassword: z.string().min(1, "Password confirmation is required."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/*
|--------------------------------------------------------------------------
| Inferred Types
|--------------------------------------------------------------------------
*/

export type SellerLoginInput = z.infer<typeof sellerLoginSchema>;

export type SellerRefreshTokenInput = z.infer<typeof sellerRefreshTokenSchema>;

export type SellerLogoutInput = z.infer<typeof sellerLogoutSchema>;

export type SellerChangePasswordInput = z.infer<
  typeof sellerChangePasswordSchema
>;


export const sellerVerifyLoginSchema = z.object({
  challengeId: z.string().trim().min(32),
  code: z.string().trim().regex(/^\d{6}$/),
});

export const sellerResendLoginCodeSchema = z.object({
  challengeId: z.string().trim().min(32),
});
