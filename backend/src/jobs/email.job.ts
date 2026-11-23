import { Queue, type JobsOptions } from "bullmq";

import { getRedisClient } from "../config/redis";

import { logger } from "../utils/logger";

/*
|--------------------------------------------------------------------------
| Email Job Types
|--------------------------------------------------------------------------
*/

export type EmailJobName =
  | "email.send"
  | "email.template"
  | "email.verification"
  | "email.password-reset"
  | "email.order-confirmation"
  | "email.order-update"
  | "email.invoice"
  | "email.bulk";

export type EmailJobEvent =
  | "send"
  | "template"
  | "verification"
  | "password-reset"
  | "order-confirmation"
  | "order-update"
  | "invoice"
  | "bulk";

export type EmailPriority = "low" | "normal" | "high" | "critical";

/*
|--------------------------------------------------------------------------
| Email Recipient
|--------------------------------------------------------------------------
*/

export interface EmailRecipient {
  email: string;

  name?: string;
}

/*
|--------------------------------------------------------------------------
| Email Attachment
|--------------------------------------------------------------------------
*/

export interface EmailAttachment {
  filename: string;

  content?: string | Buffer;

  path?: string;

  contentType?: string;

  cid?: string;
}

/*
|--------------------------------------------------------------------------
| Email Job Data
|--------------------------------------------------------------------------
*/

export interface EmailJobData {
  emailId?: string;

  recipient: EmailRecipient;

  cc?: EmailRecipient[];

  bcc?: EmailRecipient[];

  event: EmailJobEvent;

  priority: EmailPriority;

  subject: string;

  templateId?: string;

  templateData?: Record<string, unknown>;

  html?: string;

  text?: string;

  attachments?: EmailAttachment[];

  timestamp: string;

  metadata?: Record<string, unknown>;
}

/*
|--------------------------------------------------------------------------
| Queue Configuration
|--------------------------------------------------------------------------
*/

const EMAIL_QUEUE_NAME = "noptrix-email-queue";

/*
|--------------------------------------------------------------------------
| Default Job Options
|--------------------------------------------------------------------------
*/

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,

  backoff: {
    type: "exponential",
    delay: 3_000,
  },

  removeOnComplete: {
    age: 60 * 60 * 24,

    count: 2_000,
  },

  removeOnFail: {
    age: 60 * 60 * 24 * 7,

    count: 10_000,
  },
};

/*
|--------------------------------------------------------------------------
| Email Queue
|--------------------------------------------------------------------------
*/

let emailQueue: Queue<EmailJobData> | null = null;

/*
|--------------------------------------------------------------------------
| Get Email Queue
|--------------------------------------------------------------------------
*/

const getEmailQueue = (): Queue<EmailJobData> => {
  if (emailQueue) {
    return emailQueue;
  }

  const redis = getRedisClient();

  emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
    connection: redis,

    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  logger.info(
    {
      queue: EMAIL_QUEUE_NAME,
    },
    "Email queue initialized.",
  );

  return emailQueue;
};

/*
|--------------------------------------------------------------------------
| Build Deterministic Job ID
|--------------------------------------------------------------------------
*/

const buildEmailJobId = (
  emailId: string | undefined,
  event: EmailJobEvent,
  recipient: EmailRecipient,
): string => {
  const recipientKey = recipient.email.trim().toLowerCase();

  return ["email", emailId ?? recipientKey, event].join(":");
};

/*
|--------------------------------------------------------------------------
| Add Email Job
|--------------------------------------------------------------------------
*/

export const addEmailJob = async (
  jobName: EmailJobName,
  data: EmailJobData,
  options?: JobsOptions,
) => {
  const queue = getEmailQueue();

  const jobId = buildEmailJobId(data.emailId, data.event, data.recipient);

  const priority =
    data.priority === "critical"
      ? 1
      : data.priority === "high"
        ? 3
        : data.priority === "normal"
          ? 5
          : 10;

  const job = await queue.add(jobName, data, {
    ...options,

    jobId: options?.jobId ?? jobId,

    priority,
  });

  logger.info(
    {
      queue: EMAIL_QUEUE_NAME,

      jobId: job.id,

      jobName,

      emailId: data.emailId,

      recipient: data.recipient.email,

      event: data.event,

      priority: data.priority,
    },
    "Email job added.",
  );

  return job;
};

/*
|--------------------------------------------------------------------------
| Generic Email
|--------------------------------------------------------------------------
*/

export const enqueueEmail = async (
  recipient: EmailRecipient,
  subject: string,
  options?: {
    emailId?: string;

    cc?: EmailRecipient[];

    bcc?: EmailRecipient[];

    html?: string;

    text?: string;

    attachments?: EmailAttachment[];

    priority?: EmailPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addEmailJob("email.send", {
    emailId: options?.emailId,

    recipient,

    cc: options?.cc,

    bcc: options?.bcc,

    event: "send",

    priority: options?.priority ?? "normal",

    subject,

    html: options?.html,

    text: options?.text,

    attachments: options?.attachments,

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Template Email
|--------------------------------------------------------------------------
*/

export const enqueueTemplateEmail = async (
  recipient: EmailRecipient,
  templateId: string,
  templateData: Record<string, unknown>,
  subject: string,
  options?: {
    emailId?: string;

    priority?: EmailPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addEmailJob("email.template", {
    emailId: options?.emailId,

    recipient,

    event: "template",

    priority: options?.priority ?? "normal",

    subject,

    templateId,

    templateData,

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Verification Email
|--------------------------------------------------------------------------
*/

export const enqueueVerificationEmail = async (
  recipient: EmailRecipient,
  verificationCode: string,
  options?: {
    emailId?: string;

    priority?: EmailPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addEmailJob("email.verification", {
    emailId: options?.emailId,

    recipient,

    event: "verification",

    priority: options?.priority ?? "high",

    subject: "Verify your NOPTRIX account",

    templateId: "verification",

    templateData: {
      verificationCode,
    },

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Password Reset Email
|--------------------------------------------------------------------------
*/

export const enqueuePasswordResetEmail = async (
  recipient: EmailRecipient,
  resetToken: string,
  options?: {
    emailId?: string;

    priority?: EmailPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addEmailJob("email.password-reset", {
    emailId: options?.emailId,

    recipient,

    event: "password-reset",

    priority: options?.priority ?? "high",

    subject: "Reset your NOPTRIX password",

    templateId: "password-reset",

    templateData: {
      resetToken,
    },

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Order Confirmation Email
|--------------------------------------------------------------------------
*/

export const enqueueOrderConfirmationEmail = async (
  recipient: EmailRecipient,
  orderId: string,
  options?: {
    emailId?: string;

    priority?: EmailPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addEmailJob("email.order-confirmation", {
    emailId: options?.emailId,

    recipient,

    event: "order-confirmation",

    priority: options?.priority ?? "high",

    subject: `NOPTRIX Order Confirmation - ${orderId}`,

    templateId: "order-confirmation",

    templateData: {
      orderId,
    },

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Order Update Email
|--------------------------------------------------------------------------
*/

export const enqueueOrderUpdateEmail = async (
  recipient: EmailRecipient,
  orderId: string,
  status: string,
  options?: {
    emailId?: string;

    priority?: EmailPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addEmailJob("email.order-update", {
    emailId: options?.emailId,

    recipient,

    event: "order-update",

    priority: options?.priority ?? "normal",

    subject: `NOPTRIX Order Update - ${orderId}`,

    templateId: "order-update",

    templateData: {
      orderId,
      status,
    },

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Invoice Email
|--------------------------------------------------------------------------
*/

export const enqueueInvoiceEmail = async (
  recipient: EmailRecipient,
  invoiceId: string,
  options?: {
    emailId?: string;

    attachments?: EmailAttachment[];

    priority?: EmailPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return addEmailJob("email.invoice", {
    emailId: options?.emailId,

    recipient,

    event: "invoice",

    priority: options?.priority ?? "normal",

    subject: `NOPTRIX Invoice - ${invoiceId}`,

    templateId: "invoice",

    templateData: {
      invoiceId,
    },

    attachments: options?.attachments,

    timestamp: new Date().toISOString(),

    metadata: options?.metadata,
  });
};

/*
|--------------------------------------------------------------------------
| Bulk Email
|--------------------------------------------------------------------------
*/

export const enqueueBulkEmail = async (
  recipients: EmailRecipient[],
  subject: string,
  options?: {
    templateId?: string;

    templateData?: Record<string, unknown>;

    html?: string;

    text?: string;

    priority?: EmailPriority;

    metadata?: Record<string, unknown>;
  },
) => {
  return Promise.all(
    recipients.map((recipient) =>
      addEmailJob("email.bulk", {
        recipient,

        event: "bulk",

        priority: options?.priority ?? "normal",

        subject,

        templateId: options?.templateId,

        templateData: options?.templateData,

        html: options?.html,

        text: options?.text,

        timestamp: new Date().toISOString(),

        metadata: options?.metadata,
      }),
    ),
  );
};

/*
|--------------------------------------------------------------------------
| Queue Health
|--------------------------------------------------------------------------
*/

export const getEmailQueueHealth = async () => {
  const queue = getEmailQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),

    queue.getActiveCount(),

    queue.getCompletedCount(),

    queue.getFailedCount(),

    queue.getDelayedCount(),
  ]);

  return {
    queue: EMAIL_QUEUE_NAME,

    waiting,

    active,

    completed,

    failed,

    delayed,
  };
};

/*
|--------------------------------------------------------------------------
| Close Email Queue
|--------------------------------------------------------------------------
*/

export const closeEmailQueue = async (): Promise<void> => {
  if (!emailQueue) {
    return;
  }

  await emailQueue.close();

  emailQueue = null;

  logger.info(
    {
      queue: EMAIL_QUEUE_NAME,
    },
    "Email queue closed.",
  );
};

// Owner-only operational access; route authorization is enforced by system-monitoring.
export const getAdminEmailQueue = getEmailQueue;
