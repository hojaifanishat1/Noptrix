import { Types, type UpdateQuery } from "mongoose";

import { Message, type IMessageDocument } from "./message.model";

import {
  MESSAGE_STATUSES,
  type IMessage,
  type MessageAttachment,
  type MessagePriority,
} from "./message.types";

import { User, USER_STATUSES } from "../../users/user.model";

import { Owner, OWNER_STATUSES } from "../../owners/owner.model";

import { Admin, ADMIN_STATUSES } from "../../admins/admin.model";

import { Seller } from "../../sellers/seller.model";
import { Rider } from "../../riders/rider.model";
import { Employee, EMPLOYEE_STATUSES } from "../../employees/employee.model";
import { Role } from "../../roles/role.model";

import { ApiError } from "../../../utils/ApiError";
import { logger } from "../../../utils/logger";
import {
  uploadBufferToCloudinary,
  createPrivateCloudinaryDownloadUrl,
  deleteFromCloudinary,
} from "../../../services/cloudinary.service";
import { createNotification } from "../../notifications/notification.service";
import { NOTIFICATION_CHANNELS } from "../../notifications/notification.types";
import { enqueueNotificationCreated } from "../../../jobs/notification.job";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export interface CreateMessageServiceInput {
  recipientId: string;
  subject: string;
  body: string;
  priority?: MessagePriority;
  attachments?: MessageAttachment[];
}

export interface MessageListServiceInput {
  userId: string;
  legacyUserIds?: string[];
  page: number;
  limit: number;
  status?: string;
  priority?: string;
  search?: string;
  unreadOnly?: boolean;
  fromDate?: Date;
  toDate?: Date;
  sort?: "newest" | "oldest";
}

export interface MessageRecipientListInput {
  readonly senderId: string;
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
  readonly accountType?: "OWNER" | "ADMIN" | "EMPLOYEE" | "SELLER" | "RIDER";
}

export interface MessageResponse extends Omit<
  IMessage,
  "_id" | "senderId" | "recipientId"
> {
  _id: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  recipientName: string;
  senderRole?: string;
  recipientRole?: string;
}

export type MessageBulkAction = "read" | "unread" | "archive" | "delete";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const validateObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${fieldName}.`, {
      code: "INVALID_OBJECT_ID",
    });
  }

  return new Types.ObjectId(value);
};

const validateActiveUser = async (userId: Types.ObjectId): Promise<void> => {
  const user = await User.findById(userId).select("_id status").lean().exec();

  if (!user) {
    throw ApiError.notFound("User not found.", {
      code: "USER_NOT_FOUND",
    });
  }

  if (user.status !== USER_STATUSES.ACTIVE) {
    throw ApiError.forbidden("The user account is not active.", {
      code: "USER_NOT_ACTIVE",
    });
  }
};

const addMessageNames = async (
  messages: IMessageDocument[],
  signAttachments = false,
): Promise<MessageResponse[]> => {
  const messageUserIds = [
    ...new Set(
      messages.flatMap((message) => [
        message.senderId.toString(),
        message.recipientId.toString(),
      ]),
    ),
  ];
  const messageObjectIds = messageUserIds.map((id) => new Types.ObjectId(id));
  const legacyAdmins = await Admin.find({ _id: { $in: messageObjectIds } })
    .select("_id userId")
    .lean()
    .exec();
  const legacyUserIds = new Map(
    legacyAdmins.map((admin) => [
      admin._id.toString(),
      admin.userId.toString(),
    ]),
  );
  const userIds = [
    ...new Set([...messageUserIds, ...legacyUserIds.values()]),
  ].map((id) => new Types.ObjectId(id));
  const [users, owners, employees, admins, sellers, riders] = await Promise.all(
    [
      User.find({ _id: { $in: userIds } })
        .select("_id name")
        .lean()
        .exec(),
      Owner.find({ userId: { $in: userIds } })
        .select("userId role")
        .lean()
        .exec(),
      Employee.find({ userId: { $in: userIds } })
        .select("userId roleId jobTitle")
        .lean()
        .exec(),
      Admin.find({
        $or: [{ userId: { $in: userIds } }, { _id: { $in: messageObjectIds } }],
      })
        .select("_id userId roleId")
        .lean()
        .exec(),
      Seller.find({ _id: { $in: messageObjectIds } })
        .select("_id businessName")
        .lean()
        .exec(),
      Rider.find({ userId: { $in: userIds } })
        .select("userId")
        .lean()
        .exec(),
    ],
  );
  const names = new Map(users.map((user) => [user._id.toString(), user.name]));
  sellers.forEach((seller) => {
    names.set(seller._id.toString(), seller.businessName);
  });
  const roleIds = [
    ...new Set(
      [...admins, ...employees].map((profile) => profile.roleId.toString()),
    ),
  ].map((id) => new Types.ObjectId(id));
  const roles = await Role.find({ _id: { $in: roleIds } })
    .select("_id name")
    .lean()
    .exec();
  const roleNames = new Map(
    roles.map((role) => [role._id.toString(), role.name]),
  );
  const accountRoles = new Map<string, string>();
  const assignRole = (userId: Types.ObjectId, role: string | undefined) => {
    if (role && !accountRoles.has(userId.toString())) {
      accountRoles.set(userId.toString(), role);
    }
  };
  owners.forEach((owner) => assignRole(owner.userId, "Owner"));
  admins.forEach((admin) => {
    assignRole(admin.userId, roleNames.get(admin.roleId.toString()));
  });
  employees.forEach((employee) => {
    assignRole(
      employee.userId,
      employee.jobTitle?.trim() || roleNames.get(employee.roleId.toString()),
    );
  });
  sellers.forEach((seller) => assignRole(seller._id, "Seller"));
  riders.forEach((rider) => assignRole(rider.userId, "Rider"));
  const resolveUserId = (id: string): string => legacyUserIds.get(id) ?? id;
  const resolveName = (id: string): string =>
    names.get(resolveUserId(id)) ?? "Unknown user";
  const resolveRole = (id: string): string | undefined =>
    accountRoles.get(resolveUserId(id));

  return messages.map((message) => {
    const data = message.toObject();
    return {
      ...data,
      _id: message._id.toString(),
      senderId: resolveUserId(message.senderId.toString()),
      recipientId: resolveUserId(message.recipientId.toString()),
      senderName: resolveName(message.senderId.toString()),
      recipientName: resolveName(message.recipientId.toString()),
      senderRole: resolveRole(message.senderId.toString()),
      recipientRole: resolveRole(message.recipientId.toString()),
      ...(data.attachments
        ? {
            attachments: data.attachments.map(
              (attachment: MessageAttachment) => ({
                ...attachment,
                ...(signAttachments &&
                attachment.publicId &&
                attachment.resourceType &&
                attachment.format
                  ? {
                      url: createPrivateCloudinaryDownloadUrl(
                        attachment.publicId,
                        attachment.format,
                        attachment.resourceType,
                      ),
                    }
                  : {}),
              }),
            ),
          }
        : {}),
    };
  });
};

const notifyMessageRecipient = async (
  message: IMessageDocument,
  senderId: Types.ObjectId,
): Promise<void> => {
  try {
    const sender = await User.findById(senderId).select("name").lean().exec();
    const notification = await createNotification({
      recipientId: message.recipientId,
      type: "SYSTEM",
      title: "New message",
      message: `${sender?.name ?? "A team member"}: ${message.subject}`,
      channels: [NOTIFICATION_CHANNELS.IN_APP],
      metadata: {
        messageId: message._id.toString(),
        actionUrl: `/admin/communication/inbox/${message._id.toString()}`,
      },
    });

    await enqueueNotificationCreated(
      { userId: message.recipientId.toString() },
      "New message",
      `${sender?.name ?? "A team member"}: ${message.subject}`,
      "normal",
      {
        messageId: message._id.toString(),
        actionUrl: `/admin/communication/inbox/${message._id.toString()}`,
      },
      notification._id.toString(),
    );
  } catch (error) {
    logger.error(
      { error, messageId: message._id.toString() },
      "Unable to deliver new-message notification.",
    );
  }
};

export const uploadMessageAttachments = async (
  senderId: string,
  files: Express.Multer.File[],
): Promise<MessageAttachment[]> => {
  const senderObjectId = validateObjectId(senderId, "sender ID");
  await assertActiveAdministrativeSender(senderObjectId);

  if (files.length === 0) {
    throw ApiError.badRequest("Choose at least one attachment.");
  }

  const uploaded: Array<{
    publicId: string;
    resourceType: "image" | "raw";
  }> = [];
  try {
    const attachments: MessageAttachment[] = [];
    for (const file of files) {
      const resourceType = file.mimetype.startsWith("image/") ? "image" : "raw";
      const asset = await uploadBufferToCloudinary(
        {
          buffer: file.buffer,
          filename: file.originalname,
          mimeType: file.mimetype,
        },
        {
          folder: `noptrix/messages/${senderObjectId.toString()}`,
          resourceType,
          accessMode: "authenticated",
          useUniqueFilename: true,
        },
      );
      uploaded.push({ publicId: asset.publicId, resourceType });
      attachments.push({
        name: file.originalname,
        publicId: asset.publicId,
        resourceType,
        format: asset.format,
        mimeType: file.mimetype,
        size: asset.bytes,
      });
    }
    return attachments;
  } catch (error) {
    const cleanupResults = await Promise.allSettled(
      uploaded.map((asset) =>
        deleteFromCloudinary(asset.publicId, asset.resourceType),
      ),
    );
    const cleanupFailures = cleanupResults.filter(
      (result) => result.status === "rejected",
    );
    if (cleanupFailures.length > 0) {
      logger.error(
        { cleanupFailures, senderId: senderObjectId.toString() },
        "Failed to clean up partially uploaded message attachments.",
      );
    }
    throw error;
  }
};

const validateMessageAttachments = (
  senderId: Types.ObjectId,
  attachments: MessageAttachment[] = [],
): void => {
  const allowedPrefix = `noptrix/messages/${senderId.toString()}/`;
  if (
    attachments.some(
      (attachment) =>
        !attachment.publicId?.startsWith(allowedPrefix) ||
        !attachment.resourceType ||
        !attachment.format,
    )
  ) {
    throw ApiError.badRequest(
      "One or more attachments were not uploaded by this account.",
      { code: "INVALID_MESSAGE_ATTACHMENT" },
    );
  }
};

const applyMessageListFilters = (
  filter: Record<string, unknown>,
  input: MessageListServiceInput,
): void => {
  if (input.status) filter.status = input.status;
  if (input.unreadOnly) filter.status = MESSAGE_STATUSES.SENT;
  if (!input.status && !input.unreadOnly) {
    filter.status = {
      $nin: [MESSAGE_STATUSES.ARCHIVED, MESSAGE_STATUSES.DELETED],
    };
  }
  if (input.priority) filter.priority = input.priority;
  if (input.fromDate || input.toDate) {
    filter.createdAt = {
      ...(input.fromDate ? { $gte: input.fromDate } : {}),
      ...(input.toDate ? { $lte: input.toDate } : {}),
    };
  }
  if (input.search) {
    const escapedSearch = input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const conditions = Array.isArray(filter.$and) ? filter.$and : [];
    if (filter.$or) conditions.push({ $or: filter.$or });
    conditions.push({
      $or: [
        { subject: { $regex: escapedSearch, $options: "i" } },
        { body: { $regex: escapedSearch, $options: "i" } },
      ],
    });
    filter.$and = conditions;
    delete filter.$or;
  }
};

const getConversationPage = async (
  filter: Record<string, unknown>,
  input: MessageListServiceInput,
): Promise<{ messages: IMessageDocument[]; total: number }> => {
  const sortDirection = input.sort === "oldest" ? 1 : -1;
  const skip = (input.page - 1) * input.limit;
  const [result] = await Message.aggregate<{
    messages: { _id: Types.ObjectId }[];
    total: { count: number }[];
  }>([
    { $match: filter },
    { $sort: { createdAt: -1, _id: -1 } },
    {
      $group: {
        _id: { $ifNull: ["$threadId", "$_id"] },
        messageId: { $first: "$_id" },
        createdAt: { $first: "$createdAt" },
      },
    },
    {
      $facet: {
        messages: [
          { $sort: { createdAt: sortDirection, _id: sortDirection } },
          { $skip: skip },
          { $limit: input.limit },
          { $project: { _id: "$messageId" } },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]).exec();

  const messageIds = result?.messages.map(({ _id }) => _id) ?? [];
  const documents = await Message.find({ _id: { $in: messageIds } }).exec();
  const documentsById = new Map(
    documents.map((message) => [message._id.toString(), message]),
  );

  return {
    messages: messageIds.flatMap((id) => {
      const message = documentsById.get(id.toString());
      return message ? [message] : [];
    }),
    total: result?.total[0]?.count ?? 0,
  };
};

const assertActiveAdministrativeSender = async (
  userId: Types.ObjectId,
): Promise<void> => {
  await validateActiveUser(userId);

  const [owner, admin] = await Promise.all([
    Owner.exists({
      userId,
      status: OWNER_STATUSES.ACTIVE,
    }),
    Admin.exists({
      userId,
      status: ADMIN_STATUSES.ACTIVE,
    }),
  ]);

  if (!owner && !admin) {
    throw ApiError.forbidden(
      "Only active OWNER and ADMIN accounts can use internal messaging.",
      { code: "COMMUNICATION_SENDER_FORBIDDEN" },
    );
  }
};

const assertCanMessage = async (
  senderId: Types.ObjectId,
  recipientId: Types.ObjectId,
): Promise<void> => {
  if (senderId.equals(recipientId)) {
    throw ApiError.badRequest("You cannot send a message to yourself.", {
      code: "SELF_MESSAGE_FORBIDDEN",
    });
  }

  await assertActiveAdministrativeSender(senderId);

  await validateActiveUser(recipientId);

  const [recipientOwner, recipientAdmin, employee, seller, rider] =
    await Promise.all([
      Owner.exists({
        userId: recipientId,
        status: OWNER_STATUSES.ACTIVE,
      }),
      Admin.exists({
        userId: recipientId,
        status: ADMIN_STATUSES.ACTIVE,
      }),
      Employee.exists({
        userId: recipientId,
        status: EMPLOYEE_STATUSES.ACTIVE,
      }),
      Seller.exists({
        userId: recipientId,
        status: "ACTIVE",
      }),
      Rider.exists({
        userId: recipientId,
        status: "ACTIVE",
      }),
    ]);

  if (!recipientOwner && !recipientAdmin && !employee && !seller && !rider) {
    throw ApiError.forbidden(
      "Messages can only be sent to active platform accounts.",
      { code: "COMMUNICATION_RECIPIENT_FORBIDDEN" },
    );
  }
};

export interface MessageRecipient {
  readonly userId: string;
  readonly name: string;
  readonly email?: string;
  readonly accountType: "OWNER" | "ADMIN" | "EMPLOYEE" | "SELLER" | "RIDER";
  readonly profileName?: string;
}

export const getMessageRecipients = async (
  input: MessageRecipientListInput,
): Promise<{
  recipients: MessageRecipient[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const senderObjectId = validateObjectId(input.senderId, "sender ID");
  await assertActiveAdministrativeSender(senderObjectId);
  const search = input.search?.trim();
  const escapedSearch = search
    ? search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    : undefined;
  const profileSearch = escapedSearch
    ? {
        $or: [
          { name: { $regex: escapedSearch, $options: "i" } },
          { businessName: { $regex: escapedSearch, $options: "i" } },
          { email: { $regex: escapedSearch, $options: "i" } },
          { phone: { $regex: escapedSearch, $options: "i" } },
        ],
      }
    : {};

  const [owners, admins, employees, sellers, riders] = await Promise.all([
    input.accountType && input.accountType !== "OWNER"
      ? Promise.resolve([])
      : Owner.find({
          status: OWNER_STATUSES.ACTIVE,
        })
          .select("userId")
          .lean()
          .exec(),
    input.accountType && input.accountType !== "ADMIN"
      ? Promise.resolve([])
      : Admin.find({
          status: ADMIN_STATUSES.ACTIVE,
        })
          .select("userId")
          .lean()
          .exec(),
    input.accountType && input.accountType !== "EMPLOYEE"
      ? Promise.resolve([])
      : Employee.find({
          status: EMPLOYEE_STATUSES.ACTIVE,
        })
          .select("userId department jobTitle")
          .lean()
          .exec(),
    input.accountType && input.accountType !== "SELLER"
      ? Promise.resolve([])
      : Seller.find({
          status: "ACTIVE",
          ...profileSearch,
        })
          .select("_id businessName email")
          .lean()
          .exec(),
    input.accountType && input.accountType !== "RIDER"
      ? Promise.resolve([])
      : Rider.find({
          status: "ACTIVE",
          ...profileSearch,
        })
          .select("userId name email")
          .lean()
          .exec(),
  ]);

  const accountTypes = new Map<string, MessageRecipient["accountType"]>();
  const profiles = new Map<string, { profileName?: string; email?: string }>();

  for (const owner of owners) {
    accountTypes.set(owner.userId.toString(), "OWNER");
  }
  for (const admin of admins) {
    accountTypes.set(admin.userId.toString(), "ADMIN");
  }
  for (const employee of employees) {
    const userId = employee.userId.toString();
    accountTypes.set(userId, "EMPLOYEE");
    profiles.set(userId, {
      profileName:
        [employee.jobTitle, employee.department].filter(Boolean).join(" · ") ||
        undefined,
    });
  }
  for (const seller of sellers) {
    const sellerId = seller._id.toString();
    accountTypes.set(sellerId, "SELLER");
    profiles.set(sellerId, {
      profileName: seller.businessName,
      email: seller.email,
    });
  }
  for (const rider of riders) {
    const userId = rider.userId.toString();
    accountTypes.set(userId, "RIDER");
    profiles.set(userId, {
      profileName: rider.name,
      email: rider.email,
    });
  }

  accountTypes.delete(senderObjectId.toString());
  profiles.delete(senderObjectId.toString());

  const recipientIds = [...accountTypes.keys()].map(
    (userId) => new Types.ObjectId(userId),
  );
  const userSearch = escapedSearch
    ? {
        $or: [
          { name: { $regex: escapedSearch, $options: "i" } },
          { email: { $regex: escapedSearch, $options: "i" } },
          { phone: { $regex: escapedSearch, $options: "i" } },
        ],
      }
    : {};
  const userFilter = {
    _id: { $in: recipientIds },
    status: USER_STATUSES.ACTIVE,
    ...userSearch,
  };
  const skip = (input.page - 1) * input.limit;
  const [users, total] = await Promise.all([
    User.find(userFilter)
      .select("_id name email phone")
      .sort({ name: 1, _id: 1 })
      .skip(skip)
      .limit(input.limit)
      .lean()
      .exec(),
    User.countDocuments(userFilter).exec(),
  ]);

  return {
    recipients: users.map((user) => {
      const userId = user._id.toString();
      const profile = profiles.get(userId);
      return {
        userId,
        name: user.name,
        ...(user.email || profile?.email
          ? { email: user.email ?? profile?.email }
          : {}),
        accountType: accountTypes.get(userId)!,
        ...(profile?.profileName ? { profileName: profile.profileName } : {}),
      };
    }),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.ceil(total / input.limit),
  };
};

/*
|--------------------------------------------------------------------------
| Create Message
|--------------------------------------------------------------------------
*/

export const createMessage = async (
  senderId: string,
  data: CreateMessageServiceInput,
): Promise<MessageResponse> => {
  const senderObjectId = validateObjectId(senderId, "sender ID");

  const recipientObjectId = validateObjectId(data.recipientId, "recipient ID");

  validateMessageAttachments(senderObjectId, data.attachments);
  await assertCanMessage(senderObjectId, recipientObjectId);

  const message = new Message({
    senderId: senderObjectId,
    recipientId: recipientObjectId,
    subject: data.subject.trim(),
    body: data.body.trim(),
    priority: data.priority ?? "NORMAL",
    status: MESSAGE_STATUSES.SENT,
    attachments: data.attachments,
  });
  message.threadId = message._id;
  await message.save();
  await notifyMessageRecipient(message, senderObjectId);

  const [messageWithNames] = await addMessageNames([message]);
  return messageWithNames;
};

export const createMessageReply = async (
  messageId: string,
  senderId: string,
  legacyUserIds: string[],
  body: string,
  attachments: MessageAttachment[] = [],
): Promise<MessageResponse> => {
  const anchor = await findMessageById(messageId, senderId, legacyUserIds);
  const threadId = anchor.threadId ?? anchor._id;
  const root =
    (await Message.findOne({ _id: threadId }).exec()) ??
    (await Message.findOne({ threadId }).sort({ createdAt: 1 }).exec()) ??
    anchor;
  const senderObjectId = validateObjectId(senderId, "sender ID");
  const allowedSenderIds = [
    senderObjectId,
    ...legacyUserIds.map((id) => validateObjectId(id, "legacy user ID")),
  ];
  const isThreadParticipant = [root.senderId, root.recipientId].some((id) =>
    allowedSenderIds.some((allowedId) => allowedId.equals(id)),
  );
  if (!isThreadParticipant) {
    throw ApiError.forbidden("Only conversation participants can reply.", {
      code: "MESSAGE_REPLY_FORBIDDEN",
    });
  }

  const threadRecipientId = allowedSenderIds.some((id) =>
    root.senderId.equals(id),
  )
    ? root.recipientId
    : root.senderId;
  const legacyRecipient = await Admin.findById(threadRecipientId)
    .select("userId")
    .lean()
    .exec();
  const recipientId = legacyRecipient?.userId ?? threadRecipientId;
  validateMessageAttachments(senderObjectId, attachments);
  await assertCanMessage(senderObjectId, recipientId);

  const latestMessage = await Message.findOne({
    $or: [{ threadId }, { _id: threadId }],
  })
    .sort({ createdAt: -1 })
    .select("_id")
    .exec();
  const reply = await Message.create({
    senderId: senderObjectId,
    recipientId,
    threadId,
    parentMessageId: latestMessage?._id ?? root._id,
    subject: root.subject,
    body: body.trim(),
    priority: root.priority,
    status: MESSAGE_STATUSES.SENT,
    attachments,
  });
  await notifyMessageRecipient(reply, senderObjectId);
  const [messageWithNames] = await addMessageNames([reply]);
  return messageWithNames;
};

export const getMessageThread = async (
  messageId: string,
  userId: string,
  legacyUserIds: string[] = [],
): Promise<MessageResponse[]> => {
  const anchor = await findMessageById(messageId, userId, legacyUserIds);
  const threadId = anchor.threadId ?? anchor._id;
  const messages = await Message.find({
    $or: [{ threadId }, { _id: threadId }],
  })
    .sort({ createdAt: 1, _id: 1 })
    .exec();
  const userObjectId = validateObjectId(userId, "user ID");
  const allowedUserIds = [
    userObjectId,
    ...legacyUserIds.map((id) => validateObjectId(id, "legacy user ID")),
  ];
  const unreadIncoming = messages.filter(
    (message) =>
      allowedUserIds.some((id) => message.recipientId.equals(id)) &&
      message.status === MESSAGE_STATUSES.SENT,
  );
  if (unreadIncoming.length > 0) {
    const readAt = new Date();
    await Message.updateMany(
      { _id: { $in: unreadIncoming.map((message) => message._id) } },
      {
        $set: { status: MESSAGE_STATUSES.READ, readAt },
        $unset: { unreadAt: 1 },
      },
    ).exec();
    unreadIncoming.forEach((message) => {
      message.status = MESSAGE_STATUSES.READ;
      message.readAt = readAt;
    });
  }
  return addMessageNames(messages, true);
};

export const getUnreadMessageCount = async (
  userId: string,
  legacyUserIds: string[] = [],
): Promise<number> => {
  const allowedUserIds = [
    validateObjectId(userId, "user ID"),
    ...legacyUserIds.map((id) => validateObjectId(id, "legacy user ID")),
  ];
  const [result] = await Message.aggregate<{ count: number }>([
    {
      $match: {
        recipientId: { $in: allowedUserIds },
        status: MESSAGE_STATUSES.SENT,
      },
    },
    { $group: { _id: { $ifNull: ["$threadId", "$_id"] } } },
    { $count: "count" },
  ]).exec();
  return result?.count ?? 0;
};

export const performBulkMessageAction = async (
  userId: string,
  legacyUserIds: string[],
  messageIds: string[],
  action: MessageBulkAction,
): Promise<number> => {
  const allowedUserIds = [
    validateObjectId(userId, "user ID"),
    ...legacyUserIds.map((id) => validateObjectId(id, "legacy user ID")),
  ];
  const ids = [...new Set(messageIds)].map((id) =>
    validateObjectId(id, "message ID"),
  );
  const selectedMessages = await Message.find({
    _id: { $in: ids },
    $or: [
      { recipientId: { $in: allowedUserIds } },
      { senderId: { $in: allowedUserIds } },
    ],
    status: { $ne: MESSAGE_STATUSES.DELETED },
  })
    .select("_id threadId")
    .lean()
    .exec();
  const threadIds = [
    ...new Set(
      selectedMessages.map((message) =>
        (message.threadId ?? message._id).toString(),
      ),
    ),
  ].map((id) => new Types.ObjectId(id));
  if (threadIds.length === 0) return 0;

  const participantFilter =
    action === "archive" || action === "delete"
      ? {
          $or: [
            { recipientId: { $in: allowedUserIds } },
            { senderId: { $in: allowedUserIds } },
          ],
        }
      : { recipientId: { $in: allowedUserIds } };
  const filter = {
    $and: [
      participantFilter,
      { $or: [{ threadId: { $in: threadIds } }, { _id: { $in: threadIds } }] },
    ],
    status: { $ne: MESSAGE_STATUSES.DELETED },
  };
  const now = new Date();
  const updates: Record<MessageBulkAction, UpdateQuery<IMessageDocument>> = {
    read: {
      $set: { status: MESSAGE_STATUSES.READ, readAt: now },
      $unset: { unreadAt: 1 },
    },
    unread: {
      $set: { status: MESSAGE_STATUSES.SENT, unreadAt: now },
      $unset: { readAt: 1 },
    },
    archive: {
      $set: { status: MESSAGE_STATUSES.ARCHIVED, archivedAt: now },
    },
    delete: {
      $set: { status: MESSAGE_STATUSES.DELETED, deletedAt: now },
    },
  };
  const result = await Message.updateMany(filter, updates[action]).exec();
  return result.modifiedCount;
};

export const markMessageAsUnread = async (
  messageId: string,
  userId: string,
  legacyUserIds: string[] = [],
): Promise<MessageResponse> => {
  const message = await findMessageById(messageId, userId, legacyUserIds);
  const allowedUserIds = [
    validateObjectId(userId, "user ID"),
    ...legacyUserIds.map((id) => validateObjectId(id, "legacy user ID")),
  ];
  if (!allowedUserIds.some((id) => message.recipientId.equals(id))) {
    throw ApiError.forbidden("Only the recipient can mark a message unread.", {
      code: "MESSAGE_UNREAD_FORBIDDEN",
    });
  }
  if (message.status === MESSAGE_STATUSES.DELETED) {
    throw ApiError.badRequest("Deleted messages cannot be marked unread.", {
      code: "MESSAGE_DELETED",
    });
  }
  message.status = MESSAGE_STATUSES.SENT;
  message.unreadAt = new Date();
  message.readAt = undefined;
  await message.save();
  const [messageWithNames] = await addMessageNames([message]);
  return messageWithNames;
};

/*
|--------------------------------------------------------------------------
| Get Inbox
|--------------------------------------------------------------------------
*/

export const getInbox = async (
  input: MessageListServiceInput,
): Promise<{
  messages: MessageResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const userObjectId = validateObjectId(input.userId, "user ID");

  const allowedUserIds = [
    userObjectId,
    ...(input.legacyUserIds ?? []).map((id) =>
      validateObjectId(id, "legacy user ID"),
    ),
  ];
  const filter: Record<string, unknown> = {
    $or: input.unreadOnly
      ? [{ recipientId: { $in: allowedUserIds } }]
      : [
          { recipientId: { $in: allowedUserIds } },
          { senderId: { $in: allowedUserIds } },
        ],
  };

  applyMessageListFilters(filter, input);

  const { messages, total } = await getConversationPage(filter, input);

  return {
    messages: await addMessageNames(messages),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.ceil(total / input.limit),
  };
};

/*
|--------------------------------------------------------------------------
| Get Sent Messages
|--------------------------------------------------------------------------
*/

export const getSentMessages = async (
  input: MessageListServiceInput,
): Promise<{
  messages: MessageResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const userObjectId = validateObjectId(input.userId, "user ID");

  const filter: Record<string, unknown> = {
    senderId: {
      $in: [
        userObjectId,
        ...(input.legacyUserIds ?? []).map((id) =>
          validateObjectId(id, "legacy user ID"),
        ),
      ],
    },
  };

  applyMessageListFilters(filter, input);

  const { messages, total } = await getConversationPage(filter, input);

  return {
    messages: await addMessageNames(messages),
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.ceil(total / input.limit),
  };
};

/*
|--------------------------------------------------------------------------
| Get Message By ID
|--------------------------------------------------------------------------
*/

const findMessageById = async (
  messageId: string,
  userId: string,
  legacyUserIds: string[] = [],
): Promise<IMessageDocument> => {
  const messageObjectId = validateObjectId(messageId, "message ID");

  const userObjectId = validateObjectId(userId, "user ID");
  const allowedUserIds = [
    userObjectId,
    ...legacyUserIds.map((id) => validateObjectId(id, "legacy user ID")),
  ];

  const message = await Message.findOne({
    _id: messageObjectId,

    $or: [
      {
        senderId: { $in: allowedUserIds },
      },
      {
        recipientId: { $in: allowedUserIds },
      },
    ],
  }).exec();

  if (!message) {
    throw ApiError.notFound("Message not found.", {
      code: "MESSAGE_NOT_FOUND",
    });
  }

  return message;
};

export const getMessageById = async (
  messageId: string,
  userId: string,
  legacyUserIds: string[] = [],
): Promise<MessageResponse> => {
  const message = await findMessageById(messageId, userId, legacyUserIds);
  const [messageWithNames] = await addMessageNames([message]);
  return messageWithNames;
};

/*
|--------------------------------------------------------------------------
| Mark As Read
|--------------------------------------------------------------------------
*/

export const markMessageAsRead = async (
  messageId: string,
  userId: string,
  legacyUserIds: string[] = [],
): Promise<MessageResponse> => {
  const message = await findMessageById(messageId, userId, legacyUserIds);

  const userObjectId = validateObjectId(userId, "user ID");
  const allowedUserIds = [
    userObjectId,
    ...legacyUserIds.map((id) => validateObjectId(id, "legacy user ID")),
  ];

  if (!allowedUserIds.some((id) => message.recipientId.equals(id))) {
    throw ApiError.forbidden("Only the recipient can mark a message as read.", {
      code: "MESSAGE_READ_FORBIDDEN",
    });
  }

  if (message.status === MESSAGE_STATUSES.DELETED) {
    throw ApiError.badRequest("Deleted messages cannot be marked as read.", {
      code: "MESSAGE_DELETED",
    });
  }

  message.status = MESSAGE_STATUSES.READ;

  message.readAt = new Date();
  message.unreadAt = undefined;

  await message.save();

  const [messageWithNames] = await addMessageNames([message]);
  return messageWithNames;
};

/*
|--------------------------------------------------------------------------
| Archive Message
|--------------------------------------------------------------------------
*/

export const archiveMessage = async (
  messageId: string,
  userId: string,
  legacyUserIds: string[] = [],
): Promise<MessageResponse> => {
  const message = await findMessageById(messageId, userId, legacyUserIds);

  if (message.status === MESSAGE_STATUSES.DELETED) {
    throw ApiError.badRequest("Deleted messages cannot be archived.", {
      code: "MESSAGE_DELETED",
    });
  }

  const allowedUserIds = [
    validateObjectId(userId, "user ID"),
    ...legacyUserIds.map((id) => validateObjectId(id, "legacy user ID")),
  ];
  const participantFilter = {
    $or: [
      { recipientId: { $in: allowedUserIds } },
      { senderId: { $in: allowedUserIds } },
    ],
  };
  const threadId = message.threadId ?? message._id;
  await Message.updateMany(
    {
      $and: [participantFilter, { $or: [{ threadId }, { _id: threadId }] }],
      status: { $ne: MESSAGE_STATUSES.DELETED },
    },
    {
      $set: {
        status: MESSAGE_STATUSES.ARCHIVED,
        archivedAt: new Date(),
      },
    },
  ).exec();

  const [messageWithNames] = await addMessageNames([
    (await Message.findById(message._id).exec()) ?? message,
  ]);
  return messageWithNames;
};

/*
|--------------------------------------------------------------------------
| Delete Message
|--------------------------------------------------------------------------
*/

export const deleteMessage = async (
  messageId: string,
  userId: string,
  legacyUserIds: string[] = [],
): Promise<void> => {
  const message = await findMessageById(messageId, userId, legacyUserIds);

  if (message.status === MESSAGE_STATUSES.DELETED) {
    return;
  }

  const allowedUserIds = [
    validateObjectId(userId, "user ID"),
    ...legacyUserIds.map((id) => validateObjectId(id, "legacy user ID")),
  ];
  const participantFilter = {
    $or: [
      { recipientId: { $in: allowedUserIds } },
      { senderId: { $in: allowedUserIds } },
    ],
  };
  const threadId = message.threadId ?? message._id;
  await Message.updateMany(
    {
      $and: [participantFilter, { $or: [{ threadId }, { _id: threadId }] }],
    },
    {
      $set: {
        status: MESSAGE_STATUSES.DELETED,
        deletedAt: new Date(),
      },
    },
  ).exec();
};
