import {
  type Attachment,
  type SendMailOptions,
  type SentMessageInfo,
} from "nodemailer";

import {
  getMailFrom,
  getMailTransporter,
  isMailConfiguredStatus,
  isMailHealthy,
  verifyMailConnection,
} from "../config/mail";

import { renderNotificationTemplate } from "../modules/notifications/notification-template.service";

import { logger } from "../utils/logger";

/*
|--------------------------------------------------------------------------
| Email Service
|--------------------------------------------------------------------------
|
| Responsibilities:
|
| - Send plain-text emails
| - Send HTML emails
| - Support CC / BCC
| - Support Reply-To
| - Support attachments
| - Support custom headers
| - Support bulk email delivery
| - Verify SMTP availability
| - Normalize Nodemailer responses
|
| SMTP configuration remains inside:
|
|     config/email.ts
|
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export interface EmailAttachment {
  readonly filename: string;

  readonly content: string | Buffer;

  readonly contentType?: string;

  readonly encoding?: string;

  readonly cid?: string;
}

export interface SendEmailInput {
  readonly to: string | readonly string[];

  readonly subject: string;

  readonly text?: string;

  readonly html?: string;

  readonly cc?: string | readonly string[];

  readonly bcc?: string | readonly string[];

  readonly replyTo?: string;

  readonly attachments?: readonly EmailAttachment[];

  readonly headers?: Record<string, string>;

  readonly priority?: "high" | "normal" | "low";

  readonly templateKey?: string;

  readonly templateLocale?: string;

  readonly templateVariables?: Readonly<Record<string, unknown>>;
  readonly requireTemplate?: boolean;
}

export interface EmailSendResult {
  readonly messageId: string;

  readonly accepted: readonly string[];

  readonly rejected: readonly string[];

  readonly response: string;

  readonly envelope: {
    readonly from: string;

    readonly to: readonly string[];
  };
}

export interface BulkEmailItem {
  readonly to: string | readonly string[];

  readonly subject: string;

  readonly text?: string;

  readonly html?: string;

  readonly cc?: string | readonly string[];

  readonly bcc?: string | readonly string[];

  readonly replyTo?: string;

  readonly attachments?: readonly EmailAttachment[];

  readonly headers?: Record<string, string>;

  readonly priority?: "high" | "normal" | "low";

  readonly templateKey?: string;

  readonly templateLocale?: string;

  readonly templateVariables?: Readonly<Record<string, unknown>>;
}

export interface BulkEmailResult {
  readonly total: number;

  readonly successful: number;

  readonly failed: number;

  readonly results: readonly EmailSendResult[];

  readonly errors: readonly {
    readonly index: number;

    readonly error: unknown;
  }[];
}

export interface EmailServiceHealth {
  readonly configured: boolean;

  readonly healthy: boolean;
}

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const MAX_SUBJECT_LENGTH = 998;

const MAX_RECIPIENTS_PER_EMAIL = 100;

const DEFAULT_BULK_CONCURRENCY = 3;

/*
|--------------------------------------------------------------------------
| Internal Helpers
|--------------------------------------------------------------------------
*/

/**
 * Normalize email addresses.
 */
const normalizeAddresses = (value?: string | readonly string[]): string[] => {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? [...value] : [value];

  return values
    .filter((email): email is string => typeof email === "string")
    .map((email) => email.trim())
    .filter(Boolean);
};

/**
 * Basic email validation.
 *
 * This intentionally remains lightweight.
 * SMTP/provider validation is still authoritative.
 */
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Validate recipient list.
 */
const validateRecipients = (recipients: readonly string[]): void => {
  if (recipients.length === 0) {
    throw new Error("At least one email recipient is required.");
  }

  if (recipients.length > MAX_RECIPIENTS_PER_EMAIL) {
    throw new Error(
      `A maximum of ${MAX_RECIPIENTS_PER_EMAIL} recipients are allowed per email.`,
    );
  }

  const invalid = recipients.filter((email) => !isValidEmail(email));

  if (invalid.length > 0) {
    throw new Error(`Invalid email address: ${invalid[0]}`);
  }
};

/**
 * Validate subject.
 */
const validateSubject = (subject: string): string => {
  if (typeof subject !== "string" || !subject.trim()) {
    throw new TypeError("Email subject is required.");
  }

  const normalized = subject.trim();

  if (normalized.length > MAX_SUBJECT_LENGTH) {
    throw new Error(
      `Email subject cannot exceed ${MAX_SUBJECT_LENGTH} characters.`,
    );
  }

  return normalized;
};

/**
 * Validate email body.
 */
const validateBody = (text?: string, html?: string): void => {
  const hasText = typeof text === "string" && text.trim().length > 0;

  const hasHtml = typeof html === "string" && html.trim().length > 0;

  if (!hasText && !hasHtml) {
    throw new Error("Email must contain either text or HTML content.");
  }
};

/**
 * Validate CC/BCC addresses.
 */
const validateOptionalRecipients = (
  recipients: readonly string[],
  field: string,
): void => {
  if (recipients.length > MAX_RECIPIENTS_PER_EMAIL) {
    throw new Error(
      `${field} cannot contain more than ${MAX_RECIPIENTS_PER_EMAIL} recipients.`,
    );
  }

  const invalid = recipients.filter((email) => !isValidEmail(email));

  if (invalid.length > 0) {
    throw new Error(`Invalid ${field} email address: ${invalid[0]}`);
  }
};

/**
 * Validate attachments.
 */
const validateAttachments = (attachments: readonly EmailAttachment[]): void => {
  for (const attachment of attachments) {
    if (!attachment.filename || !attachment.filename.trim()) {
      throw new Error("Every email attachment must have a filename.");
    }

    if (attachment.content === undefined || attachment.content === null) {
      throw new Error(`Attachment "${attachment.filename}" has no content.`);
    }
  }
};

/**
 * Convert our attachment contract into
 * Nodemailer's Attachment type.
 */
const mapAttachments = (
  attachments?: readonly EmailAttachment[],
): Attachment[] | undefined => {
  if (!attachments || attachments.length === 0) {
    return undefined;
  }

  return attachments.map((attachment) => ({
    filename: attachment.filename,

    content: attachment.content,

    contentType: attachment.contentType,

    encoding: attachment.encoding,

    cid: attachment.cid,
  }));
};

/**
 * Convert Nodemailer result into application result.
 */
const mapSendResult = (info: SentMessageInfo): EmailSendResult => {
  const accepted = Array.isArray(info.accepted)
    ? info.accepted.map(String)
    : [];

  const rejected = Array.isArray(info.rejected)
    ? info.rejected.map(String)
    : [];

  const envelopeTo = Array.isArray(info.envelope?.to)
    ? info.envelope.to.map(String)
    : [];

  return {
    messageId: String(info.messageId ?? ""),

    accepted,

    rejected,

    response: String(info.response ?? ""),

    envelope: {
      from: String(info.envelope?.from ?? ""),

      to: envelopeTo,
    },
  };
};

/*
|--------------------------------------------------------------------------
| Build Nodemailer Options
|--------------------------------------------------------------------------
*/

const buildMailOptions = (input: SendEmailInput): SendMailOptions => {
  const to = normalizeAddresses(input.to);

  const cc = normalizeAddresses(input.cc);

  const bcc = normalizeAddresses(input.bcc);

  validateRecipients(to);

  validateOptionalRecipients(cc, "CC");

  validateOptionalRecipients(bcc, "BCC");

  const subject = validateSubject(input.subject);

  validateBody(input.text, input.html);

  if (input.replyTo && !isValidEmail(input.replyTo.trim())) {
    throw new Error("Invalid reply-to email address.");
  }

  if (input.attachments) {
    validateAttachments(input.attachments);
  }

  const mailOptions: SendMailOptions = {
    from: getMailFrom(),

    to,

    subject,

    text: input.text,

    html: input.html,

    cc: cc.length > 0 ? cc : undefined,

    bcc: bcc.length > 0 ? bcc : undefined,

    replyTo: input.replyTo?.trim(),

    attachments: mapAttachments(input.attachments),

    headers: input.headers,

    priority: input.priority,
  };

  return mailOptions;
};

/*
|--------------------------------------------------------------------------
| Send Email
|--------------------------------------------------------------------------
*/

export const sendEmail = async (
  input: SendEmailInput,
): Promise<EmailSendResult> => {
  if (!isMailConfiguredStatus()) {
    throw new Error("Email service is not configured.");
  }

  let subject = input.subject;
  let text = input.text;
  let html = input.html;
  const templateKey = input.templateKey?.trim();

  if (templateKey) {
    try {
      const rendered = await renderNotificationTemplate({
        key: templateKey,
        channel: "email",
        locale: input.templateLocale,
        variables: input.templateVariables,
      });

      subject = rendered.title;
      text = rendered.message;
      html = rendered.message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, "<br />");
    } catch (error) {
      if (input.requireTemplate) {
        logger.error(
          {
            error,
            templateKey,
            templateLocale: input.templateLocale,
          },
          "Required email template rendering failed.",
        );

        throw error;
      }

      logger.warn(
        {
          error,
          templateKey,
          templateLocale: input.templateLocale,
        },
        "Email template rendering failed; using fallback content.",
      );
    }
  }

  const mailOptions = buildMailOptions({
    ...input,
    subject,
    text,
    html,
  });

  const transporter = getMailTransporter();

  try {
    const info = await transporter.sendMail(mailOptions);

    const result = mapSendResult(info);

    logger.info(
      {
        messageId: result.messageId,

        accepted: result.accepted.length,

        rejected: result.rejected.length,
      },
      "Email sent successfully.",
    );

    return result;
  } catch (error) {
    logger.error(
      {
        error,

        subject: input.subject,
      },
      "Email delivery failed.",
    );

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Send Text Email
|--------------------------------------------------------------------------
*/

export const sendTextEmail = async (
  to: string | readonly string[],

  subject: string,

  text: string,

  template?: Pick<
    SendEmailInput,
    "templateKey" | "templateLocale" | "templateVariables"
  >,
): Promise<EmailSendResult> => {
  return sendEmail({
    to,

    subject,

    text,

    ...template,
  });
};

/*
|--------------------------------------------------------------------------
| Send HTML Email
|--------------------------------------------------------------------------
*/

export const sendHtmlEmail = async (
  to: string | readonly string[],

  subject: string,

  html: string,

  text?: string,

  template?: Pick<
    SendEmailInput,
    "templateKey" | "templateLocale" | "templateVariables"
  >,
): Promise<EmailSendResult> => {
  return sendEmail({
    to,

    subject,

    html,

    text,

    ...template,
  });
};

/*
|--------------------------------------------------------------------------
| Send Email With Attachment
|--------------------------------------------------------------------------
*/

export const sendEmailWithAttachment = async (
  input: SendEmailInput,
): Promise<EmailSendResult> => {
  if (!input.attachments || input.attachments.length === 0) {
    throw new Error("At least one attachment is required.");
  }

  return sendEmail(input);
};

/*
|--------------------------------------------------------------------------
| Bulk Email
|--------------------------------------------------------------------------
|
| Emails are processed with controlled concurrency.
| This prevents a large campaign from opening an
| uncontrolled number of SMTP operations.
|
|--------------------------------------------------------------------------
*/

export const sendBulkEmails = async (
  emails: readonly BulkEmailItem[],

  concurrency = DEFAULT_BULK_CONCURRENCY,
): Promise<BulkEmailResult> => {
  if (!Array.isArray(emails)) {
    throw new TypeError("Bulk email input must be an array.");
  }

  if (emails.length === 0) {
    return {
      total: 0,

      successful: 0,

      failed: 0,

      results: [],

      errors: [],
    };
  }

  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) {
    throw new RangeError("Bulk email concurrency must be between 1 and 10.");
  }

  const results: EmailSendResult[] = [];

  const errors: {
    index: number;
    error: unknown;
  }[] = [];

  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex++;

      if (index >= emails.length) {
        return;
      }

      try {
        const result = await sendEmail(emails[index]);

        results.push(result);
      } catch (error) {
        errors.push({
          index,

          error,
        });
      }
    }
  };

  const workerCount = Math.min(concurrency, emails.length);

  await Promise.all(
    Array.from(
      {
        length: workerCount,
      },
      () => worker(),
    ),
  );

  const successful = results.length;

  const failed = errors.length;

  logger.info(
    {
      total: emails.length,

      successful,

      failed,
    },
    "Bulk email operation completed.",
  );

  return {
    total: emails.length,

    successful,

    failed,

    results,

    errors,
  };
};

/*
|--------------------------------------------------------------------------
| Verify Email Service
|--------------------------------------------------------------------------
*/

export const verifyEmailService = async (): Promise<boolean> => {
  if (!isMailConfiguredStatus()) {
    logger.warn(
      "Email service verification skipped because SMTP is not configured.",
    );

    return false;
  }

  return verifyMailConnection();
};

/*
|--------------------------------------------------------------------------
| Email Service Health
|--------------------------------------------------------------------------
*/

export const checkEmailService = (): EmailServiceHealth => {
  const configured = isMailConfiguredStatus();

  return {
    configured,

    healthy: configured && isMailHealthy(),
  };
};
