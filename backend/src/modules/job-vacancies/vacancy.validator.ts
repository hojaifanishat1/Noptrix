import { z } from "zod";

import {
  VACANCY_STATUSES,
  VACANCY_EMPLOYMENT_TYPES,
  VACANCY_SALARY_TYPES,
  VACANCY_TYPES,
} from "./vacancy.model";

/*
|--------------------------------------------------------------------------
| Shared Schemas
|--------------------------------------------------------------------------
*/

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid ObjectId.");

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters.")
  .max(220, "Slug cannot exceed 220 characters.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may contain only lowercase letters, numbers and hyphens.",
  );

const stringArraySchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Array items cannot be empty.")
      .max(2000, "Array item cannot exceed 2000 characters."),
  )
  .default([]);

const shortStringArraySchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Array items cannot be empty.")
      .max(1000, "Array item cannot exceed 1000 characters."),
  )
  .default([]);

/*
|--------------------------------------------------------------------------
| Create Vacancy
|--------------------------------------------------------------------------
|
| Important:
| A newly-created vacancy is ALWAYS DRAFT.
| Publishing happens through the publish endpoint.
|
*/

export const createVacancySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Vacancy title must be at least 3 characters.")
      .max(200, "Vacancy title cannot exceed 200 characters."),

    slug: slugSchema,

    department: z
      .string()
      .trim()
      .min(2, "Department must be at least 2 characters.")
      .max(100, "Department cannot exceed 100 characters."),

    jobTitle: z
      .string()
      .trim()
      .min(2, "Job title must be at least 2 characters.")
      .max(150, "Job title cannot exceed 150 characters."),

    description: z
      .string()
      .trim()
      .min(20, "Job description must be at least 20 characters.")
      .max(10000, "Job description cannot exceed 10000 characters."),

    responsibilities: stringArraySchema,

    requirements: stringArraySchema,

    qualifications: shortStringArraySchema.optional(),

    skills: z
      .array(
        z
          .string()
          .trim()
          .min(1, "Skill cannot be empty.")
          .max(100, "Skill cannot exceed 100 characters."),
      )
      .optional(),

    vacancyType: z.enum(Object.values(VACANCY_TYPES) as [string, ...string[]]).default("GENERAL"),

    employmentType: z.enum(
      Object.values(VACANCY_EMPLOYMENT_TYPES) as [string, ...string[]],
    ),

    location: z
      .string()
      .trim()
      .max(200, "Location cannot exceed 200 characters.")
      .optional(),

    isRemote: z.boolean().default(false),

    salaryType: z.enum(
      Object.values(VACANCY_SALARY_TYPES) as [string, ...string[]],
    ),

    salaryMin: z
      .number()
      .min(0, "Minimum salary cannot be negative.")
      .optional(),

    salaryMax: z
      .number()
      .min(0, "Maximum salary cannot be negative.")
      .optional(),

    salaryCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .max(10, "Salary currency cannot exceed 10 characters.")
      .optional(),

    openings: z
      .number()
      .int("Openings must be a whole number.")
      .min(1, "There must be at least one opening.")
      .default(1),

    applicationDeadline: z.coerce.date().optional(),

    /*
        |--------------------------------------------------------------------------
        | Status intentionally omitted from client input.
        |--------------------------------------------------------------------------
        */
  })
  .superRefine((data, context) => {
    if (
      data.salaryMin !== undefined &&
      data.salaryMax !== undefined &&
      data.salaryMin > data.salaryMax
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryMax"],
        message: "Maximum salary cannot be lower than minimum salary.",
      });
    }

    if (
      data.salaryType === VACANCY_SALARY_TYPES.RANGE &&
      (data.salaryMin === undefined || data.salaryMax === undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryType"],
        message:
          "Salary minimum and maximum are required for RANGE salary type.",
      });
    }

    if (
      data.salaryType === VACANCY_SALARY_TYPES.FIXED &&
      data.salaryMin === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryMin"],
        message: "Salary amount is required for FIXED salary type.",
      });
    }

    if (
      data.salaryType === VACANCY_SALARY_TYPES.FIXED &&
      data.salaryMax !== undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryMax"],
        message: "FIXED salary type should use salaryMin only.",
      });
    }

    if (
      data.salaryType === VACANCY_SALARY_TYPES.NEGOTIABLE &&
      (data.salaryMin !== undefined || data.salaryMax !== undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryType"],
        message: "NEGOTIABLE salary type should not define salary amounts.",
      });
    }

    if (
      data.salaryType === VACANCY_SALARY_TYPES.UNDISCLOSED &&
      (data.salaryMin !== undefined || data.salaryMax !== undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryType"],
        message: "UNDISCLOSED salary type should not define salary amounts.",
      });
    }

    if (data.isRemote && data.location && data.location.trim().length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["location"],
        message: "Remote vacancies should not require a physical location.",
      });
    }

    if (
      data.applicationDeadline &&
      data.applicationDeadline.getTime() <= Date.now()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicationDeadline"],
        message: "Application deadline must be in the future.",
      });
    }
  });

/*
|--------------------------------------------------------------------------
| Update Vacancy
|--------------------------------------------------------------------------
*/

export const updateVacancySchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),

    slug: slugSchema.optional(),

    department: z.string().trim().min(2).max(100).optional(),

    jobTitle: z.string().trim().min(2).max(150).optional(),

    description: z.string().trim().min(20).max(10000).optional(),

    responsibilities: stringArraySchema.optional(),

    requirements: stringArraySchema.optional(),

    qualifications: shortStringArraySchema.optional(),

    skills: z.array(z.string().trim().min(1).max(100)).optional(),

    vacancyType: z.enum(Object.values(VACANCY_TYPES) as [string, ...string[]]).optional(),

    employmentType: z
      .enum(Object.values(VACANCY_EMPLOYMENT_TYPES) as [string, ...string[]])
      .optional(),

    location: z.string().trim().max(200).nullable().optional(),

    isRemote: z.boolean().optional(),

    salaryType: z
      .enum(Object.values(VACANCY_SALARY_TYPES) as [string, ...string[]])
      .optional(),

    salaryMin: z.number().min(0).nullable().optional(),

    salaryMax: z.number().min(0).nullable().optional(),

    salaryCurrency: z
      .string()
      .trim()
      .toUpperCase()
      .max(10)
      .nullable()
      .optional(),

    openings: z.number().int().min(1).optional(),

    applicationDeadline: z.coerce.date().nullable().optional(),
  })
  .superRefine((data, context) => {
    if (
      data.salaryMin !== undefined &&
      data.salaryMin !== null &&
      data.salaryMax !== undefined &&
      data.salaryMax !== null &&
      data.salaryMin > data.salaryMax
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["salaryMax"],
        message: "Maximum salary cannot be lower than minimum salary.",
      });
    }

    if (
      data.isRemote === true &&
      data.location &&
      data.location.trim().length > 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["location"],
        message: "Remote vacancies should not require a physical location.",
      });
    }

    if (
      data.applicationDeadline &&
      data.applicationDeadline.getTime() <= Date.now()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicationDeadline"],
        message: "Application deadline must be in the future.",
      });
    }

    if (Object.keys(data).length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one field is required for update.",
      });
    }
  });

/*
|--------------------------------------------------------------------------
| Params
|--------------------------------------------------------------------------
*/

export const vacancyIdParamSchema = z.object({
  vacancyId: objectIdSchema,
});

/*
|--------------------------------------------------------------------------
| Status
|--------------------------------------------------------------------------
*/

export const updateVacancyStatusSchema = z.object({
  status: z.enum(Object.values(VACANCY_STATUSES) as [string, ...string[]]),
});

/*
|--------------------------------------------------------------------------
| Query
|--------------------------------------------------------------------------
*/

export const vacancyQuerySchema = z.object({
  vacancyType: z.enum(Object.values(VACANCY_TYPES) as [string, ...string[]]).optional(),

  status: z
    .enum(Object.values(VACANCY_STATUSES) as [string, ...string[]])
    .optional(),

  department: z.string().trim().max(100).optional(),

  employmentType: z
    .enum(Object.values(VACANCY_EMPLOYMENT_TYPES) as [string, ...string[]])
    .optional(),

  isRemote: z.coerce.boolean().optional(),

  search: z.string().trim().max(200).optional(),

  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export type CreateVacancyInput = z.infer<typeof createVacancySchema>;

export type UpdateVacancyInput = z.infer<typeof updateVacancySchema>;

export type VacancyIdParam = z.infer<typeof vacancyIdParamSchema>;

export type UpdateVacancyStatusInput = z.infer<
  typeof updateVacancyStatusSchema
>;

export type VacancyQueryInput = z.infer<typeof vacancyQuerySchema>;
