import { z } from "zod";

/*
|--------------------------------------------------------------------------
| ObjectId
|--------------------------------------------------------------------------
*/

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid ID.");

/*
|--------------------------------------------------------------------------
| Attachment
|--------------------------------------------------------------------------
*/

const attachmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Attachment name is required.")
    .max(255, "Attachment name cannot exceed 255 characters."),

  publicId: z.string().trim().min(1).max(500),

  resourceType: z.enum(["image", "raw"]),

  format: z.string().trim().min(1).max(20),

  mimeType: z
    .string()
    .trim()
    .min(1, "Attachment MIME type is required.")
    .max(150, "Attachment MIME type cannot exceed 150 characters."),

  size: z.number().int().min(0, "Attachment size cannot be negative."),
});

/*
|--------------------------------------------------------------------------
| Create Message
|--------------------------------------------------------------------------
*/

export const createMessageSchema = z.object({
  recipientId: objectIdSchema,

  subject: z
    .string()
    .trim()
    .min(1, "Message subject is required.")
    .max(250, "Message subject cannot exceed 250 characters."),

  body: z
    .string()
    .trim()
    .min(1, "Message body is required.")
    .max(10000, "Message body cannot exceed 10000 characters."),

  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),

  attachments: z
    .array(attachmentSchema)
    .max(10, "A message cannot contain more than 10 attachments.")
    .optional(),
});

/*
|--------------------------------------------------------------------------
| Message ID Params
|--------------------------------------------------------------------------
*/

export const messageIdParamSchema = z.object({
  messageId: objectIdSchema,
});

/*
|--------------------------------------------------------------------------
| Message List Query
|--------------------------------------------------------------------------
*/

export const messageListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    status: z.enum(["SENT", "READ", "ARCHIVED", "DELETED"]).optional(),

    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),

    search: z.string().trim().max(100).optional(),

    unreadOnly: z.preprocess(
      (value) => value === true || value === "true",
      z.boolean(),
    ),

    fromDate: z.coerce.date().optional(),

    toDate: z.coerce.date().optional(),

    sort: z.enum(["newest", "oldest"]).default("newest"),
    participantType: z.enum(["RIDER", "ADMIN_EMPLOYEE"]).optional(),
  })
  .refine(
    (query) =>
      !query.fromDate || !query.toDate || query.fromDate <= query.toDate,
    { message: "fromDate must be earlier than toDate." },
  );

export const messageRecipientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(50),

  search: z.string().trim().max(100).optional(),

  accountType: z
    .enum(["OWNER", "ADMIN", "EMPLOYEE", "SELLER", "RIDER"])
    .optional(),

  accountTypes: z.preprocess(
    (value) =>
      typeof value === "string"
        ? value.split(",").map((item) => item.trim()).filter(Boolean)
        : value,
    z.array(z.enum(["ADMIN", "EMPLOYEE"])).optional(),
  ),
});

/*
|--------------------------------------------------------------------------
| Message Action
|--------------------------------------------------------------------------
*/

export const messageActionSchema = z.object({
  messageId: objectIdSchema,
});

export const messageReplySchema = z.object({
  body: z.string().trim().min(1).max(10000),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export const messageBulkActionSchema = z.object({
  messageIds: z.array(objectIdSchema).min(1).max(100),
  action: z.enum(["read", "unread", "archive", "delete"]),
});

/*
|--------------------------------------------------------------------------
| Exported Types
|--------------------------------------------------------------------------
*/

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export type MessageIdParams = z.infer<typeof messageIdParamSchema>;

export type MessageListQuery = z.infer<typeof messageListQuerySchema>;
