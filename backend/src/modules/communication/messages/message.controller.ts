import { Request, Response } from "express";

import {
  createMessage,
  getInbox,
  getSentMessages,
  getMessageById,
  markMessageAsRead,
  archiveMessage,
  deleteMessage,
  getMessageRecipients,
  createMessageReply,
  getMessageThread,
  getUnreadMessageCount,
  markMessageAsUnread,
  performBulkMessageAction,
  uploadMessageAttachments,
} from "./message.service";

import { getAuthenticatedAdminId } from "../../../middlewares/adminAuth.middleware";

import { getAuthenticatedOwnerUserId } from "../../../middlewares/ownerAuth.middleware";

import { Admin, ADMIN_STATUSES } from "../../admins/admin.model";

import { ApiError } from "../../../utils/ApiError";
import {
  MESSAGE_PRIORITIES,
  MESSAGE_STATUSES,
  type MessagePriority,
  type MessageStatus,
} from "./message.types";

const isMessageStatus = (value: string): value is MessageStatus =>
  Object.values(MESSAGE_STATUSES).some((status) => status === value);

const isMessagePriority = (value: string): value is MessagePriority =>
  Object.values(MESSAGE_PRIORITIES).some((priority) => priority === value);

/*
|--------------------------------------------------------------------------
| Authenticated User ID
|--------------------------------------------------------------------------
*/

interface AuthenticatedMessageIdentity {
  readonly userId: string;
  readonly legacyUserIds: string[];
}

const getAuthenticatedMessageIdentity = async (
  req: Request,
): Promise<AuthenticatedMessageIdentity> => {
  if (req.ownerAuth) {
    return {
      userId: getAuthenticatedOwnerUserId(req),
      legacyUserIds: [],
    };
  }

  if (req.adminAuth) {
    const admin = await Admin.findOne({
      _id: getAuthenticatedAdminId(req),
      status: ADMIN_STATUSES.ACTIVE,
    })
      .select("userId")
      .lean()
      .exec();

    if (!admin) {
      throw new ApiError("Active admin account not found.", {
        statusCode: 401,
      });
    }

    return {
      userId: admin.userId.toString(),
      legacyUserIds: [admin._id.toString()],
    };
  }

  throw new ApiError("Authentication is required.", {
    statusCode: 401,
  });
};

const getAuthenticatedUserId = async (req: Request): Promise<string> =>
  (await getAuthenticatedMessageIdentity(req)).userId;

/*
|--------------------------------------------------------------------------
| Create Message
|--------------------------------------------------------------------------
*/

export const createMessageController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const senderId = await getAuthenticatedUserId(req);

  const message = await createMessage(senderId, {
    recipientId: req.body.recipientId,
    subject: req.body.subject,
    body: req.body.body,
    priority: req.body.priority,
    attachments: req.body.attachments,
  });

  res.status(201).json({
    success: true,
    message: "Message sent successfully.",
    data: message,
  });
};

export const uploadMessageAttachmentsController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const senderId = await getAuthenticatedUserId(req);
  const files = Array.isArray(req.files) ? req.files : [];
  const attachments = await uploadMessageAttachments(senderId, files);
  res.status(201).json({
    success: true,
    message: "Attachments uploaded successfully.",
    data: { attachments },
  });
};

export const createMessageReplyController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const identity = await getAuthenticatedMessageIdentity(req);
  const message = await createMessageReply(
    typeof req.params.messageId === "string"
      ? req.params.messageId
      : req.params.messageId[0],
    identity.userId,
    identity.legacyUserIds,
    req.body.body,
    req.body.attachments,
  );
  res.status(201).json({
    success: true,
    message: "Reply sent successfully.",
    data: message,
  });
};

export const getMessageThreadController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const identity = await getAuthenticatedMessageIdentity(req);
  const messages = await getMessageThread(
    typeof req.params.messageId === "string"
      ? req.params.messageId
      : req.params.messageId[0],
    identity.userId,
    identity.legacyUserIds,
  );
  res.status(200).json({
    success: true,
    message: "Conversation retrieved successfully.",
    data: { messages },
  });
};

export const getUnreadMessageCountController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const identity = await getAuthenticatedMessageIdentity(req);
  const count = await getUnreadMessageCount(
    identity.userId,
    identity.legacyUserIds,
  );
  res.status(200).json({
    success: true,
    message: "Unread message count retrieved successfully.",
    data: { count },
  });
};

export const performBulkMessageActionController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const identity = await getAuthenticatedMessageIdentity(req);
  const modifiedCount = await performBulkMessageAction(
    identity.userId,
    identity.legacyUserIds,
    req.body.messageIds,
    req.body.action,
  );
  res.status(200).json({
    success: true,
    message: "Bulk message action completed.",
    data: { modifiedCount },
  });
};

export const getMessageRecipientsController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await getMessageRecipients({
    senderId: await getAuthenticatedUserId(req),
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 50,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    accountType:
      req.query.accountType === "OWNER" ||
      req.query.accountType === "ADMIN" ||
      req.query.accountType === "EMPLOYEE" ||
      req.query.accountType === "SELLER" ||
      req.query.accountType === "RIDER"
        ? req.query.accountType
        : undefined,
    accountTypes:
      typeof req.query.accountTypes === "string"
        ? req.query.accountTypes.split(",").map((item) => item.trim())
            .filter((item): item is "ADMIN" | "EMPLOYEE" =>
              item === "ADMIN" || item === "EMPLOYEE")
        : undefined,
  });

  res.status(200).json({
    success: true,
    message: "Message recipients retrieved successfully.",
    data: result,
  });
};

/*
|--------------------------------------------------------------------------
| Inbox
|--------------------------------------------------------------------------
*/

export const getMessageInboxController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const identity = await getAuthenticatedMessageIdentity(req);

  const result = await getInbox({
    userId: identity.userId,
    legacyUserIds: identity.legacyUserIds,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
    status:
      typeof req.query.status === "string" && isMessageStatus(req.query.status)
        ? req.query.status
        : undefined,
    priority:
      typeof req.query.priority === "string" &&
      isMessagePriority(req.query.priority)
        ? req.query.priority
        : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    unreadOnly: String(req.query.unreadOnly) === "true",
    fromDate:
      req.query.fromDate instanceof Date ? req.query.fromDate : undefined,
    toDate: req.query.toDate instanceof Date ? req.query.toDate : undefined,
    sort:
      req.query.sort === "oldest" || req.query.sort === "newest"
        ? req.query.sort
        : undefined,
    participantType:
      req.query.participantType === "RIDER" || req.query.participantType === "ADMIN_EMPLOYEE"
        ? req.query.participantType
        : undefined,
  });

  res.status(200).json({
    success: true,
    message: "Inbox retrieved successfully.",
    data: result,
  });
};

/*
|--------------------------------------------------------------------------
| Sent Messages
|--------------------------------------------------------------------------
*/

export const getSentMessagesController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const identity = await getAuthenticatedMessageIdentity(req);

  const result = await getSentMessages({
    userId: identity.userId,
    legacyUserIds: identity.legacyUserIds,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
    status:
      typeof req.query.status === "string" && isMessageStatus(req.query.status)
        ? req.query.status
        : undefined,
    priority:
      typeof req.query.priority === "string" &&
      isMessagePriority(req.query.priority)
        ? req.query.priority
        : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    unreadOnly: String(req.query.unreadOnly) === "true",
    fromDate:
      req.query.fromDate instanceof Date ? req.query.fromDate : undefined,
    toDate: req.query.toDate instanceof Date ? req.query.toDate : undefined,
    sort:
      req.query.sort === "oldest" || req.query.sort === "newest"
        ? req.query.sort
        : undefined,
    participantType:
      req.query.participantType === "RIDER" || req.query.participantType === "ADMIN_EMPLOYEE"
        ? req.query.participantType
        : undefined,
  });

  res.status(200).json({
    success: true,
    message: "Sent messages retrieved successfully.",
    data: result,
  });
};

/*
|--------------------------------------------------------------------------
| Get Message
|--------------------------------------------------------------------------
*/

export const getMessageController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const identity = await getAuthenticatedMessageIdentity(req);

  const message = await getMessageById(
    typeof req.params.messageId === "string"
      ? req.params.messageId
      : req.params.messageId[0],
    identity.userId,
    identity.legacyUserIds,
  );

  res.status(200).json({
    success: true,
    message: "Message retrieved successfully.",
    data: message,
  });
};

/*
|--------------------------------------------------------------------------
| Mark As Read
|--------------------------------------------------------------------------
*/

export const markMessageAsReadController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const identity = await getAuthenticatedMessageIdentity(req);

  const message = await markMessageAsRead(
    typeof req.params.messageId === "string"
      ? req.params.messageId
      : req.params.messageId[0],
    identity.userId,
    identity.legacyUserIds,
  );

  res.status(200).json({
    success: true,
    message: "Message marked as read.",
    data: message,
  });
};

export const markMessageAsUnreadController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const identity = await getAuthenticatedMessageIdentity(req);
  const message = await markMessageAsUnread(
    typeof req.params.messageId === "string"
      ? req.params.messageId
      : req.params.messageId[0],
    identity.userId,
    identity.legacyUserIds,
  );
  res.status(200).json({
    success: true,
    message: "Message marked as unread.",
    data: message,
  });
};

/*
|--------------------------------------------------------------------------
| Archive Message
|--------------------------------------------------------------------------
*/

export const archiveMessageController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const identity = await getAuthenticatedMessageIdentity(req);

  const message = await archiveMessage(
    typeof req.params.messageId === "string"
      ? req.params.messageId
      : req.params.messageId[0],
    identity.userId,
    identity.legacyUserIds,
  );

  res.status(200).json({
    success: true,
    message: "Message archived successfully.",
    data: message,
  });
};

/*
|--------------------------------------------------------------------------
| Delete Message
|--------------------------------------------------------------------------
*/

export const deleteMessageController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const identity = await getAuthenticatedMessageIdentity(req);

  const message = await deleteMessage(
    typeof req.params.messageId === "string"
      ? req.params.messageId
      : req.params.messageId[0],
    identity.userId,
    identity.legacyUserIds,
  );

  res.status(200).json({
    success: true,
    message: "Message deleted successfully.",
    data: message,
  });
};
