import { Types } from "mongoose";

import {
  Vacancy,
  VacancyStatus,
  VacancyEmploymentType,
  VacancySalaryType,
  VACANCY_STATUSES,
} from "./vacancy.model";

import { ApiError } from "../../utils/ApiError";

import {
  CreateVacancyInput,
  UpdateVacancyInput,
  UpdateVacancyStatusInput,
  VacancyQueryInput,
} from "./vacancy.validator";

import { VACANCY_TYPES, VacancyType } from "./vacancy.model";
/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const validateObjectId = (value: string, fieldName: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${fieldName}.`, {
      code: `INVALID_${fieldName.replace(/\s+/g, "_").toUpperCase()}`,
    });
  }

  return new Types.ObjectId(value);
};

const normalizeSlug = (slug: string): string =>
  slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validateCreator = (userId: string): Types.ObjectId =>
  validateObjectId(userId, "creator ID");

/*
|--------------------------------------------------------------------------
| Vacancy Status Lifecycle
|--------------------------------------------------------------------------
|
| DRAFT
|   ├── OPEN
|   └── CANCELLED
|
| OPEN
|   ├── PAUSED
|   ├── CLOSED
|   └── CANCELLED
|
| PAUSED
|   ├── OPEN
|   ├── CLOSED
|   └── CANCELLED
|
| CLOSED      → terminal
| CANCELLED   → terminal
|
|--------------------------------------------------------------------------
*/

const VACANCY_STATUS_TRANSITIONS: Record<
  VacancyStatus,
  readonly VacancyStatus[]
> = {
  DRAFT: [VACANCY_STATUSES.OPEN, VACANCY_STATUSES.CANCELLED],

  OPEN: [
    VACANCY_STATUSES.PAUSED,
    VACANCY_STATUSES.CLOSED,
    VACANCY_STATUSES.CANCELLED,
  ],

  PAUSED: [
    VACANCY_STATUSES.OPEN,
    VACANCY_STATUSES.CLOSED,
    VACANCY_STATUSES.CANCELLED,
  ],

  CLOSED: [],

  CANCELLED: [],
};

const canTransitionVacancyStatus = (
  currentStatus: VacancyStatus,
  nextStatus: VacancyStatus,
): boolean => VACANCY_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);

/*
|--------------------------------------------------------------------------
| Vacancy Validation
|--------------------------------------------------------------------------
*/

const validateSalaryConfiguration = (
  salaryType: VacancySalaryType,
  salaryMin: number | null | undefined,
  salaryMax: number | null | undefined,
): void => {
  if (salaryType === "RANGE") {
    if (
      salaryMin === undefined ||
      salaryMin === null ||
      salaryMax === undefined ||
      salaryMax === null
    ) {
      throw ApiError.badRequest(
        "Salary minimum and maximum are required for RANGE salary type.",
      );
    }

    if (salaryMin > salaryMax) {
      throw ApiError.badRequest(
        "Maximum salary cannot be lower than minimum salary.",
      );
    }

    return;
  }

  if (salaryType === "FIXED") {
    if (salaryMin === undefined || salaryMin === null) {
      throw ApiError.badRequest(
        "Salary amount is required for FIXED salary type.",
      );
    }

    if (salaryMax !== undefined && salaryMax !== null) {
      throw ApiError.badRequest("FIXED salary type should use salaryMin only.");
    }

    return;
  }

  if (salaryType === "NEGOTIABLE" || salaryType === "UNDISCLOSED") {
    if (
      (salaryMin !== undefined && salaryMin !== null) ||
      (salaryMax !== undefined && salaryMax !== null)
    ) {
      throw ApiError.badRequest(
        `${salaryType} salary type should not define salary amounts.`,
      );
    }
  }
};

const validateDeadlineForOpen = (
  applicationDeadline: Date | null | undefined,
): void => {
  if (!applicationDeadline) {
    return;
  }

  if (applicationDeadline.getTime() <= Date.now()) {
    throw ApiError.badRequest("Application deadline must be in the future.");
  }
};

const validateRemoteLocation = (
  isRemote: boolean,
  location: string | null | undefined,
): void => {
  if (isRemote && location && location.trim()) {
    throw ApiError.badRequest(
      "Remote vacancies should not require a physical location.",
    );
  }
};

/*
|--------------------------------------------------------------------------
| Create Vacancy
|--------------------------------------------------------------------------
*/

export const createVacancy = async (
  creatorId: string,
  input: CreateVacancyInput,
) => {
  const creatorObjectId = validateCreator(creatorId);

  const slug = normalizeSlug(input.slug);

  if (!slug) {
    throw ApiError.badRequest("A valid vacancy slug is required.");
  }

  validateSalaryConfiguration(
    input.salaryType as VacancySalaryType,
    input.salaryMin,
    input.salaryMax,
  );

  validateRemoteLocation(input.isRemote, input.location);

  if (input.applicationDeadline) {
    validateDeadlineForOpen(input.applicationDeadline);
  }

  /*
        |--------------------------------------------------------------------------
        | Duplicate checks
        |--------------------------------------------------------------------------
        */

  const [existingSlug, existingTitle] = await Promise.all([
    Vacancy.findOne({
      slug,
    }).lean(),

    Vacancy.findOne({
      title: input.title.trim(),
    }).lean(),
  ]);

  if (existingSlug) {
    throw ApiError.conflict("A vacancy with this slug already exists.");
  }

  if (existingTitle) {
    throw ApiError.conflict("A vacancy with this title already exists.");
  }

  /*
        |--------------------------------------------------------------------------
        | New vacancies always start as DRAFT.
        |--------------------------------------------------------------------------
        */

  try {
    return await Vacancy.create({
      title: input.title.trim(),

      slug,

      department: input.department.trim(),

      jobTitle: input.jobTitle.trim(),

      description: input.description.trim(),

      responsibilities: input.responsibilities,

      requirements: input.requirements,

      qualifications: input.qualifications,

      skills: input.skills,

      vacancyType: (input.vacancyType ?? VACANCY_TYPES.GENERAL) as VacancyType,

      employmentType: input.employmentType as VacancyEmploymentType,

      location: input.location?.trim(),

      isRemote: input.isRemote,

      salaryType: input.salaryType as VacancySalaryType,

      salaryMin: input.salaryMin,

      salaryMax: input.salaryMax,

      salaryCurrency: input.salaryCurrency?.trim().toUpperCase(),

      openings: input.openings,

      applicationDeadline: input.applicationDeadline,

      status: VACANCY_STATUSES.DRAFT,

      createdBy: creatorObjectId,

      updatedBy: creatorObjectId,
    });
  } catch (error: unknown) {
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
      throw ApiError.conflict("A vacancy with the same slug already exists.");
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Get Vacancy By ID
|--------------------------------------------------------------------------
*/

export const getVacancyById = async (vacancyId: string) => {
  const vacancyObjectId = validateObjectId(vacancyId, "vacancy ID");

  const vacancy = await Vacancy.findById(vacancyObjectId)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .lean();

  if (!vacancy) {
    throw ApiError.notFound("Job vacancy not found.");
  }

  return vacancy;
};

/*
|--------------------------------------------------------------------------
| Get Vacancy By Slug
|--------------------------------------------------------------------------
*/

export const getVacancyBySlug = async (slug: string) => {
  const normalizedSlug = normalizeSlug(slug);

  if (!normalizedSlug) {
    throw ApiError.badRequest("Invalid vacancy slug.");
  }

  const vacancy = await Vacancy.findOne({
    slug: normalizedSlug,
  }).lean();

  if (!vacancy) {
    throw ApiError.notFound("Job vacancy not found.");
  }

  return vacancy;
};

/*
|--------------------------------------------------------------------------
| Get Vacancies
|--------------------------------------------------------------------------
*/

export const getVacancies = async (query: VacancyQueryInput) => {
  const page = query.page ?? 1;

  const limit = query.limit ?? 20;

  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.department) {
    filter.department = {
      $regex: escapeRegex(query.department),
      $options: "i",
    };
  }

  if (query.vacancyType) {
    filter.vacancyType =
      query.vacancyType === VACANCY_TYPES.GENERAL
        ? { $in: [VACANCY_TYPES.GENERAL, null] }
        : query.vacancyType;
  }

  if (query.employmentType) {
    filter.employmentType = query.employmentType;
  }

  if (query.isRemote !== undefined) {
    filter.isRemote = query.isRemote;
  }

  if (query.search) {
    const search = escapeRegex(query.search.trim());

    if (search) {
      filter.$or = [
        {
          title: {
            $regex: search,
            $options: "i",
          },
        },
        {
          jobTitle: {
            $regex: search,
            $options: "i",
          },
        },
        {
          department: {
            $regex: search,
            $options: "i",
          },
        },
        {
          description: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }
  }

  const skip = (page - 1) * limit;

  const [vacancies, total] = await Promise.all([
    Vacancy.find(filter)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    Vacancy.countDocuments(filter),
  ]);

  return {
    vacancies,

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
| Public Vacancies
|--------------------------------------------------------------------------
*/

export const getPublicVacancies = async (query: VacancyQueryInput) => {
  const page = query.page ?? 1;

  const limit = query.limit ?? 20;

  const filter: Record<string, unknown> = {
    status: VACANCY_STATUSES.OPEN,
  };

  if (query.department) {
    filter.department = {
      $regex: escapeRegex(query.department),
      $options: "i",
    };
  }

  if (query.vacancyType) {
    filter.vacancyType =
      query.vacancyType === VACANCY_TYPES.GENERAL
        ? { $in: [VACANCY_TYPES.GENERAL, null] }
        : query.vacancyType;
  }

  if (query.employmentType) {
    filter.employmentType = query.employmentType;
  }

  if (query.isRemote !== undefined) {
    filter.isRemote = query.isRemote;
  }

  if (query.search) {
    const search = escapeRegex(query.search.trim());

    if (search) {
      filter.$or = [
        {
          title: {
            $regex: search,
            $options: "i",
          },
        },
        {
          jobTitle: {
            $regex: search,
            $options: "i",
          },
        },
        {
          department: {
            $regex: search,
            $options: "i",
          },
        },
        {
          description: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }
  }

  /*
        |--------------------------------------------------------------------------
        | Public vacancies with expired deadlines are hidden.
        |--------------------------------------------------------------------------
        */

  filter.$and = [
    {
      $or: [
        { applicationDeadline: { $exists: false } },
        { applicationDeadline: { $gt: new Date() } },
      ],
    },
  ];

  const skip = (page - 1) * limit;

  const [vacancies, total] = await Promise.all([
    Vacancy.find(filter)
      .select("-createdBy -updatedBy")
      .sort({
        publishedAt: -1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    Vacancy.countDocuments(filter),
  ]);

  return {
    vacancies,

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
| Update Vacancy
|--------------------------------------------------------------------------
*/

export const updateVacancy = async (
  vacancyId: string,
  updaterId: string,
  input: UpdateVacancyInput,
) => {
  const vacancyObjectId = validateObjectId(vacancyId, "vacancy ID");

  const updaterObjectId = validateObjectId(updaterId, "updater ID");

  const vacancy = await Vacancy.findById(vacancyObjectId);

  if (!vacancy) {
    throw ApiError.notFound("Job vacancy not found.");
  }

  if (
    vacancy.status === VACANCY_STATUSES.CLOSED ||
    vacancy.status === VACANCY_STATUSES.CANCELLED
  ) {
    throw ApiError.badRequest(
      `Cannot update a ${vacancy.status.toLowerCase()} vacancy.`,
    );
  }

  const nextTitle = input.title ?? vacancy.title;

  const nextSlug =
    input.slug !== undefined ? normalizeSlug(input.slug) : vacancy.slug;

  const nextIsRemote = input.isRemote ?? vacancy.isRemote;

  const nextLocation =
    input.location !== undefined ? input.location : vacancy.location;

  const nextSalaryType = input.salaryType ?? vacancy.salaryType;

  const nextSalaryMin =
    input.salaryMin !== undefined ? input.salaryMin : vacancy.salaryMin;

  const nextSalaryMax =
    input.salaryMax !== undefined ? input.salaryMax : vacancy.salaryMax;

  /*
        |--------------------------------------------------------------------------
        | Validate final merged configuration.
        |--------------------------------------------------------------------------
        */

  validateSalaryConfiguration(
    nextSalaryType as VacancySalaryType,
    nextSalaryMin,
    nextSalaryMax,
  );

  validateRemoteLocation(nextIsRemote, nextLocation);

  const nextDeadline =
    input.applicationDeadline !== undefined
      ? input.applicationDeadline
      : vacancy.applicationDeadline;

  if (vacancy.status === VACANCY_STATUSES.OPEN) {
    validateDeadlineForOpen(nextDeadline);
  }

  /*
        |--------------------------------------------------------------------------
        | Duplicate checks
        |--------------------------------------------------------------------------
        */

  if (nextSlug !== vacancy.slug) {
    const existing = await Vacancy.findOne({
      slug: nextSlug,
      _id: {
        $ne: vacancy._id,
      },
    }).lean();

    if (existing) {
      throw ApiError.conflict("A vacancy with this slug already exists.");
    }
  }

  if (nextTitle.trim() !== vacancy.title) {
    const existing = await Vacancy.findOne({
      title: nextTitle.trim(),
      _id: {
        $ne: vacancy._id,
      },
    }).lean();

    if (existing) {
      throw ApiError.conflict("A vacancy with this title already exists.");
    }
  }

  /*
        |--------------------------------------------------------------------------
        | Apply fields
        |--------------------------------------------------------------------------
        */

  if (input.title !== undefined) {
    vacancy.title = input.title.trim();
  }

  if (input.slug !== undefined) {
    vacancy.slug = nextSlug;
  }

  if (input.department !== undefined) {
    vacancy.department = input.department.trim();
  }

  if (input.jobTitle !== undefined) {
    vacancy.jobTitle = input.jobTitle.trim();
  }

  if (input.description !== undefined) {
    vacancy.description = input.description.trim();
  }

  if (input.responsibilities !== undefined) {
    vacancy.responsibilities = input.responsibilities;
  }

  if (input.requirements !== undefined) {
    vacancy.requirements = input.requirements;
  }

  if (input.qualifications !== undefined) {
    vacancy.qualifications = input.qualifications;
  }

  if (input.skills !== undefined) {
    vacancy.skills = input.skills;
  }

  if (input.vacancyType !== undefined) {
    vacancy.vacancyType = input.vacancyType as VacancyType;
  }

  if (input.employmentType !== undefined) {
    vacancy.employmentType = input.employmentType as VacancyEmploymentType;
  }

  if (input.location !== undefined) {
    vacancy.location =
      input.location === null ? undefined : input.location.trim();
  }

  if (input.isRemote !== undefined) {
    vacancy.isRemote = input.isRemote;
  }

  if (input.salaryType !== undefined) {
    vacancy.salaryType = input.salaryType as VacancySalaryType;
  }

  if (input.salaryMin !== undefined) {
    vacancy.salaryMin = input.salaryMin === null ? undefined : input.salaryMin;
  }

  if (input.salaryMax !== undefined) {
    vacancy.salaryMax = input.salaryMax === null ? undefined : input.salaryMax;
  }

  if (input.salaryCurrency !== undefined) {
    vacancy.salaryCurrency =
      input.salaryCurrency === null
        ? undefined
        : input.salaryCurrency.trim().toUpperCase();
  }

  if (input.openings !== undefined) {
    vacancy.openings = input.openings;
  }

  if (input.applicationDeadline !== undefined) {
    vacancy.applicationDeadline =
      input.applicationDeadline === null
        ? undefined
        : input.applicationDeadline;
  }

  vacancy.updatedBy = updaterObjectId;

  await vacancy.save();

  return vacancy;
};

/*
|--------------------------------------------------------------------------
| Update Status
|--------------------------------------------------------------------------
*/

export const updateVacancyStatus = async (
  vacancyId: string,
  updaterId: string,
  input: UpdateVacancyStatusInput,
) => {
  const vacancyObjectId = validateObjectId(vacancyId, "vacancy ID");

  const updaterObjectId = validateObjectId(updaterId, "updater ID");

  const vacancy = await Vacancy.findById(vacancyObjectId);

  if (!vacancy) {
    throw ApiError.notFound("Job vacancy not found.");
  }

  const nextStatus = input.status as VacancyStatus;

  if (vacancy.status === nextStatus) {
    throw ApiError.badRequest(
      `Vacancy is already ${nextStatus.toLowerCase()}.`,
    );
  }

  if (!canTransitionVacancyStatus(vacancy.status, nextStatus)) {
    throw ApiError.badRequest(
      `Cannot change vacancy status from ${vacancy.status} to ${nextStatus}.`,
    );
  }

  /*
        |--------------------------------------------------------------------------
        | OPEN requires a future deadline if one exists.
        |--------------------------------------------------------------------------
        */

  if (nextStatus === VACANCY_STATUSES.OPEN) {
    validateDeadlineForOpen(vacancy.applicationDeadline);

    validateSalaryConfiguration(
      vacancy.salaryType,
      vacancy.salaryMin,
      vacancy.salaryMax,
    );

    validateRemoteLocation(vacancy.isRemote, vacancy.location);

    if (vacancy.openings < 1) {
      throw ApiError.badRequest(
        "Vacancy must have at least one opening before publishing.",
      );
    }

    vacancy.publishedAt = vacancy.publishedAt ?? new Date();

    vacancy.closedAt = undefined;
  }

  if (
    nextStatus === VACANCY_STATUSES.CLOSED ||
    nextStatus === VACANCY_STATUSES.CANCELLED
  ) {
    vacancy.closedAt = new Date();
  }

  vacancy.status = nextStatus;

  vacancy.updatedBy = updaterObjectId;

  await vacancy.save();

  return vacancy;
};

/*
|--------------------------------------------------------------------------
| Publish
|--------------------------------------------------------------------------
*/

export const publishVacancy = async (vacancyId: string, updaterId: string) =>
  updateVacancyStatus(vacancyId, updaterId, {
    status: VACANCY_STATUSES.OPEN,
  });

/*
|--------------------------------------------------------------------------
| Pause
|--------------------------------------------------------------------------
*/

export const pauseVacancy = async (vacancyId: string, updaterId: string) =>
  updateVacancyStatus(vacancyId, updaterId, {
    status: VACANCY_STATUSES.PAUSED,
  });

/*
|--------------------------------------------------------------------------
| Close
|--------------------------------------------------------------------------
*/

export const closeVacancy = async (vacancyId: string, updaterId: string) =>
  updateVacancyStatus(vacancyId, updaterId, {
    status: VACANCY_STATUSES.CLOSED,
  });

/*
|--------------------------------------------------------------------------
| Delete Vacancy
|--------------------------------------------------------------------------
| Permanent deletion is intentionally restricted to DRAFT/CANCELLED
| vacancies that have no associated job applications.
|--------------------------------------------------------------------------
*/

export const deleteVacancy = async (vacancyId: string, updaterId: string) => {
  const vacancyObjectId = validateObjectId(vacancyId, "vacancy ID");

  const updaterObjectId = validateObjectId(updaterId, "updater ID");

  const vacancy = await Vacancy.findById(vacancyObjectId);

  if (!vacancy) {
    throw ApiError.notFound("Job vacancy not found.");
  }

  /*
        |--------------------------------------------------------------------------
        | Only DRAFT and CANCELLED vacancies may be permanently deleted.
        |--------------------------------------------------------------------------
        */

  if (
    vacancy.status !== VACANCY_STATUSES.DRAFT &&
    vacancy.status !== VACANCY_STATUSES.CANCELLED
  ) {
    throw ApiError.badRequest(
      "Only draft or cancelled vacancies can be permanently deleted.",
    );
  }

  /*
        |--------------------------------------------------------------------------
        | Prevent deletion when applications exist.
        |--------------------------------------------------------------------------
        */

  const { JobApplication } =
    await import("../job-applications/application.model.js");

  const applicationCount = await JobApplication.countDocuments({
    vacancyId: vacancyObjectId,
  });

  if (applicationCount > 0) {
    throw ApiError.conflict(
      "This vacancy cannot be deleted because applications are associated with it.",
      {
        code: "VACANCY_HAS_APPLICATIONS",
        details: {
          applicationCount,
        },
      },
    );
  }

  /*
        |--------------------------------------------------------------------------
        | Keep authentication/updater validation consistent with
        | the rest of the vacancy service.
        |--------------------------------------------------------------------------
        */

  void updaterObjectId;

  await Vacancy.deleteOne({
    _id: vacancyObjectId,
  });

  return {
    vacancyId,
    deleted: true,
  };
};
