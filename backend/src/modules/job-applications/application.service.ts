import { PipelineStage, Types } from "mongoose";

import {
  JobApplication,
  JobApplicationStatus,
  JOB_APPLICATION_STATUSES,
} from "./application.model";

import {
  CreateJobApplicationInput,
  JobApplicationQueryInput,
  RecruitmentReportsQueryInput,
  UpdateJobApplicationStatusInput,
} from "./application.validator";

import { Vacancy } from "../job-vacancies/vacancy.model";

import { ApiError } from "../../utils/ApiError";

import { logger } from "../../utils/logger";

import { createNotification } from "../notifications/notification.service";

import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES,
} from "../notifications/notification.types";

import { enqueueNotificationCreated } from "../../jobs/notification.job";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const validateObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${fieldName}.`);
  }

  return new Types.ObjectId(value);
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/*
|--------------------------------------------------------------------------
| Status Transitions
|--------------------------------------------------------------------------
*/

const APPLICATION_STATUS_TRANSITIONS: Record<
  JobApplicationStatus,
  readonly JobApplicationStatus[]
> = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED", "WITHDRAWN"],

  UNDER_REVIEW: ["SHORTLISTED", "REJECTED", "WITHDRAWN"],

  SHORTLISTED: ["INTERVIEW", "REJECTED", "WITHDRAWN"],

  INTERVIEW: ["SELECTED", "REJECTED", "WITHDRAWN"],

  SELECTED: [],

  REJECTED: [],

  WITHDRAWN: [],
};

const canTransitionApplicationStatus = (
  currentStatus: JobApplicationStatus,
  nextStatus: JobApplicationStatus,
): boolean =>
  APPLICATION_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);

/*
|--------------------------------------------------------------------------
| Create
|--------------------------------------------------------------------------
*/

export const createJobApplication = async (
  applicantId: string,
  input: CreateJobApplicationInput,
) => {
  const applicantObjectId = validateObjectId(applicantId, "applicantId");

  const vacancyObjectId = validateObjectId(input.vacancyId, "vacancyId");

  const vacancy = await Vacancy.findById(vacancyObjectId);

  if (!vacancy) {
    throw ApiError.notFound("Job vacancy not found.");
  }

  if (vacancy.status !== "OPEN") {
    throw ApiError.badRequest(
      "Applications are only accepted for open vacancies.",
    );
  }

  if (
    vacancy.applicationDeadline &&
    vacancy.applicationDeadline.getTime() <= Date.now()
  ) {
    throw ApiError.badRequest("The application deadline has passed.");
  }

  const existingApplication = await JobApplication.findOne({
    vacancyId: vacancyObjectId,
    applicantId: applicantObjectId,
  }).lean();

  if (existingApplication) {
    throw ApiError.conflict("You have already applied for this vacancy.");
  }

  try {
    return await JobApplication.create({
      vacancyId: vacancyObjectId,

      applicantId: applicantObjectId,

      name: input.name.trim(),

      email: normalizeEmail(input.email),

      phone: input.phone?.trim(),

      resumeUrl: input.resumeUrl?.trim(),

      coverLetter: input.coverLetter?.trim(),

      status: "SUBMITTED",

      appliedAt: new Date(),
    });
  } catch (error: unknown) {
    /*
            |--------------------------------------------------------------------------
            | Unique-index race protection
            |--------------------------------------------------------------------------
            */

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (
        error as {
          code?: unknown;
        }
      ).code === 11000
    ) {
      throw ApiError.conflict("You have already applied for this vacancy.");
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Get By ID
|--------------------------------------------------------------------------
*/

export const getJobApplicationById = async (applicationId: string) => {
  const applicationObjectId = validateObjectId(applicationId, "applicationId");

  const application = await JobApplication.findById(applicationObjectId)
    .populate("vacancyId", "title slug department jobTitle status vacancyType")
    .populate("applicantId", "name email phone")
    .populate("reviewedBy", "name email");

  if (!application) {
    throw ApiError.notFound("Job application not found.");
  }

  return application;
};

/*
|--------------------------------------------------------------------------
| Get My Applications
|--------------------------------------------------------------------------
*/

export const getMyJobApplications = async (
  applicantId: string,
  query: JobApplicationQueryInput,
) => {
  const applicantObjectId = validateObjectId(applicantId, "applicantId");

  const page = query.page ?? 1;

  const limit = query.limit ?? 20;

  const filter: Record<string, unknown> = {
    applicantId: applicantObjectId,
  };

  if (query.status) {
    filter.status = query.status;
  }

  if (query.vacancyId) {
    filter.vacancyId = validateObjectId(query.vacancyId, "vacancyId");
  }

  if (query.search) {
    const search = escapeRegex(query.search.trim());

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }
  }

  const skip = (page - 1) * limit;

  const [applications, total] = await Promise.all([
    JobApplication.find(filter)
      .populate("vacancyId", "title slug department jobTitle status vacancyType")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    JobApplication.countDocuments(filter),
  ]);

  return {
    applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/*
|--------------------------------------------------------------------------
| Get All Applications
|--------------------------------------------------------------------------
*/

export const getAllJobApplications = async (
  query: JobApplicationQueryInput,
) => {
  const page = query.page ?? 1;

  const limit = query.limit ?? 20;

  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.vacancyId) {
    filter.vacancyId = validateObjectId(query.vacancyId, "vacancyId");
  }

  if (query.applicantId) {
    filter.applicantId = validateObjectId(query.applicantId, "applicantId");
  }

  if (query.riderConversionRequested !== undefined) {
    filter.riderConversionRequestedAt = {
      $exists: query.riderConversionRequested,
    };
  }
  if (query.riderConversionRequested) {
    filter.convertedToRiderAt = { $exists: false };
  }

  if (query.search) {
    const search = escapeRegex(query.search.trim());

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }
  }

  const skip = (page - 1) * limit;

  const [applications, total] = await Promise.all([
    JobApplication.find(filter)
      .populate("vacancyId", "title slug department jobTitle status vacancyType")
      .populate("applicantId", "name email phone")
      .populate("reviewedBy", "name email")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    JobApplication.countDocuments(filter),
  ]);

  return {
    applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/*
|--------------------------------------------------------------------------
| Update Status
|--------------------------------------------------------------------------
*/

export const updateJobApplicationStatus = async (
  applicationId: string,
  reviewerId: string,
  input: UpdateJobApplicationStatusInput,
) => {
  const applicationObjectId = validateObjectId(applicationId, "applicationId");

  /*
        |--------------------------------------------------------------------------
        | reviewerId is OWNER's User ID.
        |--------------------------------------------------------------------------
        */

  const reviewerObjectId = validateObjectId(reviewerId, "reviewerId");

  const application = await JobApplication.findById(applicationObjectId);

  if (!application) {
    throw ApiError.notFound("Job application not found.");
  }

  /*
        |--------------------------------------------------------------------------
        | Previous Status
        |--------------------------------------------------------------------------
        |
        | Capture this BEFORE changing application.status.
        | This value is required for auditability and notification
        | idempotency.
        |
        */

  const previousStatus = application.status;

  const nextStatus = input.status;

  const statusChanged = nextStatus !== previousStatus;

  if (
    statusChanged &&
    !canTransitionApplicationStatus(previousStatus, nextStatus)
  ) {
    throw ApiError.badRequest(
      `Cannot change application status from ${previousStatus} to ${nextStatus}.`,
    );
  }

  /*
        |--------------------------------------------------------------------------
        | Terminal States
        |--------------------------------------------------------------------------
        */

  if (
    !statusChanged &&
    (nextStatus === "SELECTED" ||
      nextStatus === "REJECTED" ||
      nextStatus === "WITHDRAWN")
  ) {
    throw ApiError.badRequest(
      `Application is already in ${nextStatus} status.`,
    );
  }

  /*
        |--------------------------------------------------------------------------
        | Status
        |--------------------------------------------------------------------------
        */

  application.status = nextStatus;

  application.reviewedBy = reviewerObjectId;

  application.reviewedAt = new Date();

  /*
        |--------------------------------------------------------------------------
        | Interview
        |--------------------------------------------------------------------------
        */

  if (nextStatus === "INTERVIEW") {
    if (!input.interviewAt) {
      throw ApiError.badRequest("Interview date and time is required.");
    }

    if (input.interviewAt.getTime() <= Date.now()) {
      throw ApiError.badRequest(
        "Interview date and time must be in the future.",
      );
    }

    application.interviewAt = input.interviewAt;
  }

  /*
        |--------------------------------------------------------------------------
        | Notes
        |--------------------------------------------------------------------------
        */

  if (input.notes !== undefined) {
    application.notes = input.notes.trim();
  }

  /*
        |--------------------------------------------------------------------------
        | Selected
        |--------------------------------------------------------------------------
        */

  if (statusChanged && nextStatus === "SELECTED") {
    application.selectedAt = new Date();
  }

  /*
        |--------------------------------------------------------------------------
        | Rejected
        |--------------------------------------------------------------------------
        */

  if (nextStatus === "REJECTED") {
    const reason = input.rejectionReason?.trim();

    if (!reason) {
      throw ApiError.badRequest("Rejection reason is required.");
    }

    application.rejectedAt = new Date();

    application.rejectionReason = reason;
  }

  /*
        |--------------------------------------------------------------------------
        | Withdrawn
        |--------------------------------------------------------------------------
        */

  if (statusChanged && nextStatus === "WITHDRAWN") {
    application.withdrawnAt = new Date();
  }

  await application.save();

  /*
        |--------------------------------------------------------------------------
        | Applicant Notification
        |--------------------------------------------------------------------------
        |
        | Notification failures must never roll back a successful
        | application status change.
        |
        */

  if (statusChanged) {
    try {
      const vacancy = await Vacancy.findById(application.vacancyId)
        .select("title slug")
        .lean();

      const vacancyTitle = vacancy?.title ?? "the position";

      const vacancySlug = vacancy?.slug;

      /*
                |--------------------------------------------------------------------------
                | Template Key
                |--------------------------------------------------------------------------
                */

      const templateKey = (() => {
        switch (nextStatus) {
          case "UNDER_REVIEW":
            return "job.application.under_review";

          case "SHORTLISTED":
            return "job.application.shortlisted";

          case "INTERVIEW":
            return "job.application.interview";

          case "SELECTED":
            return "job.application.selected";

          case "REJECTED":
            return "job.application.rejected";

          case "WITHDRAWN":
            return "job.application.withdrawn";

          default:
            return "job.application.status_updated";
        }
      })();

      /*
       * Event identifier for channel-specific notification templates.
       * Each application status can have its own EMAIL template.
       */
      const templateEvent = (() => {
        switch (nextStatus) {
          case "UNDER_REVIEW":
            return "JOB_APPLICATION_UNDER_REVIEW";

          case "SHORTLISTED":
            return "JOB_APPLICATION_SHORTLISTED";

          case "INTERVIEW":
            return "JOB_APPLICATION_INTERVIEW";

          case "SELECTED":
            return "JOB_APPLICATION_SELECTED";

          case "REJECTED":
            return "JOB_APPLICATION_REJECTED";

          case "WITHDRAWN":
            return "JOB_APPLICATION_WITHDRAWN";

          default:
            return "JOB_APPLICATION_STATUS_UPDATED";
        }
      })();

      /*
                |--------------------------------------------------------------------------
                | Action URL
                |--------------------------------------------------------------------------
                */

      const actionUrl = vacancySlug
        ? `/jobs/${encodeURIComponent(vacancySlug)}#apply`
        : undefined;

      /*
                |--------------------------------------------------------------------------
                | Template Variables
                |--------------------------------------------------------------------------
                */

      const templateVariables: Record<string, unknown> = {
        applicantName: application.name,

        vacancyTitle,

        vacancySlug,

        status: nextStatus,

        previousStatus,

        rejectionReason: application.rejectionReason,

        interviewAt: application.interviewAt,

        actionUrl,
      };

      /*
                |--------------------------------------------------------------------------
                | Default Fallback
                |--------------------------------------------------------------------------
                |
                | Templates are optional during rollout.
                | Existing behavior remains available until templates
                | are seeded/configured.
                |
                */

      const defaultNotification = (() => {
        switch (nextStatus) {
          case "UNDER_REVIEW":
            return {
              title: "Application Under Review",
              message: `Your application for ${vacancyTitle} is now under review.`,
            };

          case "SHORTLISTED":
            return {
              title: "Application Shortlisted",
              message: `Good news! Your application for ${vacancyTitle} has been shortlisted.`,
            };

          case "INTERVIEW":
            return {
              title: "Interview Scheduled",
              message: application.interviewAt
                ? `Your application for ${vacancyTitle} has moved to the interview stage. Interview: ${application.interviewAt.toISOString()}.`
                : `Your application for ${vacancyTitle} has moved to the interview stage.`,
            };

          case "SELECTED":
            return {
              title: "Application Selected",
              message: `Congratulations! You have been selected for ${vacancyTitle}.`,
            };

          case "REJECTED":
            return {
              title: "Application Update",
              message: `Your application for ${vacancyTitle} was not selected. Please review your application details for more information.`,
            };

          case "WITHDRAWN":
            return {
              title: "Application Withdrawn",
              message: `Your application for ${vacancyTitle} has been marked as withdrawn.`,
            };

          default:
            return {
              title: "Application Status Updated",
              message: `Your application for ${vacancyTitle} is now ${nextStatus.replaceAll("_", " ").toLowerCase()}.`,
            };
        }
      })();

      /*
                |--------------------------------------------------------------------------
                | Resolve + Render Template
                |--------------------------------------------------------------------------
                |
                | Use the in-app template as the canonical notification
                | content for the current Notification document.
                |
                */

      let notificationTitle = defaultNotification.title;

      let notificationMessage = defaultNotification.message;

      try {
        const { renderNotificationTemplate } =
          await import("../notifications/notification-template.service.js");

        const rendered = await renderNotificationTemplate({
          key: templateKey,

          channel: NOTIFICATION_CHANNELS.IN_APP,

          locale: "en",

          variables: templateVariables,
        });

        notificationTitle = rendered.title;

        notificationMessage = rendered.message;
      } catch (templateError) {
        /*
                    |--------------------------------------------------------------------------
                    | Template Fallback
                    |--------------------------------------------------------------------------
                    |
                    | A missing/incomplete template must not prevent
                    | the applicant from receiving the default message.
                    |
                    */

        logger.warn(
          {
            error: templateError,
            applicationId: application._id.toString(),
            templateKey,
            status: nextStatus,
          },
          "Notification template unavailable; using default application notification.",
        );
      }

      /*
                |--------------------------------------------------------------------------
                | Event Key
                |--------------------------------------------------------------------------
                |
                | Stable event identity:
                |
                | recipient + type + application + previousStatus + nextStatus
                |
                | This prevents duplicate notifications for the same
                | status transition.
                |
                */

      const notificationType =
        nextStatus === "INTERVIEW"
          ? NOTIFICATION_TYPES.JOB_APPLICATION_INTERVIEW
          : NOTIFICATION_TYPES.JOB_APPLICATION_STATUS;

      const eventKey = [
        "job-application",
        application._id.toString(),
        previousStatus,
        nextStatus,
      ].join(":");

      /*
                |--------------------------------------------------------------------------
                | Priority
                |--------------------------------------------------------------------------
                */

      const notificationPriority =
        nextStatus === "SELECTED"
          ? NOTIFICATION_PRIORITIES.HIGH
          : NOTIFICATION_PRIORITIES.NORMAL;

      /*
                |--------------------------------------------------------------------------
                | Create Notification
                |--------------------------------------------------------------------------
                */

      const notification = await createNotification({
        recipientId: application.applicantId,

        type: notificationType,

        priority: notificationPriority,

        title: notificationTitle,

        message: notificationMessage,

        channels: [
          NOTIFICATION_CHANNELS.IN_APP,
          NOTIFICATION_CHANNELS.EMAIL,
          NOTIFICATION_CHANNELS.PUSH,
        ],

        metadata: {
          applicationId: application._id.toString(),

          vacancyId: application.vacancyId.toString(),

          vacancySlug,

          status: nextStatus,

          previousStatus,

          interviewAt: application.interviewAt,

          rejectionReason: application.rejectionReason,

          actionUrl,

          templateKey,

          templateEvent,

          templateLocale: "en",

          templateVariables,

          eventKey,
        },
      });

      /*
                |--------------------------------------------------------------------------
                | BullMQ
                |--------------------------------------------------------------------------
                */

      await enqueueNotificationCreated(
        {
          userId: application.applicantId.toString(),
        },

        notification.title,

        notification.message,

        notification.priority,

        {
          applicationId: application._id.toString(),

          vacancyId: application.vacancyId.toString(),

          vacancySlug,

          status: nextStatus,

          previousStatus,

          interviewAt: application.interviewAt,

          rejectionReason: application.rejectionReason,

          actionUrl,

          templateKey,

          templateEvent,

          eventKey,
        },

        notification._id.toString(),
      );
    } catch (notificationError) {
      logger.error(
        {
          error: notificationError,

          applicationId: application._id.toString(),

          previousStatus,

          status: nextStatus,
        },
        "Job application status notification failed.",
      );
    }
  }

  return application;
};

/*
|--------------------------------------------------------------------------
| Withdraw
|--------------------------------------------------------------------------
*/

export const requestRiderConversion = async (
  applicationId: string,
  requestedBy: string,
) => {
  const applicationObjectId = validateObjectId(applicationId, "applicationId");
  const requesterObjectId = validateObjectId(requestedBy, "requesterId");

  const application = await JobApplication.findById(applicationObjectId);
  if (!application) {
    throw ApiError.notFound("Job application not found.");
  }

  if (application.status !== "SELECTED") {
    throw ApiError.badRequest(
      "Only SELECTED applicants can be submitted for rider conversion.",
    );
  }

  const vacancy = await Vacancy.findById(application.vacancyId)
    .select("vacancyType")
    .lean()
    .exec();
  if (vacancy?.vacancyType !== "RIDER") {
    throw ApiError.badRequest("Only RIDER vacancy applicants can be converted.");
  }

  if (application.riderId || application.convertedToRiderAt) {
    throw ApiError.conflict("This application has already been converted.");
  }

  if (application.riderConversionRequestedAt) {
    throw ApiError.conflict(
      "This application is already awaiting owner approval.",
    );
  }

  application.riderConversionRequestedAt = new Date();
  application.riderConversionRequestedBy = requesterObjectId;
  await application.save();

  return application;
};

export const withdrawJobApplication = async (
  applicationId: string,
  applicantId: string,
) => {
  const applicationObjectId = validateObjectId(applicationId, "applicationId");

  const applicantObjectId = validateObjectId(applicantId, "applicantId");

  const application = await JobApplication.findById(applicationObjectId);

  if (!application) {
    throw ApiError.notFound("Job application not found.");
  }

  if (!application.applicantId.equals(applicantObjectId)) {
    throw ApiError.forbidden(
      "You are not allowed to withdraw this application.",
    );
  }

  const withdrawableStatuses: readonly JobApplicationStatus[] = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "SHORTLISTED",
    "INTERVIEW",
  ];

  if (!withdrawableStatuses.includes(application.status)) {
    throw ApiError.badRequest(
      `Application cannot be withdrawn from ${application.status} status.`,
    );
  }

  application.status = "WITHDRAWN";

  application.withdrawnAt = new Date();

  await application.save();

  return application;
};

/*
|--------------------------------------------------------------------------
| Vacancy Application Summary
|--------------------------------------------------------------------------
*/

export const getVacancyApplicationSummary = async (vacancyId: string) => {
  const vacancyObjectId = validateObjectId(vacancyId, "vacancyId");

  const vacancy = await Vacancy.findById(vacancyObjectId).lean();

  if (!vacancy) {
    throw ApiError.notFound("Job vacancy not found.");
  }

  const summary = await JobApplication.aggregate([
    {
      $match: {
        vacancyId: vacancyObjectId,
      },
    },
    {
      $group: {
        _id: "$status",
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  const result: Record<JobApplicationStatus, number> = {
    SUBMITTED: 0,
    UNDER_REVIEW: 0,
    SHORTLISTED: 0,
    INTERVIEW: 0,
    SELECTED: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
  };

  for (const item of summary) {
    const status = item._id as JobApplicationStatus;

    if (JOB_APPLICATION_STATUSES.includes(status)) {
      result[status] = item.count;
    }
  }

  return {
    vacancyId,
    total: Object.values(result).reduce((sum, count) => sum + count, 0),
    byStatus: result,
  };
};

/*
|--------------------------------------------------------------------------
| Recruitment Reports
|--------------------------------------------------------------------------
*/

interface RecruitmentReportsAggregation {
  statuses: Array<{ _id: JobApplicationStatus; count: number }>;
  monthlyApplications: Array<{ _id: string; count: number }>;
  vacancyApplications: Array<{
    vacancyId: Types.ObjectId;
    title: string;
    department: string;
    status?: string;
    total: number;
    statuses: Array<{ status: JobApplicationStatus; count: number }>;
  }>;
}

const createEmptyApplicationStatusCounts = (): Record<
  JobApplicationStatus,
  number
> => ({
  SUBMITTED: 0,
  UNDER_REVIEW: 0,
  SHORTLISTED: 0,
  INTERVIEW: 0,
  SELECTED: 0,
  REJECTED: 0,
  WITHDRAWN: 0,
});

export const getRecruitmentReports = async (
  query: RecruitmentReportsQueryInput,
) => {
  const appliedAt: { $gte?: Date; $lte?: Date } = {};
  if (query.from) appliedAt.$gte = new Date(query.from);
  if (query.to) appliedAt.$lte = new Date(query.to);

  const facets: PipelineStage.Facet = {
    $facet: {
      statuses: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
      monthlyApplications: [
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m",
                date: "$appliedAt",
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ],
      vacancyApplications: [
        {
          $group: {
            _id: { vacancyId: "$vacancyId", status: "$status" },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.vacancyId",
            total: { $sum: "$count" },
            statuses: {
              $push: {
                status: "$_id.status",
                count: "$count",
              },
            },
          },
        },
        {
          $lookup: {
            from: Vacancy.collection.name,
            localField: "_id",
            foreignField: "_id",
            as: "vacancy",
          },
        },
        {
          $unwind: {
            path: "$vacancy",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            vacancyId: "$_id",
            title: { $ifNull: ["$vacancy.title", "Deleted vacancy"] },
            department: { $ifNull: ["$vacancy.department", "—"] },
            status: "$vacancy.status",
            total: 1,
            statuses: 1,
          },
        },
        { $sort: { total: -1, title: 1 } },
      ],
    },
  };
  const pipeline: PipelineStage[] = [];
  if (Object.keys(appliedAt).length > 0) {
    pipeline.push({ $match: { appliedAt } });
  }
  pipeline.push(facets);

  const [aggregation] =
    await JobApplication.aggregate<RecruitmentReportsAggregation>(
      pipeline,
    ).exec();

  const statusCounts = createEmptyApplicationStatusCounts();

  for (const item of aggregation?.statuses ?? []) {
    statusCounts[item._id] = item.count;
  }

  return {
    totalApplications: Object.values(statusCounts).reduce(
      (total, count) => total + count,
      0,
    ),
    statusCounts,
    monthlyApplications: (aggregation?.monthlyApplications ?? []).map(
      ({ _id, count }) => ({ month: _id, count }),
    ),
    vacancies: (aggregation?.vacancyApplications ?? []).map((vacancy) => {
      const byStatus = createEmptyApplicationStatusCounts();
      for (const item of vacancy.statuses) {
        byStatus[item.status] = item.count;
      }

      return {
        vacancyId: vacancy.vacancyId.toString(),
        title: vacancy.title,
        department: vacancy.department,
        status: vacancy.status,
        totalApplications: vacancy.total,
        statusCounts: byStatus,
      };
    }),
  };
};
