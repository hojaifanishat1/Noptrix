import { Types } from "mongoose";

import { Announcement, type IAnnouncementDocument } from "./announcement.model";

import {
  RiderAnnouncementRecipient,
  type IRiderAnnouncementRecipient,
} from "./rider-announcement-recipient.model";

import {
  AnnouncementRecipient,
  type IAnnouncementRecipientDocument,
} from "./announcement-recipient.model";

import {
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_STATUSES,
  ANNOUNCEMENT_TARGET_TYPES,
  type AnnouncementPriority,
  type AnnouncementStatus,
  type AnnouncementTargetType,
  type AnnouncementAttachment,
} from "./announcement.types";

import { User } from "../../users/user.model";

import { Admin } from "../../admins/admin.model";

import { Role } from "../../roles/role.model";

import { Owner } from "../../owners/owner.model";

import { Rider } from "../../riders/rider.model";

import { ApiError } from "../../../utils/ApiError";

import {
  scheduleAnnouncementPublish,
  scheduleAnnouncementExpiry,
  removeAnnouncementJob,
} from "../../../jobs/announcement.job";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export interface CreateAnnouncementServiceInput {
  title: string;
  body: string;
  priority?: AnnouncementPriority;
  targetType: AnnouncementTargetType;
  targetRoleIds?: string[];
  targetUserIds?: string[];
  targetRiderIds?: string[];
  scheduledAt?: Date;
  expiresAt?: Date;
  attachments?: AnnouncementAttachment[];
}

export interface UpdateAnnouncementServiceInput {
  title?: string;
  body?: string;
  priority?: AnnouncementPriority;
  targetType?: AnnouncementTargetType;
  targetRoleIds?: string[];
  targetUserIds?: string[];
  targetRiderIds?: string[];
  scheduledAt?: Date;
  expiresAt?: Date;
  attachments?: AnnouncementAttachment[];
}

export interface AnnouncementListServiceInput {
  page: number;
  limit: number;
  status?: AnnouncementStatus;
  priority?: AnnouncementPriority;
  targetType?: AnnouncementTargetType;
  search?: string;
}

export interface RecipientListServiceInput {
  userId: string;
  page: number;
  limit: number;
  unreadOnly?: boolean;
}

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const ACTIVE_USER_STATUSES = ["ACTIVE"] as const;

const ACTIVE_ADMIN_STATUSES = ["ACTIVE"] as const;

const ACTIVE_OWNER_STATUSES = ["ACTIVE"] as const;

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const validateObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`${fieldName} is invalid.`);
  }

  return new Types.ObjectId(value);
};

const getPagination = (page: number, limit: number) => {
  const safePage = Math.max(1, Math.floor(page || 1));

  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
};

/*
|--------------------------------------------------------------------------
| Validate Administrative User
|--------------------------------------------------------------------------
*/

const validateAdministrativeUser = async (userId: string): Promise<void> => {
  const objectId = validateObjectId(userId, "User ID");

  const user = await User.findOne({
    _id: objectId,
    status: {
      $in: ACTIVE_USER_STATUSES,
    },
  })
    .select("_id")
    .lean();

  if (!user) {
    throw ApiError.forbidden("The authenticated user is not active.");
  }

  const owner = await Owner.findOne({
    userId: objectId,
    status: {
      $in: ACTIVE_OWNER_STATUSES,
    },
  })
    .select("_id")
    .lean();

  if (owner) {
    return;
  }

  const admin = await Admin.findOne({
    userId: objectId,
    status: {
      $in: ACTIVE_ADMIN_STATUSES,
    },
  })
    .select("_id roleId")
    .lean();

  if (!admin) {
    throw ApiError.forbidden(
      "Only administrative users can manage announcements.",
    );
  }
};

/*
|--------------------------------------------------------------------------
| Resolve Target Users
|--------------------------------------------------------------------------
*/

const resolveTargetUserIds = async (
  targetType: AnnouncementTargetType,
  targetRoleIds?: string[],
  targetUserIds?: string[],
): Promise<Types.ObjectId[]> => {
  if (targetType === ANNOUNCEMENT_TARGET_TYPES.ALL_ADMINS) {
    const admins = await Admin.find({
      status: {
        $in: ACTIVE_ADMIN_STATUSES,
      },
    })
      .select("userId")
      .lean();

    const owners = await Owner.find({
      status: {
        $in: ACTIVE_OWNER_STATUSES,
      },
    })
      .select("userId")
      .lean();

    return [
      ...new Map(
        [
          ...admins.map((item) => item.userId.toString()),
          ...owners.map((item) => item.userId.toString()),
        ].map((id) => [id, new Types.ObjectId(id)]),
      ).values(),
    ];
  }

  if (targetType === ANNOUNCEMENT_TARGET_TYPES.ROLES) {
    const roleIds = (targetRoleIds ?? []).map((id) =>
      validateObjectId(id, "Target role ID"),
    );

    if (roleIds.length === 0) {
      throw ApiError.badRequest("At least one target role is required.");
    }

    const roles = await Role.find({
      _id: {
        $in: roleIds,
      },
      status: "ACTIVE",
    })
      .select("_id")
      .lean();

    if (roles.length !== roleIds.length) {
      throw ApiError.badRequest(
        "One or more target roles are invalid or inactive.",
      );
    }

    const admins = await Admin.find({
      roleId: {
        $in: roleIds,
      },
      status: {
        $in: ACTIVE_ADMIN_STATUSES,
      },
    })
      .select("userId")
      .lean();

    return [
      ...new Map(
        admins.map((item) => [item.userId.toString(), item.userId]),
      ).values(),
    ];
  }

  if (targetType === ANNOUNCEMENT_TARGET_TYPES.USERS) {
    const userIds = (targetUserIds ?? []).map((id) =>
      validateObjectId(id, "Target user ID"),
    );

    if (userIds.length === 0) {
      throw ApiError.badRequest("At least one target user is required.");
    }

    const users = await User.find({
      _id: {
        $in: userIds,
      },
      status: {
        $in: ACTIVE_USER_STATUSES,
      },
    })
      .select("_id")
      .lean();

    if (users.length !== userIds.length) {
      throw ApiError.badRequest(
        "One or more target users are invalid or inactive.",
      );
    }

    return [
      ...new Map(users.map((item) => [item._id.toString(), item._id])).values(),
    ];
  }

  throw ApiError.badRequest("Invalid announcement target type.");
};

/*
|--------------------------------------------------------------------------
| Resolve Target Riders
|--------------------------------------------------------------------------
*/

const resolveTargetRiderIds = async (
  targetType: AnnouncementTargetType,
  targetRiderIds?: string[],
): Promise<Types.ObjectId[]> => {
  if (targetType === ANNOUNCEMENT_TARGET_TYPES.ALL_RIDERS) {
    const riders = await Rider.find({ status: "ACTIVE" }).select("_id").lean();
    return riders.map((rider) => rider._id);
  }

  if (targetType === ANNOUNCEMENT_TARGET_TYPES.RIDERS) {
    const riderIds = (targetRiderIds ?? []).map((id) =>
      validateObjectId(id, "Target rider ID"),
    );

    if (riderIds.length === 0) {
      throw ApiError.badRequest("At least one target rider is required.");
    }

    const riders = await Rider.find({
      _id: { $in: riderIds },
      status: "ACTIVE",
    }).select("_id").lean();

    if (riders.length !== riderIds.length) {
      throw ApiError.badRequest("One or more target riders are invalid or inactive.");
    }

    return riders.map((rider) => rider._id);
  }

  return [];
};

const createRiderRecipients = async (
  announcementId: Types.ObjectId,
  riderIds: Types.ObjectId[],
): Promise<void> => {
  if (riderIds.length === 0) return;

  await RiderAnnouncementRecipient.bulkWrite(
    riderIds.map((riderId) => ({
      updateOne: {
        filter: { announcementId, riderId },
        update: {
          $setOnInsert: {
            announcementId,
            riderId,
            deliveredAt: new Date(),
          },
        },
        upsert: true,
      },
    })),
  );
};

/*
|--------------------------------------------------------------------------
| Create Recipients
|--------------------------------------------------------------------------
*/

const createRecipients = async (
  announcementId: Types.ObjectId,
  userIds: Types.ObjectId[],
): Promise<void> => {
  if (userIds.length === 0) {
    return;
  }

  const documents = userIds.map((userId) => ({
    announcementId,
    userId,
    deliveredAt: new Date(),
  }));

  await AnnouncementRecipient.bulkWrite(
    documents.map((document) => ({
      updateOne: {
        filter: {
          announcementId,
          userId: document.userId,
        },
        update: {
          $setOnInsert: document,
        },
        upsert: true,
      },
    })),
  );
};

/*
|--------------------------------------------------------------------------
| Create Announcement
|--------------------------------------------------------------------------
*/

export const createAnnouncement = async (
  createdBy: string,
  data: CreateAnnouncementServiceInput,
): Promise<IAnnouncementDocument> => {
  await validateAdministrativeUser(createdBy);

  const creatorId = validateObjectId(createdBy, "Creator ID");

  const scheduledAt = data.scheduledAt;

  const now = new Date();

  const status =
    scheduledAt && scheduledAt > now
      ? ANNOUNCEMENT_STATUSES.SCHEDULED
      : ANNOUNCEMENT_STATUSES.PUBLISHED;

  const announcement = await Announcement.create({
    createdBy: creatorId,

    title: data.title,

    body: data.body,

    priority: data.priority ?? ANNOUNCEMENT_PRIORITIES.NORMAL,

    targetType: data.targetType,

    targetRoleIds: data.targetRoleIds?.map((id) =>
      validateObjectId(id, "Target role ID"),
    ),

    targetUserIds: data.targetUserIds?.map((id) =>
      validateObjectId(id, "Target user ID"),
    ),

    targetRiderIds: data.targetRiderIds?.map((id) =>
      validateObjectId(id, "Target rider ID"),
    ),

    status,

    scheduledAt,

    publishedAt: status === ANNOUNCEMENT_STATUSES.PUBLISHED ? now : undefined,

    expiresAt: data.expiresAt,

    attachments: data.attachments,
  });

  const targetUserIds = await resolveTargetUserIds(
    data.targetType,
    data.targetRoleIds,
    data.targetUserIds,
  );
  const targetRiderIds = await resolveTargetRiderIds(
    data.targetType,
    data.targetRiderIds,
  );

  if (status === ANNOUNCEMENT_STATUSES.PUBLISHED) {
    await createRecipients(announcement._id, targetUserIds);
    await createRiderRecipients(announcement._id, targetRiderIds);
  }

  /*
        |--------------------------------------------------------------------------
        | Schedule Background Jobs
        |--------------------------------------------------------------------------
        */

  const announcementId = announcement._id.toString();

  if (status === ANNOUNCEMENT_STATUSES.SCHEDULED && scheduledAt) {
    await scheduleAnnouncementPublish(announcementId, scheduledAt, {
      createdBy: creatorId.toString(),
    });
  }

  if (data.expiresAt) {
    await scheduleAnnouncementExpiry(announcementId, data.expiresAt, {
      createdBy: creatorId.toString(),
    });
  }

  return announcement;
};

/*
|--------------------------------------------------------------------------
| Get Announcement
|--------------------------------------------------------------------------
*/

export const getAnnouncementById = async (
  announcementId: string,
): Promise<IAnnouncementDocument> => {
  const id = validateObjectId(announcementId, "Announcement ID");

  const announcement = await Announcement.findById(id);

  if (!announcement) {
    throw ApiError.notFound("Announcement not found.");
  }

  return announcement;
};

/*
|--------------------------------------------------------------------------
| List Announcements
|--------------------------------------------------------------------------
*/

export const getAnnouncements = async (
  input: AnnouncementListServiceInput,
): Promise<{
  announcements: IAnnouncementDocument[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const { page, limit, skip } = getPagination(input.page, input.limit);

  const filter: Record<string, unknown> = {};

  if (input.status) {
    filter.status = input.status;
  }

  if (input.priority) {
    filter.priority = input.priority;
  }

  if (input.targetType) {
    filter.targetType = input.targetType;
  }

  if (input.search) {
    const escaped = input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    filter.$or = [
      {
        title: {
          $regex: escaped,
          $options: "i",
        },
      },
      {
        body: {
          $regex: escaped,
          $options: "i",
        },
      },
    ];
  }

  const [announcements, total] = await Promise.all([
    Announcement.find(filter)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit),

    Announcement.countDocuments(filter),
  ]);

  return {
    announcements,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

/*
|--------------------------------------------------------------------------
| Update Announcement
|--------------------------------------------------------------------------
*/

export const updateAnnouncement = async (
  announcementId: string,
  updatedBy: string,
  data: UpdateAnnouncementServiceInput,
): Promise<IAnnouncementDocument> => {
  await validateAdministrativeUser(updatedBy);

  const id = validateObjectId(announcementId, "Announcement ID");

  const userId = validateObjectId(updatedBy, "Updater ID");

  const announcement = await Announcement.findById(id);

  if (!announcement) {
    throw ApiError.notFound("Announcement not found.");
  }

  if (announcement.status === ANNOUNCEMENT_STATUSES.ARCHIVED) {
    throw ApiError.conflict("Archived announcements cannot be updated.");
  }

  if (announcement.status === ANNOUNCEMENT_STATUSES.EXPIRED) {
    throw ApiError.conflict("Expired announcements cannot be updated.");
  }

  if (data.title !== undefined) {
    announcement.title = data.title;
  }

  if (data.body !== undefined) {
    announcement.body = data.body;
  }

  if (data.priority !== undefined) {
    announcement.priority = data.priority;
  }

  if (data.targetType !== undefined) {
    announcement.targetType = data.targetType;
  }

  if (data.targetRoleIds !== undefined) {
    announcement.targetRoleIds = data.targetRoleIds.map((item) =>
      validateObjectId(item, "Target role ID"),
    );
  }

  if (data.targetUserIds !== undefined) {
    announcement.targetUserIds = data.targetUserIds.map((item) =>
      validateObjectId(item, "Target user ID"),
    );
  }

  if (data.scheduledAt !== undefined) {
    announcement.scheduledAt = data.scheduledAt;
  }

  if (data.expiresAt !== undefined) {
    announcement.expiresAt = data.expiresAt;
  }

  if (data.attachments !== undefined) {
    announcement.attachments = data.attachments;
  }

  announcement.updatedBy = userId;

  const wasPublished = announcement.status === ANNOUNCEMENT_STATUSES.PUBLISHED;

  if (announcement.scheduledAt && announcement.scheduledAt > new Date()) {
    announcement.status = ANNOUNCEMENT_STATUSES.SCHEDULED;
    announcement.publishedAt = undefined;
  } else if (
    announcement.status === ANNOUNCEMENT_STATUSES.DRAFT ||
    announcement.status === ANNOUNCEMENT_STATUSES.SCHEDULED
  ) {
    announcement.status = ANNOUNCEMENT_STATUSES.PUBLISHED;

    announcement.publishedAt = announcement.publishedAt ?? new Date();
  }

  await announcement.save();

  const announcementJobId = announcement._id.toString();

  /*
        |--------------------------------------------------------------------------
        | Reconcile Background Jobs
        |--------------------------------------------------------------------------
        */

  await removeAnnouncementJob(announcementJobId, "publish");

  await removeAnnouncementJob(announcementJobId, "expire");

  if (
    announcement.status === ANNOUNCEMENT_STATUSES.SCHEDULED &&
    announcement.scheduledAt
  ) {
    await scheduleAnnouncementPublish(
      announcementJobId,
      announcement.scheduledAt,
      {
        updatedBy: userId.toString(),
      },
    );
  }

  if (announcement.expiresAt) {
    await scheduleAnnouncementExpiry(
      announcementJobId,
      announcement.expiresAt,
      {
        updatedBy: userId.toString(),
      },
    );
  }

  if (
    !wasPublished &&
    announcement.status === ANNOUNCEMENT_STATUSES.PUBLISHED
  ) {
    const targetUserIds = await resolveTargetUserIds(
      announcement.targetType,
      announcement.targetRoleIds?.map((item) => item.toString()),
      announcement.targetUserIds?.map((item) => item.toString()),
    );

    await createRecipients(announcement._id, targetUserIds);
    const targetRiderIds = await resolveTargetRiderIds(
      announcement.targetType,
      announcement.targetRiderIds?.map((item) => item.toString()),
    );
    await createRiderRecipients(announcement._id, targetRiderIds);
  }

  return announcement;
};

/*
|--------------------------------------------------------------------------
| Publish Announcement
|--------------------------------------------------------------------------
*/

export const publishAnnouncement = async (
  announcementId: string,
  publishedBy: string,
): Promise<IAnnouncementDocument> => {
  await validateAdministrativeUser(publishedBy);

  const id = validateObjectId(announcementId, "Announcement ID");

  const announcement = await Announcement.findById(id);

  if (!announcement) {
    throw ApiError.notFound("Announcement not found.");
  }

  if (announcement.status === ANNOUNCEMENT_STATUSES.ARCHIVED) {
    throw ApiError.conflict("Archived announcements cannot be published.");
  }

  if (announcement.status === ANNOUNCEMENT_STATUSES.EXPIRED) {
    throw ApiError.conflict("Expired announcements cannot be published.");
  }

  const now = new Date();

  if (announcement.expiresAt && announcement.expiresAt <= now) {
    announcement.status = ANNOUNCEMENT_STATUSES.EXPIRED;

    await announcement.save();

    throw ApiError.conflict("This announcement has already expired.");
  }

  announcement.status = ANNOUNCEMENT_STATUSES.PUBLISHED;

  announcement.publishedAt = now;

  announcement.scheduledAt = undefined;

  announcement.updatedBy = validateObjectId(publishedBy, "Publisher ID");

  await announcement.save();

  await removeAnnouncementJob(announcement._id.toString(), "publish");

  await removeAnnouncementJob(announcement._id.toString(), "expire");

  const targetUserIds = await resolveTargetUserIds(
    announcement.targetType,
    announcement.targetRoleIds?.map((item) => item.toString()),
    announcement.targetUserIds?.map((item) => item.toString()),
  );

  await createRecipients(announcement._id, targetUserIds);
  const targetRiderIds = await resolveTargetRiderIds(
    announcement.targetType,
    announcement.targetRiderIds?.map((item) => item.toString()),
  );
  await createRiderRecipients(announcement._id, targetRiderIds);

  if (announcement.expiresAt) {
    await scheduleAnnouncementExpiry(
      announcement._id.toString(),
      announcement.expiresAt,
      {
        publishedBy: publishedBy,
      },
    );
  }

  return announcement;
};

/*
|--------------------------------------------------------------------------
| Archive Announcement
|--------------------------------------------------------------------------
*/

export const archiveAnnouncement = async (
  announcementId: string,
  archivedBy: string,
): Promise<IAnnouncementDocument> => {
  await validateAdministrativeUser(archivedBy);

  const announcement = await getAnnouncementById(announcementId);

  if (announcement.status === ANNOUNCEMENT_STATUSES.ARCHIVED) {
    return announcement;
  }

  announcement.status = ANNOUNCEMENT_STATUSES.ARCHIVED;

  announcement.updatedBy = validateObjectId(archivedBy, "Archiver ID");

  await announcement.save();

  await removeAnnouncementJob(announcement._id.toString(), "publish");

  await removeAnnouncementJob(announcement._id.toString(), "expire");

  return announcement;
};

/*
|--------------------------------------------------------------------------
| Refresh Expired Status
|--------------------------------------------------------------------------
*/

export const refreshExpiredAnnouncement = async (
  announcementId: string,
): Promise<IAnnouncementDocument> => {
  const announcement = await getAnnouncementById(announcementId);

  if (
    announcement.expiresAt &&
    announcement.expiresAt <= new Date() &&
    announcement.status !== ANNOUNCEMENT_STATUSES.ARCHIVED
  ) {
    announcement.status = ANNOUNCEMENT_STATUSES.EXPIRED;

    await announcement.save();
  }

  return announcement;
};

/*
|--------------------------------------------------------------------------
| Recipient Inbox
|--------------------------------------------------------------------------
*/

export const getMyAnnouncements = async (
  input: RecipientListServiceInput,
): Promise<{
  recipients: IAnnouncementRecipientDocument[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const userId = validateObjectId(input.userId, "User ID");

  const { page, limit, skip } = getPagination(input.page, input.limit);

  const filter: Record<string, unknown> = {
    userId,
  };

  if (input.unreadOnly) {
    filter.readAt = {
      $exists: false,
    };
  }

  const [recipients, total] = await Promise.all([
    AnnouncementRecipient.find(filter)
      .populate("announcementId")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit),

    AnnouncementRecipient.countDocuments(filter),
  ]);

  return {
    recipients,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

/*
|--------------------------------------------------------------------------
| Get Recipient Announcement
|--------------------------------------------------------------------------
*/

export const getMyAnnouncementById = async (
  announcementId: string,
  userId: string,
): Promise<IAnnouncementRecipientDocument> => {
  const announcementObjectId = validateObjectId(
    announcementId,
    "Announcement ID",
  );

  const userObjectId = validateObjectId(userId, "User ID");

  const recipient = await AnnouncementRecipient.findOne({
    announcementId: announcementObjectId,
    userId: userObjectId,
  }).populate("announcementId");

  if (!recipient) {
    throw ApiError.notFound("Announcement not found.");
  }

  return recipient;
};

/*
|--------------------------------------------------------------------------
| Mark Announcement Read
|--------------------------------------------------------------------------
*/

export const markAnnouncementAsRead = async (
  announcementId: string,
  userId: string,
): Promise<IAnnouncementRecipientDocument> => {
  const recipient = await getMyAnnouncementById(announcementId, userId);

  if (!recipient.readAt) {
    recipient.readAt = new Date();

    await recipient.save();
  }

  return recipient;
};

/*
|--------------------------------------------------------------------------
| Dismiss Announcement
|--------------------------------------------------------------------------
*/

export const dismissAnnouncement = async (
  announcementId: string,
  userId: string,
): Promise<IAnnouncementRecipientDocument> => {
  const recipient = await getMyAnnouncementById(announcementId, userId);

  if (!recipient.dismissedAt) {
    recipient.dismissedAt = new Date();

    await recipient.save();
  }

  return recipient;
};

/*
|--------------------------------------------------------------------------
| System Scheduled Publish
|--------------------------------------------------------------------------
|
| Used by the BullMQ announcement worker.
|
| Unlike manual publish, this function does not require
| a human administrative user. The announcement creator
| remains the audit owner for the automated transition.
|
|--------------------------------------------------------------------------
*/

export const publishScheduledAnnouncement = async (
  announcementId: string,
): Promise<IAnnouncementDocument> => {
  validateObjectId(announcementId, "Announcement ID");

  const announcement = await Announcement.findById(announcementId);

  if (!announcement) {
    throw ApiError.notFound("Announcement not found.");
  }

  /*
        |--------------------------------------------------------------------------
        | Already Published
        |--------------------------------------------------------------------------
        */

  if (announcement.status === ANNOUNCEMENT_STATUSES.PUBLISHED) {
    return announcement;
  }

  /*
        |--------------------------------------------------------------------------
        | Invalid Status
        |--------------------------------------------------------------------------
        */

  if (
    announcement.status === ANNOUNCEMENT_STATUSES.ARCHIVED ||
    announcement.status === ANNOUNCEMENT_STATUSES.EXPIRED
  ) {
    return announcement;
  }

  /*
        |--------------------------------------------------------------------------
        | Scheduled Time Guard
        |--------------------------------------------------------------------------
        */

  if (
    announcement.scheduledAt &&
    announcement.scheduledAt.getTime() > Date.now()
  ) {
    return announcement;
  }

  /*
        |--------------------------------------------------------------------------
        | Expiry Guard
        |--------------------------------------------------------------------------
        */

  if (
    announcement.expiresAt &&
    announcement.expiresAt.getTime() <= Date.now()
  ) {
    announcement.status = ANNOUNCEMENT_STATUSES.EXPIRED;

    await announcement.save();

    return announcement;
  }

  /*
        |--------------------------------------------------------------------------
        | Publish
        |--------------------------------------------------------------------------
        */

  announcement.status = ANNOUNCEMENT_STATUSES.PUBLISHED;

  announcement.publishedAt = new Date();

  announcement.scheduledAt = undefined;

  /*
   * Automated publication has no human updater.
   * Keep the original creator as the audit reference.
   */
  announcement.updatedBy = announcement.createdBy;

  await announcement.save();

  await removeAnnouncementJob(announcement._id.toString(), "publish");

  if (announcement.expiresAt) {
    await removeAnnouncementJob(announcement._id.toString(), "expire");

    await scheduleAnnouncementExpiry(
      announcement._id.toString(),
      announcement.expiresAt,
      {
        createdBy: announcement.createdBy.toString(),
      },
    );
  }

  /*
        |--------------------------------------------------------------------------
        | Create Recipients
        |--------------------------------------------------------------------------
        */

  const userIds = await resolveTargetUserIds(
    announcement.targetType,
    announcement.targetRoleIds?.map((id) => id.toString()),
    announcement.targetUserIds?.map((id) => id.toString()),
  );

  await createRecipients(announcement._id, userIds);
  const riderIds = await resolveTargetRiderIds(
    announcement.targetType,
    announcement.targetRiderIds?.map((id) => id.toString()),
  );
  await createRiderRecipients(announcement._id, riderIds);

  return announcement;
};


/*
|--------------------------------------------------------------------------
| Rider Recipient Inbox
|--------------------------------------------------------------------------
*/

export interface RiderRecipientListServiceInput {
  riderId: string;
  page: number;
  limit: number;
  unreadOnly?: boolean;
}

export const getMyRiderAnnouncements = async (
  input: RiderRecipientListServiceInput,
): Promise<{
  recipients: IRiderAnnouncementRecipient[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> => {
  const riderId = validateObjectId(input.riderId, "Rider ID");
  const { page, limit, skip } = getPagination(input.page, input.limit);
  const filter: Record<string, unknown> = { riderId };

  if (input.unreadOnly) {
    filter.readAt = { $exists: false };
  }

  const [recipients, total] = await Promise.all([
    RiderAnnouncementRecipient.find(filter)
      .populate("announcementId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    RiderAnnouncementRecipient.countDocuments(filter),
  ]);

  return {
    recipients,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

export const getMyRiderAnnouncementById = async (
  announcementId: string,
  riderId: string,
): Promise<IRiderAnnouncementRecipient> => {
  const announcementObjectId = validateObjectId(announcementId, "Announcement ID");
  const riderObjectId = validateObjectId(riderId, "Rider ID");

  const recipient = await RiderAnnouncementRecipient.findOne({
    announcementId: announcementObjectId,
    riderId: riderObjectId,
  }).populate("announcementId");

  if (!recipient) {
    throw ApiError.notFound("Announcement not found.");
  }

  return recipient;
};

export const markRiderAnnouncementAsRead = async (
  announcementId: string,
  riderId: string,
): Promise<IRiderAnnouncementRecipient> => {
  const recipient = await getMyRiderAnnouncementById(announcementId, riderId);

  if (!recipient.readAt) {
    recipient.readAt = new Date();
    await recipient.save();
  }

  return recipient;
};

export const dismissRiderAnnouncement = async (
  announcementId: string,
  riderId: string,
): Promise<IRiderAnnouncementRecipient> => {
  const recipient = await getMyRiderAnnouncementById(announcementId, riderId);

  if (!recipient.dismissedAt) {
    recipient.dismissedAt = new Date();
    await recipient.save();
  }

  return recipient;
};
