import { Document, Model, Schema, Types, model } from "mongoose";

/*
|--------------------------------------------------------------------------
| Vacancy Status
|--------------------------------------------------------------------------
*/

export const VACANCY_TYPES = {
  GENERAL: "GENERAL",
  RIDER: "RIDER",
} as const;

export type VacancyType =
  (typeof VACANCY_TYPES)[keyof typeof VACANCY_TYPES];

/*
|--------------------------------------------------------------------------
| Vacancy Status
|--------------------------------------------------------------------------
*/

export const VACANCY_STATUSES = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  PAUSED: "PAUSED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
} as const;

export type VacancyStatus =
  (typeof VACANCY_STATUSES)[keyof typeof VACANCY_STATUSES];

/*
|--------------------------------------------------------------------------
| Employment Type
|--------------------------------------------------------------------------
*/

export const VACANCY_EMPLOYMENT_TYPES = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CONTRACT: "CONTRACT",
  INTERN: "INTERN",
  TEMPORARY: "TEMPORARY",
} as const;

export type VacancyEmploymentType =
  (typeof VACANCY_EMPLOYMENT_TYPES)[keyof typeof VACANCY_EMPLOYMENT_TYPES];

/*
|--------------------------------------------------------------------------
| Salary Type
|--------------------------------------------------------------------------
*/

export const VACANCY_SALARY_TYPES = {
  FIXED: "FIXED",
  RANGE: "RANGE",
  NEGOTIABLE: "NEGOTIABLE",
  UNDISCLOSED: "UNDISCLOSED",
} as const;

export type VacancySalaryType =
  (typeof VACANCY_SALARY_TYPES)[keyof typeof VACANCY_SALARY_TYPES];

/*
|--------------------------------------------------------------------------
| Vacancy Interface
|--------------------------------------------------------------------------
*/

export interface IVacancy {
  _id: Types.ObjectId;

  title: string;

  slug: string;

  department: string;

  jobTitle: string;

  description: string;

  responsibilities: string[];

  requirements: string[];

  qualifications?: string[];

  skills?: string[];

  vacancyType: VacancyType;
  employmentType: VacancyEmploymentType;

  location?: string;

  isRemote: boolean;

  salaryType: VacancySalaryType;

  salaryMin?: number;

  salaryMax?: number;

  salaryCurrency?: string;

  openings: number;

  status: VacancyStatus;

  applicationDeadline?: Date;

  publishedAt?: Date;

  closedAt?: Date;

  createdBy: Types.ObjectId;

  updatedBy?: Types.ObjectId;

  createdAt: Date;

  updatedAt: Date;
}

/*
|--------------------------------------------------------------------------
| Vacancy Document
|--------------------------------------------------------------------------
*/

export interface IVacancyDocument extends IVacancy, Document {}

/*
|--------------------------------------------------------------------------
| Vacancy Model
|--------------------------------------------------------------------------
*/

export type VacancyModel = Model<IVacancyDocument>;

/*
|--------------------------------------------------------------------------
| Schema
|--------------------------------------------------------------------------
*/

const vacancySchema = new Schema<IVacancyDocument>(
  {
    /*
            |--------------------------------------------------------------------------
            | Basic Information
            |--------------------------------------------------------------------------
            */

    title: {
      type: String,
      required: [true, "Vacancy title is required."],
      trim: true,
      minlength: [3, "Vacancy title must be at least 3 characters."],
      maxlength: [200, "Vacancy title cannot exceed 200 characters."],
    },

    slug: {
      type: String,
      required: [true, "Vacancy slug is required."],
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
      maxlength: [220, "Vacancy slug cannot exceed 220 characters."],
    },

    department: {
      type: String,
      required: [true, "Department is required."],
      trim: true,
      minlength: [2, "Department must be at least 2 characters."],
      maxlength: [100, "Department cannot exceed 100 characters."],
      index: true,
    },

    jobTitle: {
      type: String,
      required: [true, "Job title is required."],
      trim: true,
      minlength: [2, "Job title must be at least 2 characters."],
      maxlength: [150, "Job title cannot exceed 150 characters."],
    },

    /*
            |--------------------------------------------------------------------------
            | Job Content
            |--------------------------------------------------------------------------
            */

    description: {
      type: String,
      required: [true, "Job description is required."],
      trim: true,
      minlength: [20, "Job description must be at least 20 characters."],
      maxlength: [10000, "Job description cannot exceed 10000 characters."],
    },

    responsibilities: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 2000,
        },
      ],
      required: true,
      default: [],
    },

    requirements: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 2000,
        },
      ],
      required: true,
      default: [],
    },

    qualifications: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 1000,
        },
      ],
      default: [],
    },

    skills: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 100,
        },
      ],
      default: [],
    },

    /*
            |--------------------------------------------------------------------------
            | Employment
            |--------------------------------------------------------------------------
            */

    vacancyType: {
      type: String,
      enum: Object.values(VACANCY_TYPES),
      default: VACANCY_TYPES.GENERAL,
      index: true,
    },

    employmentType: {
      type: String,
      enum: {
        values: Object.values(VACANCY_EMPLOYMENT_TYPES),
        message: "Invalid employment type.",
      },
      required: [true, "Employment type is required."],
      index: true,
    },

    location: {
      type: String,
      trim: true,
      maxlength: [200, "Location cannot exceed 200 characters."],
    },

    isRemote: {
      type: Boolean,
      default: false,
      index: true,
    },

    /*
            |--------------------------------------------------------------------------
            | Salary
            |--------------------------------------------------------------------------
            */

    salaryType: {
      type: String,
      enum: {
        values: Object.values(VACANCY_SALARY_TYPES),
        message: "Invalid salary type.",
      },
      required: [true, "Salary type is required."],
      default: VACANCY_SALARY_TYPES.UNDISCLOSED,
    },

    salaryMin: {
      type: Number,
      min: [0, "Minimum salary cannot be negative."],
    },

    salaryMax: {
      type: Number,
      min: [0, "Maximum salary cannot be negative."],
    },

    salaryCurrency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 10,
    },

    /*
            |--------------------------------------------------------------------------
            | Vacancy Capacity
            |--------------------------------------------------------------------------
            */

    openings: {
      type: Number,
      required: [true, "Number of openings is required."],
      min: [1, "There must be at least one opening."],
      default: 1,
    },

    /*
            |--------------------------------------------------------------------------
            | Status
            |--------------------------------------------------------------------------
            */

    status: {
      type: String,
      enum: {
        values: Object.values(VACANCY_STATUSES),
        message: "Invalid vacancy status.",
      },
      required: true,
      default: VACANCY_STATUSES.DRAFT,
      index: true,
    },

    /*
            |--------------------------------------------------------------------------
            | Dates
            |--------------------------------------------------------------------------
            */

    applicationDeadline: {
      type: Date,
      index: true,
    },

    publishedAt: {
      type: Date,
    },

    closedAt: {
      type: Date,
    },

    /*
            |--------------------------------------------------------------------------
            | Audit
            |--------------------------------------------------------------------------
            */

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by user is required."],
      index: true,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

vacancySchema.index({ vacancyType: 1, status: 1 });

vacancySchema.index(
  {
    status: 1,
    applicationDeadline: 1,
  },
  {
    name: "vacancy_status_deadline",
  },
);

vacancySchema.index(
  {
    department: 1,
    status: 1,
  },
  {
    name: "vacancy_department_status",
  },
);

vacancySchema.index(
  {
    employmentType: 1,
    status: 1,
  },
  {
    name: "vacancy_employment_status",
  },
);

vacancySchema.index(
  {
    isRemote: 1,
    status: 1,
  },
  {
    name: "vacancy_remote_status",
  },
);

vacancySchema.index(
  {
    createdBy: 1,
    createdAt: -1,
  },
  {
    name: "vacancy_createdBy_createdAt",
  },
);

/*
|--------------------------------------------------------------------------
| Validation Hooks
|--------------------------------------------------------------------------
*/

vacancySchema.pre("validate", function () {
  if (
    this.salaryMin !== undefined &&
    this.salaryMax !== undefined &&
    this.salaryMin > this.salaryMax
  ) {
    this.invalidate(
      "salaryMax",
      "Maximum salary cannot be lower than minimum salary.",
    );
  }

  if (this.isRemote && this.location) {
    this.location = this.location.trim();
  }
});

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

export const Vacancy = model<IVacancyDocument, VacancyModel>(
  "Vacancy",
  vacancySchema,
);
