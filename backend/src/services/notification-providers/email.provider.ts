import { User } from "../../modules/users/user.model";

import { sendEmail } from "../email.service";

import {
  renderNotificationTemplateByEvent,
} from "../../modules/notifications/notification-template.service";

import {
  registerNotificationProvider,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_STATUSES,
  type NotificationProviderAdapter,
  type NotificationChannelResult,
} from "../notification.service";

import type { Notification } from "../notification.service";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/*
|--------------------------------------------------------------------------
| Email Notification Provider
|--------------------------------------------------------------------------
*/

const emailNotificationProvider: NotificationProviderAdapter = {
  channel: NOTIFICATION_CHANNELS.EMAIL,

  async send({
    notification,
  }: {
    notification: Notification;
    channel: typeof NOTIFICATION_CHANNELS.EMAIL;
  }): Promise<NotificationChannelResult> {
    /*
        |--------------------------------------------------------------------------
        | Resolve Recipient
        |--------------------------------------------------------------------------
        */

    let recipientEmail = notification.recipient.email?.trim().toLowerCase();

    if (!recipientEmail && notification.recipient.userId) {
      const user = await User.findById(notification.recipient.userId)
        .select("email status")
        .lean();

      if (user && user.status === "ACTIVE" && typeof user.email === "string") {
        recipientEmail = user.email.trim().toLowerCase();
      }
    }

    if (!recipientEmail) {
      return {
        channel: NOTIFICATION_CHANNELS.EMAIL,

        status: NOTIFICATION_DELIVERY_STATUSES.FAILED,

        errorCode: "NOTIFICATION_RECIPIENT_EMAIL_MISSING",

        errorMessage: "No valid recipient email address was found.",
      };
    }

    /*
        |--------------------------------------------------------------------------
        | Default Notification Content
        |--------------------------------------------------------------------------
        |
        | Existing notification content remains
        | the fallback if template rendering fails.
        |
        */

    const subject = notification.content.title;

    const message = notification.content.body;

    /*
        |--------------------------------------------------------------------------
        | Template Metadata
        |--------------------------------------------------------------------------
        */

    const metadata = notification.metadata ?? {};

    const templateKey =
      typeof metadata.templateKey === "string"
        ? metadata.templateKey.trim()
        : "";

    const templateLocale =
      typeof metadata.templateLocale === "string"
        ? metadata.templateLocale.trim()
        : undefined;

    const templateVariables =
      metadata.templateVariables &&
      typeof metadata.templateVariables === "object" &&
      !Array.isArray(metadata.templateVariables)
        ? (metadata.templateVariables as Record<string, unknown>)
        : {};

    /*
        |--------------------------------------------------------------------------
        | Send Email
        |--------------------------------------------------------------------------
        */

    try {
      let finalSubject = subject;
      let finalMessage = message;
      let eventTemplateResolved = false;

      const templateEvent =
        typeof metadata.templateEvent === "string"
          ? metadata.templateEvent.trim()
          : "";

      if (templateEvent) {
        const rendered = await renderNotificationTemplateByEvent({
          event: templateEvent,
          channel: NOTIFICATION_CHANNELS.EMAIL,
          locale: templateLocale ?? "en",
          variables: templateVariables,
        });

        if (rendered) {
          finalSubject = rendered.title;
          finalMessage = rendered.message;
          eventTemplateResolved = true;
        }
      }

      const htmlMessage = escapeHtml(finalMessage).replace(/\n/g, "<br />");

      const result = await sendEmail({
        to: recipientEmail,

        subject: finalSubject.trim(),

        text: finalMessage,

        html: htmlMessage,

        templateKey: eventTemplateResolved
          ? undefined
          : templateKey || undefined,

        templateLocale,

        templateVariables,
      });

      /*
            |--------------------------------------------------------------------------
            | Delivery Success
            |--------------------------------------------------------------------------
            */

      return {
        channel: NOTIFICATION_CHANNELS.EMAIL,

        status: NOTIFICATION_DELIVERY_STATUSES.SENT,

        sentAt: new Date(),

        provider: "resend",

        providerMessageId: result.messageId,
      };
    } catch (error) {
      /*
            |--------------------------------------------------------------------------
            | Delivery Failure
            |--------------------------------------------------------------------------
            */

      const errorMessage =
        error instanceof Error ? error.message : "Email delivery failed.";

      console.error(
        {
          error,
          recipientEmail,
          templateKey,
          templateEvent:
            typeof metadata.templateEvent === "string"
              ? metadata.templateEvent
              : undefined,
        },
        "Notification email delivery failed.",
      );

      return {
        channel: NOTIFICATION_CHANNELS.EMAIL,

        status: NOTIFICATION_DELIVERY_STATUSES.FAILED,

        errorCode: "NOTIFICATION_EMAIL_SEND_FAILED",

        errorMessage,
      };
    }
  },
};

/*
|--------------------------------------------------------------------------
| Register Provider
|--------------------------------------------------------------------------
*/

export const registerEmailNotificationProvider = (): void => {
  registerNotificationProvider(emailNotificationProvider);
};
