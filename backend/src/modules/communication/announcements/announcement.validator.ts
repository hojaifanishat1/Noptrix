import { z } from "zod";

/*
|--------------------------------------------------------------------------
| Common Schemas
|--------------------------------------------------------------------------
*/

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid ID.");

const attachmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Attachment name is required.")
    .max(255, "Attachment name cannot exceed 255 characters."),

  url: z.string().trim().url("Invalid attachment URL."),

  mimeType: z
    .string()
    .trim()
    .min(1, "Attachment MIME type is required.")
    .max(150, "Attachment MIME type cannot exceed 150 characters."),

  size: z.number().int().min(0, "Attachment size cannot be negative."),
});

/*
|--------------------------------------------------------------------------
| Create Announcement
|--------------------------------------------------------------------------
*/

export const createAnnouncementSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Announcement title is required.")
      .max(250, "Announcement title cannot exceed 250 characters."),

    body: z
      .string()
      .trim()
      .min(1, "Announcement body is required.")
      .max(20000, "Announcement body cannot exceed 20000 characters."),

    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),

    targetType: z.enum(["ALL_ADMINS", "ALL_RIDERS", "RIDERS", "ROLES", "USERS"]),

    targetRoleIds: z
      .array(objectIdSchema)
      .max(50, "An announcement cannot target more than 50 roles.")
      .optional(),

    targetUserIds: z
      .array(objectIdSchema)
      .max(500, "An announcement cannot target more than 500 users.")
      .optional(),

    targetRiderIds: z
      .array(objectIdSchema)
      .max(500, "An announcement cannot target more than 500 riders.")
      .optional(),

    scheduledAt: z.coerce.date().optional(),

    expiresAt: z.coerce.date().optional(),

    attachments: z
      .array(attachmentSchema)
      .max(10, "An announcement cannot contain more than 10 attachments.")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.targetType === "ROLES" &&
      (!data.targetRoleIds || data.targetRoleIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetRoleIds"],
        message: "At least one target role is required.",
      });
    }

    if (
      data.targetType === "USERS" &&
      (!data.targetUserIds || data.targetUserIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetUserIds"],
        message: "At least one target user is required.",
      });
    }

    if (
      data.targetType === "ALL_ADMINS" &&
      (data.targetRoleIds?.length || data.targetUserIds?.length)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetType"],
        message: "ALL_ADMINS announcements cannot contain specific targets.",
      });
    }

    if (data.targetType === "ROLES" && data.targetUserIds?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetUserIds"],
        message: "Role-targeted announcements cannot contain user targets.",
      });
    }

    if (data.targetType === "USERS" && data.targetRoleIds?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetRoleIds"],
        message: "User-targeted announcements cannot contain role targets.",
      });
    }

    if (
      data.targetType === "RIDERS" &&
      (!data.targetRiderIds || data.targetRiderIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetRiderIds"],
        message: "At least one target rider is required.",
      });
    }

    if (
      (data.targetType === "ALL_ADMINS" || data.targetType === "ALL_RIDERS") &&
      (data.targetRoleIds?.length || data.targetUserIds?.length || data.targetRiderIds?.length)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetType"],
        message: "All-target announcements cannot contain specific targets.",
      });
    }

    if (data.targetType === "ALL_RIDERS" && (data.targetRoleIds?.length || data.targetUserIds?.length)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetType"],
        message: "ALL_RIDERS cannot contain administrator targets.",
      });
    }

    if (data.targetType === "RIDERS" && (data.targetRoleIds?.length || data.targetUserIds?.length)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetType"],
        message: "Rider-targeted announcements cannot contain administrator targets.",
      });
    }

    if (
      data.scheduledAt &&
      data.expiresAt &&
      data.expiresAt <= data.scheduledAt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "Expiration time must be after scheduled time.",
      });
    }
  });

/*
|--------------------------------------------------------------------------
| Update Announcement
|--------------------------------------------------------------------------
*/

export const updateAnnouncementSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Announcement title is required.")
      .max(250, "Announcement title cannot exceed 250 characters.")
      .optional(),

    body: z
      .string()
      .trim()
      .min(1, "Announcement body is required.")
      .max(20000, "Announcement body cannot exceed 20000 characters.")
      .optional(),

    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),

    targetType: z.enum(["ALL_ADMINS", "ALL_RIDERS", "RIDERS", "ROLES", "USERS"]).optional(),

    targetRoleIds: z
      .array(objectIdSchema)
      .max(50, "An announcement cannot target more than 50 roles.")
      .optional(),

    targetUserIds: z
      .array(objectIdSchema)
      .max(500, "An announcement cannot target more than 500 users.")
      .optional(),

    targetRiderIds: z
      .array(objectIdSchema)
      .max(500, "An announcement cannot target more than 500 riders.")
      .optional(),

    scheduledAt: z.coerce.date().optional(),

    expiresAt: z.coerce.date().optional(),

    attachments: z
      .array(attachmentSchema)
      .max(10, "An announcement cannot contain more than 10 attachments.")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.targetType === "RIDERS" && data.targetRiderIds && data.targetRiderIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetRiderIds"],
        message: "At least one target rider is required.",
      });
    }

    if (
      (data.targetType === "ALL_ADMINS" || data.targetType === "ALL_RIDERS") &&
      (data.targetRoleIds?.length || data.targetUserIds?.length || data.targetRiderIds?.length)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetType"],
        message: "All-target announcements cannot contain specific targets.",
      });
    }

    if (data.targetType === "RIDERS" && (data.targetRoleIds?.length || data.targetUserIds?.length)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetType"],
        message: "Rider-targeted announcements cannot contain administrator targets.",
      });
    }

    if (data.targetType === "ALL_RIDERS" && (data.targetRoleIds?.length || data.targetUserIds?.length)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetType"],
        message: "ALL_RIDERS cannot contain administrator targets.",
      });
    }

    if (
      data.scheduledAt &&
      data.expiresAt &&
      data.expiresAt <= data.scheduledAt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "Expiration time must be after scheduled time.",
      });
    }

    if (data.targetType === "ROLES" && data.targetUserIds?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetUserIds"],
        message: "Role-targeted announcements cannot contain user targets.",
      });
    }

    if (data.targetType === "USERS" && data.targetRoleIds?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetRoleIds"],
        message: "User-targeted announcements cannot contain role targets.",
      });
    }
  });

/*
|--------------------------------------------------------------------------
| Announcement ID
|--------------------------------------------------------------------------
*/

export const announcementIdParamSchema = z.object({
  announcementId: objectIdSchema,
});

/*
|--------------------------------------------------------------------------
| Announcement List Query
|--------------------------------------------------------------------------
*/

export const announcementListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  status: z
    .enum(["DRAFT", "SCHEDULED", "PUBLISHED", "EXPIRED", "ARCHIVED"])
    .optional(),

  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),

  targetType: z.enum(["ALL_ADMINS", "ALL_RIDERS", "RIDERS", "ROLES", "USERS"]).optional(),

  search: z.string().trim().max(100).optional(),
});

/*
|--------------------------------------------------------------------------
| Recipient List Query
|--------------------------------------------------------------------------
*/

export const announcementRecipientListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  unreadOnly: z.coerce.boolean().default(false),
});

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

export type AnnouncementIdParams = z.infer<typeof announcementIdParamSchema>;

export type AnnouncementListQuery = z.infer<typeof announcementListQuerySchema>;

export type AnnouncementRecipientListQuery = z.infer<
  typeof announcementRecipientListQuerySchema
>;
