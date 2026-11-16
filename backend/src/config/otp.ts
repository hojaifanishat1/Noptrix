import { logger } from "../utils/logger";

/*
|--------------------------------------------------------------------------
| OTP Channels
|--------------------------------------------------------------------------
|
| Defines where an OTP can be delivered.
| Actual delivery configuration belongs to mail.ts / sms.ts.
|
|--------------------------------------------------------------------------
*/

export const OTP_CHANNELS = {
  EMAIL: "email",
  SMS: "sms",
} as const;

export type OtpChannel = (typeof OTP_CHANNELS)[keyof typeof OTP_CHANNELS];

/*
|--------------------------------------------------------------------------
| OTP Purposes
|--------------------------------------------------------------------------
|
| Every OTP must have a business purpose.
| This prevents an OTP generated for one operation from being
| incorrectly reused for another operation.
|
|--------------------------------------------------------------------------
*/

export const OTP_PURPOSES = {
  LOGIN: "login",
  LOGIN_VERIFICATION: "LOGIN_VERIFICATION",
  REGISTER: "register",
  EMAIL_VERIFICATION: "email_verification",
  PHONE_VERIFICATION: "phone_verification",
  PASSWORD_RESET: "password_reset",
  ADMIN_VERIFICATION: "admin_verification",
  CHANGE_EMAIL: "change_email",
  CHANGE_PHONE: "change_phone",
} as const;

export type OtpPurpose = (typeof OTP_PURPOSES)[keyof typeof OTP_PURPOSES];

/*
|--------------------------------------------------------------------------
| OTP Configuration Constants
|--------------------------------------------------------------------------
*/

export const OTP_LENGTH = 6;

/*
|--------------------------------------------------------------------------
| OTP Lifetime
|--------------------------------------------------------------------------
|
| OTP remains valid for 5 minutes.
|
|--------------------------------------------------------------------------
*/

export const OTP_EXPIRY_SECONDS = 5 * 60;

/*
|--------------------------------------------------------------------------
| Resend Cooldown
|--------------------------------------------------------------------------
|
| Prevents users from repeatedly requesting OTPs.
|
|--------------------------------------------------------------------------
*/

export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/*
|--------------------------------------------------------------------------
| Maximum Verification Attempts
|--------------------------------------------------------------------------
|
| After this many failed attempts, the OTP should be invalidated.
|
|--------------------------------------------------------------------------
*/

export const OTP_MAX_ATTEMPTS = 5;

/*
|--------------------------------------------------------------------------
| OTP Retention
|--------------------------------------------------------------------------
|
| Used later with database cleanup / TTL strategy.
|
|--------------------------------------------------------------------------
*/

export const OTP_RETENTION_SECONDS = 10 * 60;

/*
|--------------------------------------------------------------------------
| OTP Generation Range
|--------------------------------------------------------------------------
*/

export const OTP_MIN_VALUE = 100000;

export const OTP_MAX_VALUE = 999999;

/*
|--------------------------------------------------------------------------
| OTP Configuration Interface
|--------------------------------------------------------------------------
*/

export interface OtpConfig {
  length: number;
  expirySeconds: number;
  resendCooldownSeconds: number;
  maxAttempts: number;
  retentionSeconds: number;
}

/*
|--------------------------------------------------------------------------
| Runtime Configuration
|--------------------------------------------------------------------------
*/

const otpConfig: OtpConfig = {
  length: OTP_LENGTH,
  expirySeconds: OTP_EXPIRY_SECONDS,
  resendCooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  maxAttempts: OTP_MAX_ATTEMPTS,
  retentionSeconds: OTP_RETENTION_SECONDS,
};

/*
|--------------------------------------------------------------------------
| Configuration Validation
|--------------------------------------------------------------------------
*/

export const validateOtpConfiguration = (): void => {
  if (
    !Number.isInteger(otpConfig.length) ||
    otpConfig.length < 4 ||
    otpConfig.length > 8
  ) {
    throw new Error("OTP length must be an integer between 4 and 8.");
  }

  if (
    !Number.isInteger(otpConfig.expirySeconds) ||
    otpConfig.expirySeconds <= 0
  ) {
    throw new Error("OTP expiry time must be greater than zero.");
  }

  if (
    !Number.isInteger(otpConfig.resendCooldownSeconds) ||
    otpConfig.resendCooldownSeconds < 0
  ) {
    throw new Error("OTP resend cooldown cannot be negative.");
  }

  if (!Number.isInteger(otpConfig.maxAttempts) || otpConfig.maxAttempts <= 0) {
    throw new Error("OTP maximum attempts must be greater than zero.");
  }

  if (
    !Number.isInteger(otpConfig.retentionSeconds) ||
    otpConfig.retentionSeconds <= 0
  ) {
    throw new Error("OTP retention time must be greater than zero.");
  }
};

/*
|--------------------------------------------------------------------------
| Get OTP Configuration
|--------------------------------------------------------------------------
*/

export const getOtpConfig = (): OtpConfig => {
  return {
    ...otpConfig,
  };
};

/*
|--------------------------------------------------------------------------
| Public OTP Configuration
|--------------------------------------------------------------------------
|
| Safe values only.
| No secrets are stored in this configuration anyway, but keeping a
| public config boundary makes future expansion safer.
|
|--------------------------------------------------------------------------
*/

export interface PublicOtpConfig {
  length: number;
  expirySeconds: number;
  resendCooldownSeconds: number;
  maxAttempts: number;
}

export const getOtpPublicConfig = (): PublicOtpConfig => {
  return {
    length: otpConfig.length,
    expirySeconds: otpConfig.expirySeconds,
    resendCooldownSeconds: otpConfig.resendCooldownSeconds,
    maxAttempts: otpConfig.maxAttempts,
  };
};

/*
|--------------------------------------------------------------------------
| OTP Configuration Status
|--------------------------------------------------------------------------
*/

export const isOtpConfigured = (): boolean => {
  try {
    validateOtpConfiguration();

    return true;
  } catch {
    return false;
  }
};

/*
|--------------------------------------------------------------------------
| OTP Health
|--------------------------------------------------------------------------
*/

export const isOtpHealthy = (): boolean => {
  return isOtpConfigured();
};

/*
|--------------------------------------------------------------------------
| Channel Resolver
|--------------------------------------------------------------------------
|
| Delivery provider selection is intentionally NOT handled here.
|
| email → mail.ts / email.service.ts
| sms   → sms.ts / sms.service.ts
|
|--------------------------------------------------------------------------
*/

export const resolveOtpChannel = (channel: OtpChannel): OtpChannel => {
  if (channel !== OTP_CHANNELS.EMAIL && channel !== OTP_CHANNELS.SMS) {
    throw new Error(`Unsupported OTP channel: ${channel}`);
  }

  return channel;
};

/*
|--------------------------------------------------------------------------
| Purpose Resolver
|--------------------------------------------------------------------------
*/

export const resolveOtpPurpose = (purpose: OtpPurpose): OtpPurpose => {
  const validPurposes = Object.values(OTP_PURPOSES);

  if (!validPurposes.includes(purpose)) {
    throw new Error(`Unsupported OTP purpose: ${purpose}`);
  }

  return purpose;
};

/*
|--------------------------------------------------------------------------
| Configuration Initialization
|--------------------------------------------------------------------------
*/

export const configureOtp = (): void => {
  validateOtpConfiguration();

  logger.info("OTP configuration initialized successfully.");
};

/*
|--------------------------------------------------------------------------
| Module Initialization
|--------------------------------------------------------------------------
*/

configureOtp();
