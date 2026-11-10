import { z } from "zod";

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

export const JOB_APPLICATION_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "INTERVIEW",
  "SELECTED",
  "REJECTED",
  "WITHDRAWN",
] as const;

/*
|--------------------------------------------------------------------------
| Shared Schemas
|--------------------------------------------------------------------------
*/

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid ObjectId.");

/*
|--------------------------------------------------------------------------
| Create Application
|--------------------------------------------------------------------------
*/

export const createJobApplicationSchema = z
  .object({
    vacancyId: objectIdSchema,

    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(150, "Name cannot exceed 150 characters."),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Invalid email address.")
      .max(254, "Email cannot exceed 254 characters."),

    phone: z
      .string()
      .trim()
      .min(1, "Phone cannot be empty.")
      .max(30, "Phone cannot exceed 30 characters.")
      .optional(),

    resumeUrl: z
      .string()
      .trim()
      .url("Invalid resume URL.")
      .max(2000, "Resume URL cannot exceed 2000 characters.")
      .optional(),

    coverLetter: z
      .string()
      .trim()
      .min(1, "Cover letter cannot be empty.")
      .max(10000, "Cover letter cannot exceed 10000 characters.")
      .optional(),
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Status Update
|--------------------------------------------------------------------------
*/

export const updateJobApplicationStatusSchema = z
  .object({
    status: z.enum(JOB_APPLICATION_STATUSES),

    rejectionReason: z
      .string()
      .trim()
      .min(1, "Rejection reason cannot be empty.")
      .max(2000, "Rejection reason cannot exceed 2000 characters.")
      .optional(),

    notes: z
      .string()
      .trim()
      .min(1, "Notes cannot be empty.")
      .max(5000, "Notes cannot exceed 5000 characters.")
      .optional(),

    interviewAt: z.coerce.date().optional(),
  })
  .strict()
  .superRefine((data, context) => {
    /*
            |--------------------------------------------------------------------------
            | REJECTED
            |--------------------------------------------------------------------------
            */

    if (data.status === "REJECTED") {
      if (!data.rejectionReason?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rejectionReason"],
          message:
            "Rejection reason is required when rejecting an application.",
        });
      }
    } else if (data.rejectionReason !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejectionReason"],
        message:
          "Rejection reason can only be provided when rejecting an application.",
      });
    }

    /*
            |--------------------------------------------------------------------------
            | INTERVIEW
            |--------------------------------------------------------------------------
            */

    if (data.status === "INTERVIEW") {
      if (!data.interviewAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["interviewAt"],
          message: "Interview date and time is required.",
        });
      } else if (data.interviewAt.getTime() <= Date.now()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["interviewAt"],
          message: "Interview date and time must be in the future.",
        });
      }
    } else if (data.interviewAt !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["interviewAt"],
        message:
          "Interview date and time can only be provided when moving an application to interview.",
      });
    }
  });

/*
|--------------------------------------------------------------------------
| Params
|--------------------------------------------------------------------------
*/

export const jobApplicationIdParamSchema = z
  .object({
    applicationId: objectIdSchema,
  })
  .strict();

export const vacancyIdParamSchema = z
  .object({
    vacancyId: objectIdSchema,
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Query
|--------------------------------------------------------------------------
*/

export const jobApplicationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    status: z.enum(JOB_APPLICATION_STATUSES).optional(),

    vacancyId: objectIdSchema.optional(),

    applicantId: objectIdSchema.optional(),

    riderConversionRequested: z
      .preprocess(
        (value) =>
          value === undefined
            ? undefined
            : value === true || value === "true",
        z.boolean().optional(),
      ),

    search: z
      .string()
      .trim()
      .max(100, "Search cannot exceed 100 characters.")
      .optional(),
  })
  .strict();

export const recruitmentReportsQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.from && value.to && new Date(value.from) > new Date(value.to)) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "'to' must be greater than or equal to 'from'.",
      });
    }
  });

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export type CreateJobApplicationInput = z.infer<
  typeof createJobApplicationSchema
>;

export type UpdateJobApplicationStatusInput = z.infer<
  typeof updateJobApplicationStatusSchema
>;

export type JobApplicationIdParam = z.infer<typeof jobApplicationIdParamSchema>;

export type VacancyIdParam = z.infer<typeof vacancyIdParamSchema>;

export type JobApplicationQueryInput = z.infer<
  typeof jobApplicationQuerySchema
>;

export type RecruitmentReportsQueryInput = z.infer<
  typeof recruitmentReportsQuerySchema
>;
