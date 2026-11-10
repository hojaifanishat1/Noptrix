export const JOB_VACANCY_STATUSES = {
    DRAFT: "DRAFT",
    OPEN: "OPEN",
    PAUSED: "PAUSED",
    CLOSED: "CLOSED",
    CANCELLED: "CANCELLED",
} as const;

export type JobVacancyStatus =
    (typeof JOB_VACANCY_STATUSES)[keyof typeof JOB_VACANCY_STATUSES];


export const JOB_EMPLOYMENT_TYPES = {
    FULL_TIME: "FULL_TIME",
    PART_TIME: "PART_TIME",
    CONTRACT: "CONTRACT",
    INTERN: "INTERN",
    TEMPORARY: "TEMPORARY",
} as const;

export type JobEmploymentType =
    (typeof JOB_EMPLOYMENT_TYPES)[keyof typeof JOB_EMPLOYMENT_TYPES];


export const JOB_SALARY_TYPES = {
    FIXED: "FIXED",
    RANGE: "RANGE",
    NEGOTIABLE: "NEGOTIABLE",
    UNDISCLOSED: "UNDISCLOSED",
} as const;

export type JobSalaryType =
    (typeof JOB_SALARY_TYPES)[keyof typeof JOB_SALARY_TYPES];


export interface JobVacancy {
    id: string;

    vacancyType?: "GENERAL" | "RIDER";

    title: string;

    slug: string;

    department: string;

    jobTitle: string;

    description: string;

    responsibilities: string[];

    requirements: string[];

    qualifications?: string[];

    skills?: string[];

    employmentType: JobEmploymentType;

    location?: string;

    isRemote: boolean;

    salaryType: JobSalaryType;

    salaryMin?: number;

    salaryMax?: number;

    salaryCurrency?: string;

    openings: number;

    status: JobVacancyStatus;

    applicationDeadline?: string;

    publishedAt?: string;

    closedAt?: string;

    createdBy?: string;

    updatedBy?: string;

    createdAt: string;

    updatedAt: string;
}


export type JobVacancyApiResponse =
    Omit<JobVacancy, "id"> & {
        id?: string;
        _id?: string;
    };


export const normalizeJobVacancy = (
    vacancy: JobVacancyApiResponse | JobVacancy,
): JobVacancy => {
    const id =
        vacancy.id ??
        ("_id" in vacancy
            ? vacancy._id
            : undefined);

    if (!id) {
        throw new Error(
            "Job vacancy response is missing its ID.",
        );
    }

    return {
        ...vacancy,
        id,
    };
};


export interface CreateJobVacancyInput {
    vacancyType: "GENERAL" | "RIDER";

    title: string;

    slug: string;

    department: string;

    jobTitle: string;

    description: string;

    responsibilities: string[];

    requirements: string[];

    qualifications?: string[];

    skills?: string[];

    employmentType: JobEmploymentType;

    location?: string;

    isRemote: boolean;

    salaryType: JobSalaryType;

    salaryMin?: number;

    salaryMax?: number;

    salaryCurrency?: string;

    openings: number;

    applicationDeadline?: string;
}


export interface UpdateJobVacancyInput {
    vacancyType?: "GENERAL" | "RIDER";

    title?: string;

    slug?: string;

    department?: string;

    jobTitle?: string;

    description?: string;

    responsibilities?: string[];

    requirements?: string[];

    qualifications?: string[];

    skills?: string[];

    employmentType?: JobEmploymentType;

    location?: string | null;

    isRemote?: boolean;

    salaryType?: JobSalaryType;

    salaryMin?: number | null;

    salaryMax?: number | null;

    salaryCurrency?: string | null;

    openings?: number;

    applicationDeadline?: string | null;
}


export interface UpdateJobVacancyStatusInput {
    status: JobVacancyStatus;
}


export interface JobVacancyListParams {
    page?: number;

    limit?: number;

    search?: string;

    status?: JobVacancyStatus;

    department?: string;

    employmentType?: JobEmploymentType;

    isRemote?: boolean;
}


export interface JobVacancyPagination {
    page: number;

    limit: number;

    total: number;

    totalPages: number;

    hasNextPage: boolean;

    hasPreviousPage: boolean;
}
