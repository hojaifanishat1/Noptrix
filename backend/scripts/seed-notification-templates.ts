import { Types } from "mongoose";

import {
  NotificationTemplate,
  NOTIFICATION_TEMPLATE_CHANNELS,
  NOTIFICATION_TEMPLATE_STATUSES,
  type NotificationTemplateChannel,
} from "../src/modules/notifications/notification-template.model";

import { User } from "../src/modules/users/user.model";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

interface NotificationTemplateSeed {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly event: string;
  readonly channel: NotificationTemplateChannel;
  readonly locale: string;
  readonly title: string;
  readonly body: string;
  readonly variables: readonly string[];
}

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const DEFAULT_LOCALE = "en";

/*
|--------------------------------------------------------------------------
| Template Factory
|--------------------------------------------------------------------------
*/

const createChannelTemplates = (input: {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly event: string;
  readonly variables?: readonly string[];
  readonly inAppTitle: string;
  readonly inAppBody: string;
  readonly emailTitle: string;
  readonly emailBody: string;
  readonly pushTitle: string;
  readonly pushBody: string;
  readonly smsBody: string;
}): NotificationTemplateSeed[] => {
  const variables = input.variables ?? [];

  return [
    {
      key: input.key,
      name: `${input.name} — In-App`,
      description: `${input.description} In-app notification template.`,
      event: input.event,
      channel: NOTIFICATION_TEMPLATE_CHANNELS.IN_APP,
      locale: DEFAULT_LOCALE,
      title: input.inAppTitle,
      body: input.inAppBody,
      variables,
    },
    {
      key: input.key,
      name: `${input.name} — Email`,
      description: `${input.description} Email notification template.`,
      event: input.event,
      channel: NOTIFICATION_TEMPLATE_CHANNELS.EMAIL,
      locale: DEFAULT_LOCALE,
      title: input.emailTitle,
      body: input.emailBody,
      variables,
    },
    {
      key: input.key,
      name: `${input.name} — Push`,
      description: `${input.description} Push notification template.`,
      event: input.event,
      channel: NOTIFICATION_TEMPLATE_CHANNELS.PUSH,
      locale: DEFAULT_LOCALE,
      title: input.pushTitle,
      body: input.pushBody,
      variables,
    },
    {
      key: input.key,
      name: `${input.name} — SMS`,
      description: `${input.description} SMS notification template.`,
      event: input.event,
      channel: NOTIFICATION_TEMPLATE_CHANNELS.SMS,
      locale: DEFAULT_LOCALE,
      title: input.pushTitle,
      body: input.smsBody,
      variables,
    },
  ];
};

/*
|--------------------------------------------------------------------------
| Notification Templates
|--------------------------------------------------------------------------
|
| These are the global NOPTRIX notification templates.
|
| Variables use:
|
| {{variableName}}
|
|--------------------------------------------------------------------------
*/

const templates: NotificationTemplateSeed[] = [
  /*
    |--------------------------------------------------------------------------
    | Employee Invitation
    |--------------------------------------------------------------------------
    */

  ...createChannelTemplates({
    key: "employee.invitation.created",
    name: "Employee Invitation Created",
    description: "Sent when an employee invitation is created.",
    event: "EMPLOYEE_INVITATION_CREATED",
    variables: [
      "employeeName",
      "inviterName",
      "companyName",
      "roleName",
      "expiresAt",
      "actionUrl",
    ],
    inAppTitle: "You're invited to join {{companyName}}",
    inAppBody:
      "{{inviterName}} invited {{employeeName}} to join as {{roleName}}. Invitation expires {{expiresAt}}.",
    emailTitle: "You're invited to join {{companyName}}",
    emailBody:
      "Hello {{employeeName}},\n\n{{inviterName}} has invited you to join {{companyName}} as {{roleName}}.\n\nAccept your invitation here: {{actionUrl}}\n\nThis invitation expires {{expiresAt}}.",
    pushTitle: "Employee invitation",
    pushBody:
      "{{inviterName}} invited you to join {{companyName}} as {{roleName}}.",
    smsBody:
      "{{companyName}} invited you as {{roleName}}. Accept: {{actionUrl}}",
  }),

  ...createChannelTemplates({
    key: "employee.invitation.accepted",
    name: "Employee Invitation Accepted",
    description: "Sent when an employee accepts an invitation.",
    event: "EMPLOYEE_INVITATION_ACCEPTED",
    variables: ["employeeName", "companyName", "roleName", "actionUrl"],
    inAppTitle: "Employee invitation accepted",
    inAppBody:
      "{{employeeName}} accepted the invitation to join {{companyName}} as {{roleName}}.",
    emailTitle: "Employee invitation accepted",
    emailBody:
      "{{employeeName}} has accepted the invitation to join {{companyName}} as {{roleName}}.",
    pushTitle: "Invitation accepted",
    pushBody: "{{employeeName}} accepted the {{roleName}} invitation.",
    smsBody:
      "{{employeeName}} accepted the {{roleName}} invitation at {{companyName}}.",
  }),

  /*
    |--------------------------------------------------------------------------
    | Job Vacancy
    |--------------------------------------------------------------------------
    */

  ...createChannelTemplates({
    key: "job.vacancy.published",
    name: "Job Vacancy Published",
    description: "Sent when a job vacancy becomes publicly available.",
    event: "JOB_VACANCY_PUBLISHED",
    variables: ["vacancyTitle", "vacancySlug", "companyName", "actionUrl"],
    inAppTitle: "New job opportunity: {{vacancyTitle}}",
    inAppBody:
      "{{companyName}} is now accepting applications for {{vacancyTitle}}.",
    emailTitle: "New job opportunity: {{vacancyTitle}}",
    emailBody:
      "A new position is now available at {{companyName}}.\n\nPosition: {{vacancyTitle}}\n\nApply here: {{actionUrl}}",
    pushTitle: "New job opportunity",
    pushBody: "{{vacancyTitle}} is now accepting applications.",
    smsBody: "New job: {{vacancyTitle}}. Apply: {{actionUrl}}",
  }),

  ...createChannelTemplates({
    key: "job.vacancy.closed",
    name: "Job Vacancy Closed",
    description: "Sent when a job vacancy is closed.",
    event: "JOB_VACANCY_CLOSED",
    variables: ["vacancyTitle", "vacancySlug", "companyName"],
    inAppTitle: "Job vacancy closed",
    inAppBody:
      "The {{vacancyTitle}} position is no longer accepting applications.",
    emailTitle: "Job vacancy closed: {{vacancyTitle}}",
    emailBody:
      "The {{vacancyTitle}} position at {{companyName}} is now closed and is no longer accepting applications.",
    pushTitle: "Job vacancy closed",
    pushBody: "{{vacancyTitle}} is no longer accepting applications.",
    smsBody: "{{vacancyTitle}} is now closed.",
  }),

  /*
    |--------------------------------------------------------------------------
    | Job Application
    |--------------------------------------------------------------------------
    */

  ...createChannelTemplates({
    key: "job.application.submitted",
    name: "Job Application Submitted",
    description: "Sent when a job application is successfully submitted.",
    event: "JOB_APPLICATION_SUBMITTED",
    variables: ["applicantName", "vacancyTitle", "vacancySlug", "actionUrl"],
    inAppTitle: "Application submitted",
    inAppBody:
      "Your application for {{vacancyTitle}} has been submitted successfully.",
    emailTitle: "Application submitted: {{vacancyTitle}}",
    emailBody:
      "Hello {{applicantName}},\n\nYour application for {{vacancyTitle}} has been submitted successfully.\n\nView the vacancy: {{actionUrl}}",
    pushTitle: "Application submitted",
    pushBody:
      "Your application for {{vacancyTitle}} was submitted successfully.",
    smsBody: "Application submitted for {{vacancyTitle}}.",
  }),

  ...createChannelTemplates({
    key: "job.application.under_review",
    name: "Job Application Under Review",
    description: "Sent when an application enters review.",
    event: "JOB_APPLICATION_UNDER_REVIEW",
    variables: ["applicantName", "vacancyTitle", "vacancySlug", "actionUrl"],
    inAppTitle: "Application under review",
    inAppBody: "Your application for {{vacancyTitle}} is now under review.",
    emailTitle: "Your application is under review",
    emailBody:
      "Hello {{applicantName}},\n\nYour application for {{vacancyTitle}} is now under review.\n\nView the vacancy: {{actionUrl}}",
    pushTitle: "Application under review",
    pushBody: "Your application for {{vacancyTitle}} is under review.",
    smsBody: "Your application for {{vacancyTitle}} is under review.",
  }),

  ...createChannelTemplates({
    key: "job.application.shortlisted",
    name: "Job Application Shortlisted",
    description: "Sent when an applicant is shortlisted.",
    event: "JOB_APPLICATION_SHORTLISTED",
    variables: ["applicantName", "vacancyTitle", "vacancySlug", "actionUrl"],
    inAppTitle: "You've been shortlisted",
    inAppBody: "Your application for {{vacancyTitle}} has been shortlisted.",
    emailTitle: "You've been shortlisted for {{vacancyTitle}}",
    emailBody:
      "Hello {{applicantName}},\n\nWe're pleased to let you know that your application for {{vacancyTitle}} has been shortlisted.\n\nView details: {{actionUrl}}",
    pushTitle: "You've been shortlisted",
    pushBody: "Your application for {{vacancyTitle}} has been shortlisted.",
    smsBody: "Good news! You've been shortlisted for {{vacancyTitle}}.",
  }),

  ...createChannelTemplates({
    key: "job.application.interview",
    name: "Job Application Interview",
    description: "Sent when an applicant is invited to an interview.",
    event: "JOB_APPLICATION_INTERVIEW",
    variables: [
      "applicantName",
      "vacancyTitle",
      "vacancySlug",
      "interviewAt",
      "actionUrl",
    ],
    inAppTitle: "Interview scheduled",
    inAppBody:
      "Your interview for {{vacancyTitle}} is scheduled for {{interviewAt}}.",
    emailTitle: "Interview scheduled: {{vacancyTitle}}",
    emailBody:
      "Hello {{applicantName}},\n\nYour interview for {{vacancyTitle}} has been scheduled for {{interviewAt}}.\n\nView details: {{actionUrl}}",
    pushTitle: "Interview scheduled",
    pushBody:
      "Your {{vacancyTitle}} interview is scheduled for {{interviewAt}}.",
    smsBody:
      "Interview for {{vacancyTitle}}: {{interviewAt}}. Details: {{actionUrl}}",
  }),

  ...createChannelTemplates({
    key: "job.application.selected",
    name: "Job Application Selected",
    description: "Sent when an applicant is selected.",
    event: "JOB_APPLICATION_SELECTED",
    variables: ["applicantName", "vacancyTitle", "vacancySlug", "actionUrl"],
    inAppTitle: "Congratulations! You've been selected",
    inAppBody: "You have been selected for the {{vacancyTitle}} position.",
    emailTitle: "Congratulations — you've been selected",
    emailBody:
      "Hello {{applicantName}},\n\nCongratulations! You have been selected for the {{vacancyTitle}} position.\n\nView details: {{actionUrl}}",
    pushTitle: "Congratulations!",
    pushBody: "You've been selected for {{vacancyTitle}}.",
    smsBody: "Congratulations! You've been selected for {{vacancyTitle}}.",
  }),

  ...createChannelTemplates({
    key: "job.application.rejected",
    name: "Job Application Rejected",
    description: "Sent when an application is rejected.",
    event: "JOB_APPLICATION_REJECTED",
    variables: [
      "applicantName",
      "vacancyTitle",
      "vacancySlug",
      "rejectionReason",
      "actionUrl",
    ],
    inAppTitle: "Application update",
    inAppBody:
      "Your application for {{vacancyTitle}} was not selected. Reason: {{rejectionReason}}",
    emailTitle: "Application update: {{vacancyTitle}}",
    emailBody:
      "Hello {{applicantName}},\n\nThank you for applying for {{vacancyTitle}}. Unfortunately, your application was not selected.\n\nReason: {{rejectionReason}}\n\nView the vacancy: {{actionUrl}}",
    pushTitle: "Application update",
    pushBody: "Your application for {{vacancyTitle}} was not selected.",
    smsBody:
      "Your application for {{vacancyTitle}} was not selected. {{rejectionReason}}",
  }),

  ...createChannelTemplates({
    key: "job.application.withdrawn",
    name: "Job Application Withdrawn",
    description: "Sent when an application is withdrawn.",
    event: "JOB_APPLICATION_WITHDRAWN",
    variables: ["applicantName", "vacancyTitle", "vacancySlug", "actionUrl"],
    inAppTitle: "Application withdrawn",
    inAppBody: "Your application for {{vacancyTitle}} has been withdrawn.",
    emailTitle: "Application withdrawn: {{vacancyTitle}}",
    emailBody:
      "Your application for {{vacancyTitle}} has been withdrawn successfully.",
    pushTitle: "Application withdrawn",
    pushBody: "Your application for {{vacancyTitle}} has been withdrawn.",
    smsBody: "Your application for {{vacancyTitle}} has been withdrawn.",
  }),

  ...createChannelTemplates({
    key: "job.application.status_updated",
    name: "Job Application Status Updated",
    description:
      "Generic fallback notification for application status changes.",
    event: "JOB_APPLICATION_STATUS_UPDATED",
    variables: [
      "applicantName",
      "vacancyTitle",
      "vacancySlug",
      "status",
      "previousStatus",
      "actionUrl",
    ],
    inAppTitle: "Application status updated",
    inAppBody:
      "Your application for {{vacancyTitle}} changed from {{previousStatus}} to {{status}}.",
    emailTitle: "Application status updated",
    emailBody:
      "Hello {{applicantName}},\n\nYour application for {{vacancyTitle}} has changed from {{previousStatus}} to {{status}}.\n\nView details: {{actionUrl}}",
    pushTitle: "Application status updated",
    pushBody: "Your {{vacancyTitle}} application is now {{status}}.",
    smsBody: "Your {{vacancyTitle}} application changed to {{status}}.",
  }),

  /*
    |--------------------------------------------------------------------------
    | Orders
    |--------------------------------------------------------------------------
    */

  ...createChannelTemplates({
    key: "order.created",
    name: "Order Created",
    description: "Sent when a new order is created.",
    event: "ORDER_CREATED",
    variables: [
      "customerName",
      "orderNumber",
      "orderTotal",
      "currency",
      "actionUrl",
    ],
    inAppTitle: "Order placed",
    inAppBody: "Your order {{orderNumber}} has been placed successfully.",
    emailTitle: "Order {{orderNumber}} confirmed",
    emailBody:
      "Hello {{customerName}},\n\nYour order {{orderNumber}} has been placed successfully.\n\nTotal: {{orderTotal}} {{currency}}\n\nView order: {{actionUrl}}",
    pushTitle: "Order placed",
    pushBody: "Order {{orderNumber}} has been placed successfully.",
    smsBody:
      "Order {{orderNumber}} placed successfully. Total {{orderTotal}} {{currency}}.",
  }),

  ...createChannelTemplates({
    key: "order.confirmed",
    name: "Order Confirmed",
    description: "Sent when an order is confirmed.",
    event: "ORDER_CONFIRMED",
    variables: ["customerName", "orderNumber", "actionUrl"],
    inAppTitle: "Order confirmed",
    inAppBody: "Your order {{orderNumber}} has been confirmed.",
    emailTitle: "Order {{orderNumber}} confirmed",
    emailBody:
      "Your order {{orderNumber}} has been confirmed and is being prepared.",
    pushTitle: "Order confirmed",
    pushBody: "Order {{orderNumber}} is confirmed.",
    smsBody: "Order {{orderNumber}} is confirmed.",
  }),

  ...createChannelTemplates({
    key: "order.shipped",
    name: "Order Shipped",
    description: "Sent when an order is shipped.",
    event: "ORDER_SHIPPED",
    variables: ["customerName", "orderNumber", "trackingNumber", "actionUrl"],
    inAppTitle: "Order shipped",
    inAppBody: "Your order {{orderNumber}} has been shipped.",
    emailTitle: "Your order {{orderNumber}} has shipped",
    emailBody:
      "Your order {{orderNumber}} has been shipped.\n\nTracking number: {{trackingNumber}}\n\nTrack order: {{actionUrl}}",
    pushTitle: "Order shipped",
    pushBody: "Order {{orderNumber}} has been shipped.",
    smsBody: "Order {{orderNumber}} shipped. Tracking: {{trackingNumber}}.",
  }),

  ...createChannelTemplates({
    key: "order.delivered",
    name: "Order Delivered",
    description: "Sent when an order is delivered.",
    event: "ORDER_DELIVERED",
    variables: ["customerName", "orderNumber", "actionUrl"],
    inAppTitle: "Order delivered",
    inAppBody: "Your order {{orderNumber}} has been delivered.",
    emailTitle: "Order {{orderNumber}} delivered",
    emailBody: "Your order {{orderNumber}} has been delivered successfully.",
    pushTitle: "Order delivered",
    pushBody: "Order {{orderNumber}} has been delivered.",
    smsBody: "Order {{orderNumber}} has been delivered.",
  }),

  ...createChannelTemplates({
    key: "order.cancelled",
    name: "Order Cancelled",
    description: "Sent when an order is cancelled.",
    event: "ORDER_CANCELLED",
    variables: [
      "customerName",
      "orderNumber",
      "cancellationReason",
      "actionUrl",
    ],
    inAppTitle: "Order cancelled",
    inAppBody: "Your order {{orderNumber}} has been cancelled.",
    emailTitle: "Order {{orderNumber}} cancelled",
    emailBody:
      "Your order {{orderNumber}} has been cancelled.\n\nReason: {{cancellationReason}}",
    pushTitle: "Order cancelled",
    pushBody: "Order {{orderNumber}} has been cancelled.",
    smsBody: "Order {{orderNumber}} has been cancelled. {{cancellationReason}}",
  }),

  /*
    |--------------------------------------------------------------------------
    | Payment
    |--------------------------------------------------------------------------
    */

  ...createChannelTemplates({
    key: "payment.pending",
    name: "Payment Pending",
    description: "Sent when a payment is pending.",
    event: "PAYMENT_PENDING",
    variables: [
      "customerName",
      "orderNumber",
      "paymentId",
      "amount",
      "currency",
      "actionUrl",
    ],
    inAppTitle: "Payment pending",
    inAppBody: "Payment for order {{orderNumber}} is currently pending.",
    emailTitle: "Payment pending for order {{orderNumber}}",
    emailBody:
      "Payment {{paymentId}} for order {{orderNumber}} is currently pending.\n\nAmount: {{amount}} {{currency}}",
    pushTitle: "Payment pending",
    pushBody: "Payment for order {{orderNumber}} is pending.",
    smsBody: "Payment for order {{orderNumber}} is pending.",
  }),

  ...createChannelTemplates({
    key: "payment.success",
    name: "Payment Successful",
    description: "Sent when a payment succeeds.",
    event: "PAYMENT_SUCCESS",
    variables: [
      "customerName",
      "orderNumber",
      "paymentId",
      "amount",
      "currency",
      "actionUrl",
    ],
    inAppTitle: "Payment successful",
    inAppBody: "Payment for order {{orderNumber}} was successful.",
    emailTitle: "Payment successful for order {{orderNumber}}",
    emailBody:
      "Your payment of {{amount}} {{currency}} for order {{orderNumber}} was successful.\n\nPayment ID: {{paymentId}}",
    pushTitle: "Payment successful",
    pushBody: "Payment for order {{orderNumber}} was successful.",
    smsBody:
      "Payment successful for order {{orderNumber}}: {{amount}} {{currency}}.",
  }),

  ...createChannelTemplates({
    key: "payment.failed",
    name: "Payment Failed",
    description: "Sent when a payment fails.",
    event: "PAYMENT_FAILED",
    variables: [
      "customerName",
      "orderNumber",
      "paymentId",
      "amount",
      "currency",
      "failureReason",
      "actionUrl",
    ],
    inAppTitle: "Payment failed",
    inAppBody: "Payment for order {{orderNumber}} could not be completed.",
    emailTitle: "Payment failed for order {{orderNumber}}",
    emailBody:
      "We could not complete your payment for order {{orderNumber}}.\n\nReason: {{failureReason}}\n\nPlease try again: {{actionUrl}}",
    pushTitle: "Payment failed",
    pushBody: "Payment for order {{orderNumber}} failed.",
    smsBody: "Payment failed for order {{orderNumber}}. {{failureReason}}",
  }),

  ...createChannelTemplates({
    key: "payment.refunded",
    name: "Payment Refunded",
    description: "Sent when a payment is refunded.",
    event: "PAYMENT_REFUNDED",
    variables: [
      "customerName",
      "orderNumber",
      "refundAmount",
      "currency",
      "actionUrl",
    ],
    inAppTitle: "Payment refunded",
    inAppBody:
      "A refund of {{refundAmount}} {{currency}} has been processed for order {{orderNumber}}.",
    emailTitle: "Refund processed for order {{orderNumber}}",
    emailBody:
      "A refund of {{refundAmount}} {{currency}} has been processed for order {{orderNumber}}.",
    pushTitle: "Refund processed",
    pushBody: "A refund has been processed for order {{orderNumber}}.",
    smsBody:
      "Refund of {{refundAmount}} {{currency}} processed for order {{orderNumber}}.",
  }),

  /*
    |--------------------------------------------------------------------------
    | Delivery
    |--------------------------------------------------------------------------
    */

  ...createChannelTemplates({
    key: "delivery.assigned",
    name: "Delivery Assigned",
    description: "Sent when a delivery is assigned.",
    event: "DELIVERY_ASSIGNED",
    variables: ["customerName", "orderNumber", "riderName", "actionUrl"],
    inAppTitle: "Delivery assigned",
    inAppBody: "{{riderName}} is handling delivery for order {{orderNumber}}.",
    emailTitle: "Delivery assigned for order {{orderNumber}}",
    emailBody:
      "Your order {{orderNumber}} has been assigned to {{riderName}} for delivery.",
    pushTitle: "Delivery assigned",
    pushBody: "{{riderName}} is handling your order {{orderNumber}}.",
    smsBody: "Order {{orderNumber}} delivery assigned to {{riderName}}.",
  }),

  ...createChannelTemplates({
    key: "delivery.picked_up",
    name: "Delivery Picked Up",
    description: "Sent when a rider picks up an order.",
    event: "DELIVERY_PICKED_UP",
    variables: ["customerName", "orderNumber", "riderName", "actionUrl"],
    inAppTitle: "Order picked up",
    inAppBody: "{{riderName}} has picked up your order {{orderNumber}}.",
    emailTitle: "Order {{orderNumber}} picked up",
    emailBody:
      "Your order {{orderNumber}} has been picked up and is on its way.",
    pushTitle: "Order picked up",
    pushBody: "Order {{orderNumber}} is on its way.",
    smsBody: "Order {{orderNumber}} has been picked up.",
  }),

  ...createChannelTemplates({
    key: "delivery.delivered",
    name: "Delivery Completed",
    description: "Sent when a delivery is completed.",
    event: "DELIVERY_DELIVERED",
    variables: ["customerName", "orderNumber", "actionUrl"],
    inAppTitle: "Delivery completed",
    inAppBody: "Your order {{orderNumber}} has been delivered.",
    emailTitle: "Order {{orderNumber}} delivered",
    emailBody: "Your order {{orderNumber}} has been successfully delivered.",
    pushTitle: "Delivered",
    pushBody: "Order {{orderNumber}} has been delivered.",
    smsBody: "Order {{orderNumber}} delivered successfully.",
  }),

  /*
    |--------------------------------------------------------------------------
    | Seller
    |--------------------------------------------------------------------------
    */

  ...createChannelTemplates({
    key: "seller.invitation.created",
    name: "Seller Invitation Created",
    description: "Sent when an approved seller applicant receives an invitation.",
    event: "SELLER_INVITATION_CREATED",
    variables: [
      "sellerName",
      "businessName",
      "sellerType",
      "companyName",
      "invitationUrl",
      "expiresAt",
    ],
    inAppTitle: "Your Seller invitation is ready",
    inAppBody:
      "{{companyName}} has approved {{businessName}}. Accept your invitation to create your Seller account.",
    emailTitle: "Your {{companyName}} Seller invitation",
    emailBody:
      "Hello {{sellerName}},\\n\\nYour seller application has been approved.\\n\\nBusiness: {{businessName}}\\nSeller type: {{sellerType}}\\n\\nCreate your separate Seller account here: {{invitationUrl}}\\n\\nThis invitation expires on {{expiresAt}}.\\n\\nYour Seller account becomes ACTIVE after you accept the invitation and create your password. Selling access remains subject to completion of the required onboarding.",
    pushTitle: "Seller invitation received",
    pushBody:
      "{{companyName}} invited you to create a Seller account for {{businessName}}.",
    smsBody:
      "Your {{companyName}} Seller invitation is ready. Accept here: {{invitationUrl}}",
  }),

  ...createChannelTemplates({
    key: "seller.approved",
    name: "Seller Approved",
    description: "Sent when a seller application is approved.",
    event: "SELLER_APPROVED",
    variables: ["sellerName", "businessName", "actionUrl"],
    inAppTitle: "Seller account approved",
    inAppBody: "{{businessName}} has been approved as a NOPTRIX seller.",
    emailTitle: "Your seller account has been approved",
    emailBody:
      "Congratulations {{sellerName}},\n\n{{businessName}} has been approved as a NOPTRIX seller.\n\nAccess your seller dashboard: {{actionUrl}}",
    pushTitle: "Seller account approved",
    pushBody: "{{businessName}} has been approved.",
    smsBody: "{{businessName}} seller account approved. Login: {{actionUrl}}",
  }),

  ...createChannelTemplates({
    key: "seller.suspended",
    name: "Seller Suspended",
    description: "Sent when a seller account is suspended.",
    event: "SELLER_SUSPENDED",
    variables: ["sellerName", "businessName", "suspensionReason", "actionUrl"],
    inAppTitle: "Seller account suspended",
    inAppBody:
      "{{businessName}} has been suspended. Reason: {{suspensionReason}}",
    emailTitle: "Seller account suspended",
    emailBody:
      "Hello {{sellerName}},\n\nYour seller account for {{businessName}} has been suspended.\n\nReason: {{suspensionReason}}",
    pushTitle: "Seller account suspended",
    pushBody: "{{businessName}} has been suspended.",
    smsBody: "{{businessName}} seller account suspended. {{suspensionReason}}",
  }),

  /*
    |--------------------------------------------------------------------------
    | Rider
    |--------------------------------------------------------------------------
    */

  ...createChannelTemplates({
    key: "rider.assigned",
    name: "Rider Assigned",
    description: "Sent when a rider is assigned a delivery.",
    event: "RIDER_ASSIGNED",
    variables: ["riderName", "orderNumber", "deliveryAddress", "actionUrl"],
    inAppTitle: "New delivery assigned",
    inAppBody: "Order {{orderNumber}} has been assigned to you.",
    emailTitle: "New delivery assigned: {{orderNumber}}",
    emailBody:
      "Hello {{riderName}},\n\nYou have been assigned order {{orderNumber}} for delivery.\n\nDelivery address: {{deliveryAddress}}",
    pushTitle: "New delivery",
    pushBody: "Order {{orderNumber}} has been assigned to you.",
    smsBody: "New delivery {{orderNumber}} assigned to you.",
  }),

  ...createChannelTemplates({
    key: "rider.payout.completed",
    name: "Rider Payout Completed",
    description: "Sent when a rider payout is completed.",
    event: "RIDER_PAYOUT_COMPLETED",
    variables: [
      "riderName",
      "payoutAmount",
      "currency",
      "payoutId",
      "actionUrl",
    ],
    inAppTitle: "Payout completed",
    inAppBody:
      "Your payout of {{payoutAmount}} {{currency}} has been completed.",
    emailTitle: "Rider payout completed",
    emailBody:
      "Hello {{riderName}},\n\nYour payout of {{payoutAmount}} {{currency}} has been completed.\n\nPayout ID: {{payoutId}}",
    pushTitle: "Payout completed",
    pushBody: "Your {{payoutAmount}} {{currency}} payout is complete.",
    smsBody: "Payout {{payoutId}} completed: {{payoutAmount}} {{currency}}.",
  }),

  /*
    |--------------------------------------------------------------------------
    | Promotion
    |--------------------------------------------------------------------------
    */

  ...createChannelTemplates({
    key: "promotion.published",
    name: "Promotion Published",
    description: "Sent when a promotion becomes available.",
    event: "PROMOTION_PUBLISHED",
    variables: ["promotionName", "promotionCode", "discount", "actionUrl"],
    inAppTitle: "{{promotionName}} is now live",
    inAppBody: "Use code {{promotionCode}} and enjoy {{discount}}.",
    emailTitle: "New promotion: {{promotionName}}",
    emailBody:
      "{{promotionName}} is now live.\n\nUse code {{promotionCode}} to enjoy {{discount}}.\n\nShop now: {{actionUrl}}",
    pushTitle: "New promotion",
    pushBody: "{{promotionName}} is now live. Use {{promotionCode}}.",
    smsBody:
      "{{promotionName}}: {{discount}} with code {{promotionCode}}. {{actionUrl}}",
  }),

  /*
    |--------------------------------------------------------------------------
    | Security
    |--------------------------------------------------------------------------
    */

  {
    key: "security.otp_verification",
    name: "OTP Verification — Email",
    description: "Sent when a verification code is delivered by email.",
    event: "SECURITY_OTP_VERIFICATION",
    channel: NOTIFICATION_TEMPLATE_CHANNELS.EMAIL,
    locale: DEFAULT_LOCALE,
    title: "Your NOPTRIX verification code",
    body: "NOPTRIX Verification\n\nYour {{purpose}} code is: {{code}}\n\nThis code expires in {{expiryMinutes}} minutes.\nIf you did not request this code, you can safely ignore this email.\n\nNOPTRIX Security",
    variables: ["code", "purpose", "expiryMinutes"],
  },

  ...createChannelTemplates({
    key: "security.login_new_device",
    name: "New Device Login",
    description: "Sent when an account is accessed from a new device.",
    event: "SECURITY_LOGIN_NEW_DEVICE",
    variables: ["userName", "deviceName", "location", "loginAt", "actionUrl"],
    inAppTitle: "New device sign-in",
    inAppBody: "Your account was accessed from {{deviceName}} at {{loginAt}}.",
    emailTitle: "New sign-in to your NOPTRIX account",
    emailBody:
      "Hello {{userName}},\n\nYour account was accessed from a new device.\n\nDevice: {{deviceName}}\nLocation: {{location}}\nTime: {{loginAt}}\n\nIf this wasn't you, secure your account: {{actionUrl}}",
    pushTitle: "New sign-in",
    pushBody: "Your account was accessed from {{deviceName}}.",
    smsBody:
      "NOPTRIX security alert: new sign-in from {{deviceName}} at {{loginAt}}.",
  }),

  ...createChannelTemplates({
    key: "security.password_changed",
    name: "Password Changed",
    description: "Sent when an account password is changed.",
    event: "SECURITY_PASSWORD_CHANGED",
    variables: ["userName", "changedAt", "actionUrl"],
    inAppTitle: "Password changed",
    inAppBody: "Your password was changed successfully.",
    emailTitle: "Your NOPTRIX password was changed",
    emailBody:
      "Hello {{userName}},\n\nYour password was changed at {{changedAt}}.\n\nIf you did not make this change, secure your account immediately: {{actionUrl}}",
    pushTitle: "Password changed",
    pushBody: "Your NOPTRIX password was changed.",
    smsBody:
      "NOPTRIX security alert: your password was changed at {{changedAt}}.",
  }),

  /*
    |--------------------------------------------------------------------------
    | Announcement
    |--------------------------------------------------------------------------
    */

  ...createChannelTemplates({
    key: "announcement.published",
    name: "Announcement Published",
    description: "General platform announcement.",
    event: "ANNOUNCEMENT_PUBLISHED",
    variables: ["announcementTitle", "announcementBody", "actionUrl"],
    inAppTitle: "{{announcementTitle}}",
    inAppBody: "{{announcementBody}}",
    emailTitle: "{{announcementTitle}}",
    emailBody: "{{announcementBody}}\n\nRead more: {{actionUrl}}",
    pushTitle: "{{announcementTitle}}",
    pushBody: "{{announcementBody}}",
    smsBody: "{{announcementTitle}}: {{announcementBody}}",
  }),

  /*
    |--------------------------------------------------------------------------
    | System
    |--------------------------------------------------------------------------
    */

  ...createChannelTemplates({
    key: "system.general",
    name: "General System Notification",
    description: "Generic system notification template.",
    event: "SYSTEM_GENERAL",
    variables: ["userName", "systemMessage", "actionUrl"],
    inAppTitle: "NOPTRIX notification",
    inAppBody: "{{systemMessage}}",
    emailTitle: "NOPTRIX notification",
    emailBody: "Hello {{userName}},\n\n{{systemMessage}}\n\n{{actionUrl}}",
    pushTitle: "NOPTRIX notification",
    pushBody: "{{systemMessage}}",
    smsBody: "NOPTRIX: {{systemMessage}}",
  }),
];

/*
|--------------------------------------------------------------------------
| Find Seed Owner
|--------------------------------------------------------------------------
*/

export const getNotificationTemplateSeedOwnerId =
  async (): Promise<Types.ObjectId> => {
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();

    if (!ownerEmail) {
      throw new Error(
        "OWNER_EMAIL is required for notification template seeding.",
      );
    }

    const ownerUser = await User.findOne({
      email: ownerEmail,
    })
      .select("_id")
      .lean()
      .exec();

    if (!ownerUser) {
      throw new Error(
        `Owner user not found for ${ownerEmail}. Run the main seed first.`,
      );
    }

    return ownerUser._id;
  };

/*
|--------------------------------------------------------------------------
| Seed Templates
|--------------------------------------------------------------------------
*/

export const seedNotificationTemplates = async (
  ownerUserId: Types.ObjectId,
  onlyKeys?: readonly string[],
): Promise<void> => {
  let created = 0;
  let updated = 0;

  const selectedTemplates = onlyKeys
    ? templates.filter((template) => onlyKeys.includes(template.key))
    : templates;

  if (onlyKeys && selectedTemplates.length === 0) {
    throw new Error("No matching notification templates were found.");
  }

  for (const template of selectedTemplates) {
    const existing = await NotificationTemplate.findOne({
      key: template.key,
      channel: template.channel,
      locale: template.locale,
    })
      .select("_id")
      .lean()
      .exec();

    await NotificationTemplate.updateOne(
      {
        key: template.key,
        channel: template.channel,
        locale: template.locale,
      },
      {
        $set: {
          name: template.name,
          description: template.description,
          event: template.event,
          title: template.title,
          body: template.body,
          variables: [...template.variables],
          status: NOTIFICATION_TEMPLATE_STATUSES.ACTIVE,
          updatedBy: ownerUserId,
        },
        $setOnInsert: {
          key: template.key,
          channel: template.channel,
          locale: template.locale,
          createdBy: ownerUserId,
        },
      },
      {
        upsert: true,
      },
    ).exec();

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  console.log(`Notification templates created: ${created}`);

  console.log(`Notification templates updated: ${updated}`);

  console.log(`Notification templates processed: ${selectedTemplates.length}`);
};
