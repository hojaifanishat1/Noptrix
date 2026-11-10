"use client";

import { isAxiosError } from "axios";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    useRouter,
} from "next/navigation";

import {
    BriefcaseBusiness,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock3,
    ExternalLink,
    FileCheck,
    Mail,
    Phone,
    RefreshCw,
    Search,
    SlidersHorizontal,
    Users,
    UserPlus,
    X,
    XCircle,
} from "lucide-react";

import { jobApplicationsApi } from "@/services/api/job-applications.api";
import { ridersApi } from "@/services/api/riders.api";
import { useAuthStore } from "@/stores/auth.store";
import JobApplicationReviewForm from "@/features/job-applications/job-application-review-form";
import { jobVacanciesApi } from "@/services/api/job-vacancies.api";

import type {
    JobVacancy,
} from "@/features/job-vacancies/job-vacancy.types";

import {
    JOB_APPLICATION_STATUSES,
    type JobApplication,
    type JobApplicationStatus,
    type UpdateJobApplicationInput,
} from "@/features/job-applications/job-application.types";


/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const PAGE_SIZE = 20;

const SEARCH_DEBOUNCE_MS = 350;

const getErrorMessage = (error: unknown): string => {
    if (isAxiosError(error)) {
        const responseData: unknown =
            error.response?.data;

        if (
            typeof responseData === "object" &&
            responseData !== null
        ) {
            if (
                "errors" in responseData &&
                Array.isArray(responseData.errors)
            ) {
                const validationErrors =
                    responseData.errors
                        .map((item: unknown) => {
                            if (
                                typeof item !== "object" ||
                                item === null
                            ) {
                                return "";
                            }

                            const field =
                                "field" in item &&
                                typeof item.field === "string"
                                    ? item.field
                                    : "";
                            const message =
                                "message" in item &&
                                typeof item.message === "string"
                                    ? item.message
                                    : "";

                            return [field, message]
                                .filter(Boolean)
                                .join(": ");
                        })
                        .filter(Boolean);

                if (validationErrors.length > 0) {
                    return validationErrors.join(" ");
                }
            }

            if (
                "message" in responseData &&
                typeof responseData.message === "string" &&
                responseData.message.trim()
            ) {
                return responseData.message;
            }
        }

        if (error.message) {
            return error.message;
        }
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "Unable to save the candidate review. Please try again.";
};


/*
|--------------------------------------------------------------------------
| Status Configuration
|--------------------------------------------------------------------------
*/

const STATUS_TRANSITIONS: Record<
    JobApplicationStatus,
    JobApplicationStatus[]
> = {
    SUBMITTED: [
        "UNDER_REVIEW",
        "REJECTED",
    ],

    UNDER_REVIEW: [
        "SHORTLISTED",
        "REJECTED",
    ],

    SHORTLISTED: [
        "INTERVIEW",
        "REJECTED",
    ],

    INTERVIEW: [
        "SELECTED",
        "REJECTED",
    ],

    SELECTED: [],

    REJECTED: [],

    WITHDRAWN: [],
};


const STATUS_STYLES: Record<
    JobApplicationStatus,
    string
> = {
    SUBMITTED:
        "bg-blue-50 text-blue-700 ring-blue-600/10",

    UNDER_REVIEW:
        "bg-amber-50 text-amber-700 ring-amber-600/10",

    SHORTLISTED:
        "bg-violet-50 text-violet-700 ring-violet-600/10",

    INTERVIEW:
        "bg-indigo-50 text-indigo-700 ring-indigo-600/10",

    SELECTED:
        "bg-emerald-50 text-emerald-700 ring-emerald-600/10",

    REJECTED:
        "bg-red-50 text-red-700 ring-red-600/10",

    WITHDRAWN:
        "bg-gray-100 text-gray-600 ring-gray-500/10",
};


const STATUS_ICONS: Record<
    JobApplicationStatus,
    typeof FileCheck
> = {
    SUBMITTED: FileCheck,
    UNDER_REVIEW: Clock3,
    SHORTLISTED: Users,
    INTERVIEW: Clock3,
    SELECTED: CheckCircle2,
    REJECTED: XCircle,
    WITHDRAWN: XCircle,
};


/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function formatStatus(
    status: JobApplicationStatus,
): string {
    return status
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) =>
            character.toUpperCase(),
        );
}


function formatDate(
    value?: string | Date,
): string {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric",
        },
    );
}


function formatDateTime(
    value?: string | Date,
): string {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        },
    );
}


function getInitials(
    name: string,
): string {
    return (
        name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) =>
                part.charAt(0).toUpperCase(),
            )
            .join("") || "?"
    );
}


function getVacancyTitle(
    application: JobApplication,
): string {
    if (
        typeof application.vacancyId === "object" &&
        application.vacancyId
    ) {
        return (
            application.vacancyId.title ||
            application.vacancyId.jobTitle ||
            "Job vacancy"
        );
    }

    return "Job vacancy";
}


function getStatusCount(
    applications: JobApplication[],
    status: JobApplicationStatus,
): number {
    return applications.filter(
        (application) =>
            application.status === status,
    ).length;
}


/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

export default function JobApplicationsPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const isOwner = user?.accountType === "OWNER";

    const [applications, setApplications] =
        useState<JobApplication[]>([]);

    const [vacancies, setVacancies] =
        useState<JobVacancy[]>([]);

    const [searchInput, setSearchInput] =
        useState("");

    const [search, setSearch] =
        useState("");

    const [status, setStatus] =
        useState<JobApplicationStatus | "">("");

    const [vacancyId, setVacancyId] =
        useState("");

    const [page, setPage] =
        useState(1);

    const [total, setTotal] =
        useState(0);

    const [totalPages, setTotalPages] =
        useState(0);

    const [expandedId, setExpandedId] =
        useState<string | null>(null);

    const [loading, setLoading] =
        useState(true);

    const [refreshing, setRefreshing] =
        useState(false);

    const [updatingId, setUpdatingId] =
        useState<string | null>(null);

    const [error, setError] =
        useState("");

    const searchTimerRef =
        useRef<ReturnType<typeof setTimeout> | null>(
            null,
        );


    /*
    |--------------------------------------------------------------------------
    | Derived State
    |--------------------------------------------------------------------------
    */

    const hasFilters =
        Boolean(
            search ||
            status ||
            vacancyId,
        );


    const activeFilterCount =
        Number(Boolean(search)) +
        Number(Boolean(status)) +
        Number(Boolean(vacancyId));


    const selectedVacancy =
        useMemo(
            () =>
                vacancies.find(
                    (vacancy) =>
                        vacancy.id ===
                        vacancyId,
                ),
            [
                vacancies,
                vacancyId,
            ],
        );


    /*
    |--------------------------------------------------------------------------
    | Debounced Search
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        if (searchTimerRef.current) {
            clearTimeout(
                searchTimerRef.current,
            );
        }

        searchTimerRef.current =
            setTimeout(() => {
                const normalized =
                    searchInput.trim();

                setSearch(normalized);
                setPage(1);
                setExpandedId(null);
                setLoading(true);
            }, SEARCH_DEBOUNCE_MS);

        return () => {
            if (searchTimerRef.current) {
                clearTimeout(
                    searchTimerRef.current,
                );
            }
        };
    }, [searchInput]);


    /*
    |--------------------------------------------------------------------------
    | Load Applications
    |--------------------------------------------------------------------------
    */

    const loadApplications =
        useCallback(
            async (
                _options?: {
                    silent?: boolean;
                },
            ) => {
                try {
                    const result =
                        await jobApplicationsApi.getAll(
                            {
                                page,
                                limit: PAGE_SIZE,
                                search:
                                    search ||
                                    undefined,
                                status:
                                    status ||
                                    undefined,
                                vacancyId:
                                    vacancyId ||
                                    undefined,
                            },
                        );

                    setApplications(
                        result.applications,
                    );

                    setTotal(
                        result.pagination.total,
                    );

                    setTotalPages(
                        result.pagination.totalPages,
                    );
                    setError("");

                    setExpandedId(
                        (current) => {
                            if (
                                current &&
                                !result.applications.some(
                                    (
                                        application,
                                    ) =>
                                        application._id ===
                                        current,
                                )
                            ) {
                                return null;
                            }

                            return current;
                        },
                    );
                } catch {
                    setError(
                        "Unable to load job applications. Please try again.",
                    );
                } finally {
                    setLoading(false);
                    setRefreshing(false);
                }
            },
            [
                page,
                search,
                status,
                vacancyId,
            ],
        );


    useEffect(() => {
        void loadApplications();
    }, [loadApplications]);


    /*
    |--------------------------------------------------------------------------
    | Load Vacancy Filters
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        let mounted = true;

        const loadVacancies =
            async () => {
                try {
                    const result =
                        await jobVacanciesApi.getAll(
                            {
                                limit: 100,
                            },
                        );

                    if (mounted) {
                        setVacancies(
                            result.items,
                        );
                    }
                } catch {
                    if (mounted) {
                        setError(
                            "Unable to load vacancy filters.",
                        );
                    }
                }
            };

        void loadVacancies();

        return () => {
            mounted = false;
        };
    }, []);


    /*
    |--------------------------------------------------------------------------
    | Statistics
    |--------------------------------------------------------------------------
    */

    const statistics =
        useMemo(
            () => ({
                submitted:
                    getStatusCount(
                        applications,
                        "SUBMITTED",
                    ),

                underReview:
                    getStatusCount(
                        applications,
                        "UNDER_REVIEW",
                    ),

                shortlisted:
                    getStatusCount(
                        applications,
                        "SHORTLISTED",
                    ),

                interview:
                    getStatusCount(
                        applications,
                        "INTERVIEW",
                    ),

                selected:
                    getStatusCount(
                        applications,
                        "SELECTED",
                    ),

                rejected:
                    getStatusCount(
                        applications,
                        "REJECTED",
                    ),

                withdrawn:
                    getStatusCount(
                        applications,
                        "WITHDRAWN",
                    ),
            }),
            [applications],
        );


    /*
    |--------------------------------------------------------------------------
    | Status Update
    |--------------------------------------------------------------------------
    */

    const updateStatus =
        useCallback(
            async (
                applicationId: string,
                input: UpdateJobApplicationInput,
            ) => {
                if (
                    updatingId &&
                    updatingId !== applicationId
                ) {
                    return;
                }

                try {
                    setUpdatingId(
                        applicationId,
                    );

                    setError("");

                    const updated =
                        await jobApplicationsApi.updateStatus(
                            applicationId,
                            input,
                        );

                    setApplications(
                        (current) =>
                            current.map(
                                (
                                    application,
                                ) =>
                                    application._id ===
                                    applicationId
                                        ? {
                                              ...application,
                                              ...updated,
                                              vacancyId:
                                                  application.vacancyId,
                                          }
                                        : application,
                            ),
                    );

                } catch (error) {
                    setError(
                        getErrorMessage(error),
                    );
                } finally {
                    setUpdatingId(
                        null,
                    );
                }
            },
            [updatingId],
        );


    /*
    |--------------------------------------------------------------------------
    | Convert Selected Rider Applicant
    |--------------------------------------------------------------------------
    */

    const convertApplicationToRider =
        useCallback(
            async (applicationId: string) => {
                if (updatingId) return;

                let riderCode = "";

                if (isOwner) {
                    const enteredCode = window.prompt(
                        "Enter a unique Rider Code:",
                        `RDR-${applicationId.slice(-6).toUpperCase()}`,
                    );

                    if (enteredCode === null) return;

                    riderCode = enteredCode.trim();

                    if (!riderCode) {
                        setError("Rider Code is required.");
                        return;
                    }

                    if (
                        !window.confirm(
                            `Convert this selected applicant directly into a PENDING Rider with code ${riderCode}?`,
                        )
                    ) {
                        return;
                    }
                } else {
                    if (
                        !window.confirm(
                            "Submit this selected applicant for owner approval to become a PENDING Rider?",
                        )
                    ) {
                        return;
                    }
                }

                setUpdatingId(applicationId);
                setError("");

                try {
                    if (isOwner) {
                        await ridersApi.convertApplication(
                            applicationId,
                            { riderCode },
                        );
                    } else {
                        await jobApplicationsApi.requestRiderConversion(
                            applicationId,
                        );
                    }

                    await loadApplications();
                } catch (error) {
                    setError(getErrorMessage(error));
                } finally {
                    setUpdatingId(null);
                }
            },
            [isOwner, loadApplications, updatingId],
        );


    /*
    |--------------------------------------------------------------------------
    | Filter Handlers
    |--------------------------------------------------------------------------
    */

    const handleStatusFilter =
        (value: string) => {
            setStatus(
                value as
                    | JobApplicationStatus
                    | "",
            );

            setPage(1);
            setExpandedId(null);
            setLoading(true);
        };


    const handleVacancyFilter =
        (value: string) => {
            setVacancyId(value);
            setPage(1);
            setExpandedId(null);
            setLoading(true);
        };


    const clearFilters =
        () => {
            setSearchInput("");
            setSearch("");
            setStatus("");
            setVacancyId("");
            setPage(1);
            setExpandedId(null);
            setLoading(true);
        };


    /*
    |--------------------------------------------------------------------------
    | Pagination
    |--------------------------------------------------------------------------
    */

    const goToPreviousPage =
        () => {
            if (
                page <= 1 ||
                loading
            ) {
                return;
            }

            setPage(
                (current) =>
                    current - 1,
            );

            setExpandedId(null);
            setLoading(true);
        };


    const goToNextPage =
        () => {
            if (
                page >= totalPages ||
                loading
            ) {
                return;
            }

            setPage(
                (current) =>
                    current + 1,
            );

            setExpandedId(null);
            setLoading(true);
        };


    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <main className="min-h-full bg-gray-50/50 p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-[1600px]">

                {/* ======================================================
                    Header
                ====================================================== */}

                <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white shadow-sm">
                                <BriefcaseBusiness
                                    size={22}
                                />
                            </div>

                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
                                    Job Applications
                                </h1>

                                <p className="mt-1 text-sm text-gray-500">
                                    Review candidates and manage recruitment progress.
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            void loadApplications(
                                {
                                    silent: true,
                                },
                            )
                        }
                        disabled={
                            loading ||
                            refreshing
                        }
                        className="inline-flex w-fit items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <RefreshCw
                            size={16}
                            className={
                                refreshing
                                    ? "animate-spin"
                                    : ""
                            }
                        />

                        {refreshing
                            ? "Refreshing..."
                            : "Refresh"}
                    </button>
                </header>


                {/* ======================================================
                    Summary
                ====================================================== */}

                <section className="mb-6">
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-900">
                                Application overview
                            </h2>

                            <p className="mt-0.5 text-xs text-gray-500">
                                Current page statistics
                            </p>
                        </div>

                        {hasFilters && (
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                                {activeFilterCount} active{" "}
                                {activeFilterCount ===
                                1
                                    ? "filter"
                                    : "filters"}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                        <StatCard
                            label="Total"
                            value={total}
                            icon={FileCheck}
                        />

                        <StatCard
                            label="Submitted"
                            value={
                                statistics.submitted
                            }
                            icon={FileCheck}
                        />

                        <StatCard
                            label="Review"
                            value={
                                statistics.underReview
                            }
                            icon={Clock3}
                        />

                        <StatCard
                            label="Shortlisted"
                            value={
                                statistics.shortlisted
                            }
                            icon={Users}
                        />

                        <StatCard
                            label="Interview"
                            value={
                                statistics.interview
                            }
                            icon={Clock3}
                        />

                        <StatCard
                            label="Selected"
                            value={
                                statistics.selected
                            }
                            icon={CheckCircle2}
                        />

                        <StatCard
                            label="Rejected"
                            value={
                                statistics.rejected
                            }
                            icon={XCircle}
                        />
                    </div>
                </section>


                {/* ======================================================
                    Filters
                ====================================================== */}

                <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <SlidersHorizontal
                            size={17}
                            className="text-gray-500"
                        />

                        <h2 className="text-sm font-semibold text-gray-900">
                            Filters
                        </h2>
                    </div>

                    <div className="flex flex-col gap-4 xl:flex-row xl:items-end">

                        {/* Search */}

                        <div className="min-w-0 flex-1">
                            <label
                                htmlFor="application-search"
                                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500"
                            >
                                Search
                            </label>

                            <div className="relative">
                                <Search
                                    size={18}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                />

                                <input
                                    id="application-search"
                                    type="search"
                                    value={
                                        searchInput
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setSearchInput(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Search candidate name or email..."
                                    className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                                />

                                {searchInput && (
                                    <button
                                        type="button"
                                        aria-label="Clear search"
                                        onClick={() =>
                                            setSearchInput(
                                                "",
                                            )
                                        }
                                        className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                                    >
                                        <X
                                            size={15}
                                        />
                                    </button>
                                )}
                            </div>
                        </div>


                        {/* Status */}

                        <div className="w-full xl:w-56">
                            <label
                                htmlFor="application-status"
                                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500"
                            >
                                Status
                            </label>

                            <select
                                id="application-status"
                                value={status}
                                onChange={(
                                    event,
                                ) =>
                                    handleStatusFilter(
                                        event
                                            .target
                                            .value,
                                    )
                                }
                                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                            >
                                <option value="">
                                    All statuses
                                </option>

                                {JOB_APPLICATION_STATUSES.map(
                                    (
                                        item,
                                    ) => (
                                        <option
                                            key={
                                                item
                                            }
                                            value={
                                                item
                                            }
                                        >
                                            {formatStatus(
                                                item,
                                            )}
                                        </option>
                                    ),
                                )}
                            </select>
                        </div>


                        {/* Vacancy */}

                        <div className="w-full xl:w-72">
                            <label
                                htmlFor="application-vacancy"
                                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500"
                            >
                                Vacancy
                            </label>

                            <select
                                id="application-vacancy"
                                value={
                                    vacancyId
                                }
                                onChange={(
                                    event,
                                ) =>
                                    handleVacancyFilter(
                                        event
                                            .target
                                            .value,
                                    )
                                }
                                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                            >
                                <option value="">
                                    All vacancies
                                </option>

                                {vacancies.map(
                                    (
                                        vacancy,
                                    ) => (
                                        <option
                                            key={
                                                vacancy.id
                                            }
                                            value={
                                                vacancy.id
                                            }
                                        >
                                            {
                                                vacancy.title
                                            }
                                        </option>
                                    ),
                                )}
                            </select>
                        </div>


                        {/* Clear */}

                        {hasFilters && (
                            <button
                                type="button"
                                onClick={
                                    clearFilters
                                }
                                className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                            >
                                <XCircle
                                    size={16}
                                />

                                Clear
                            </button>
                        )}
                    </div>


                    {/* Active filter summary */}

                    {hasFilters && (
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                            <span className="text-xs font-medium text-gray-400">
                                Active:
                            </span>

                            {search && (
                                <FilterChip
                                    label={`Search: ${search}`}
                                    onRemove={() =>
                                        setSearchInput(
                                            "",
                                        )
                                    }
                                />
                            )}

                            {status && (
                                <FilterChip
                                    label={`Status: ${formatStatus(
                                        status,
                                    )}`}
                                    onRemove={() =>
                                        handleStatusFilter(
                                            "",
                                        )
                                    }
                                />
                            )}

                            {vacancyId && (
                                <FilterChip
                                    label={`Vacancy: ${
                                        selectedVacancy?.title ??
                                        "Selected"
                                    }`}
                                    onRemove={() =>
                                        handleVacancyFilter(
                                            "",
                                        )
                                    }
                                />
                            )}
                        </div>
                    )}
                </section>


                {/* ======================================================
                    Error
                ====================================================== */}

                {error && (
                    <div
                        role="alert"
                        className="mb-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="flex items-start gap-2">
                            <XCircle
                                size={18}
                                className="mt-0.5 shrink-0"
                            />

                            <span>
                                {error}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setError("");
                                void loadApplications();
                            }}
                            className="font-semibold underline underline-offset-2"
                        >
                            Try again
                        </button>
                    </div>
                )}


                {/* ======================================================
                    Results Header
                ====================================================== */}

                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-gray-500">
                        Showing{" "}
                        <span className="font-semibold text-gray-800">
                            {applications.length}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-gray-800">
                            {total}
                        </span>{" "}
                        applications
                    </div>

                    {hasFilters && (
                        <div className="text-xs text-gray-400">
                            Filtered results
                        </div>
                    )}
                </div>


                {/* ======================================================
                    Desktop Table
                ====================================================== */}

                <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:block">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] text-left">
                            <thead className="border-b border-gray-200 bg-gray-50">
                                <tr>
                                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Candidate
                                    </th>

                                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Position
                                    </th>

                                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Applied
                                    </th>

                                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Status
                                    </th>

                                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Next action
                                    </th>

                                    <th className="w-12 px-3 py-4" />
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <ApplicationSkeletonRows />
                                ) : applications.length ===
                                  0 ? (
                                    <EmptyState
                                        hasFilters={
                                            hasFilters
                                        }
                                        onClear={
                                            clearFilters
                                        }
                                    />
                                ) : (
                                    applications.map(
                                        (
                                            application,
                                        ) => {
                                            const nextStatuses =
                                                STATUS_TRANSITIONS[
                                                    application.status
                                                ];

                                            const StatusIcon =
                                                STATUS_ICONS[
                                                    application.status
                                                ];

                                            return (
                                                <ApplicationRow
                                                    key={
                                                        application._id
                                                    }
                                                    application={
                                                        application
                                                    }
                                                    nextStatuses={
                                                        nextStatuses
                                                    }
                                                    StatusIcon={
                                                        StatusIcon
                                                    }
                                                    isExpanded={
                                                        expandedId ===
                                                        application._id
                                                    }
                                                    isUpdating={
                                                        updatingId ===
                                                        application._id
                                                    }
                                                    onToggle={() =>
                                                        setExpandedId(
                                                            (
                                                                current,
                                                            ) =>
                                                                current ===
                                                                application._id
                                                                    ? null
                                                                    : application._id,
                                                        )
                                                    }
                                                    onUpdateStatus={
                                                        updateStatus
                                                    }
                                                    onCreateEmployeeInvitation={() =>
                                                        goToEmployeeInvitation(
                                                            router,
                                                            application._id,
                                                        )
                                                    }
                                                    onConvertToRider={
                                                        convertApplicationToRider
                                                    }
                                                    isOwner={isOwner}
                                                />
                                            );
                                        },
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>


                {/* ======================================================
                    Mobile / Tablet Cards
                ====================================================== */}

                <div className="space-y-3 lg:hidden">
                    {loading ? (
                        <MobileSkeletonCards />
                    ) : applications.length ===
                      0 ? (
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                            <EmptyState
                                hasFilters={
                                    hasFilters
                                }
                                onClear={
                                    clearFilters
                                }
                            />
                        </div>
                    ) : (
                        applications.map(
                            (
                                application,
                            ) => (
                                <MobileApplicationCard
                                    key={
                                        application._id
                                    }
                                    application={
                                        application
                                    }
                                    nextStatuses={
                                        STATUS_TRANSITIONS[
                                            application.status
                                        ]
                                    }
                                    StatusIcon={
                                        STATUS_ICONS[
                                            application.status
                                        ]
                                    }
                                    isExpanded={
                                        expandedId ===
                                        application._id
                                    }
                                    isUpdating={
                                        updatingId ===
                                        application._id
                                    }
                                    onToggle={() =>
                                        setExpandedId(
                                            (
                                                current,
                                            ) =>
                                                current ===
                                                application._id
                                                    ? null
                                                    : application._id,
                                        )
                                    }
                                    onUpdateStatus={
                                        updateStatus
                                    }
                                    onCreateEmployeeInvitation={() =>
                                        goToEmployeeInvitation(
                                            router,
                                            application._id,
                                        )
                                    }
                                    onConvertToRider={
                                        convertApplicationToRider
                                    }
                                    isOwner={isOwner}
                                />
                            ),
                        )
                    )}
                </div>


                {/* ======================================================
                    Pagination
                ====================================================== */}

                {totalPages > 1 && (
                    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-500">
                                Page{" "}
                                <span className="font-semibold text-gray-800">
                                    {page}
                                </span>{" "}
                                of{" "}
                                <span className="font-semibold text-gray-800">
                                    {totalPages}
                                </span>
                            </p>

                            <p className="mt-0.5 text-xs text-gray-400">
                                {total} total applications
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={
                                    page <=
                                        1 ||
                                    loading
                                }
                                onClick={
                                    goToPreviousPage
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <ChevronLeft
                                    size={16}
                                />

                                Previous
                            </button>

                            <button
                                type="button"
                                disabled={
                                    page >=
                                        totalPages ||
                                    loading
                                }
                                onClick={
                                    goToNextPage
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next

                                <ChevronRight
                                    size={16}
                                />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}


/*
|--------------------------------------------------------------------------
| Stat Card
|--------------------------------------------------------------------------
*/

interface StatCardProps {
    label: string;
    value: number;
    icon: typeof FileCheck;
}


function StatCard({
    label,
    value,
    icon: Icon,
}: StatCardProps) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {label}
                </span>

                <Icon
                    size={17}
                    className="text-gray-400"
                />
            </div>

            <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                {value}
            </p>
        </div>
    );
}


/*
|--------------------------------------------------------------------------
| Filter Chip
|--------------------------------------------------------------------------
*/

interface FilterChipProps {
    label: string;
    onRemove: () => void;
}


function FilterChip({
    label,
    onRemove,
}: FilterChipProps) {
    return (
        <button
            type="button"
            onClick={onRemove}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-100"
        >
            <span className="truncate">
                {label}
            </span>

            <X
                size={13}
                className="shrink-0"
            />
        </button>
    );
}


/*
|--------------------------------------------------------------------------
| Application Row
|--------------------------------------------------------------------------
*/

const goToEmployeeInvitation = (
    router: ReturnType<typeof useRouter>,
    applicationId: string,
): void => {
    const normalizedId = applicationId.trim();

    if (!normalizedId) {
        return;
    }

    router.push(
        `/admin/employee-invitations?applicationId=${encodeURIComponent(
            normalizedId,
        )}`,
    );
};

interface ApplicationRowProps {
    application: JobApplication;

    nextStatuses: JobApplicationStatus[];

    StatusIcon: typeof FileCheck;

    isExpanded: boolean;

    isUpdating: boolean;

    onToggle: () => void;

    onUpdateStatus: (
        applicationId: string,
        input: UpdateJobApplicationInput,
    ) => Promise<void>;
    onCreateEmployeeInvitation: (
        applicationId: string,
    ) => void;

    onConvertToRider: (applicationId: string) => Promise<void>;
    isOwner: boolean;
}


function ApplicationRow({
    application,
    nextStatuses,
    StatusIcon,
    isExpanded,
    isUpdating,
    onToggle,
    onUpdateStatus,
    onCreateEmployeeInvitation,
    onConvertToRider,
    isOwner,
}: ApplicationRowProps) {
    const vacancyTitle =
        getVacancyTitle(
            application,
        );

    const isRiderVacancy =
        application.vacancyId !== null &&
        typeof application.vacancyId === "object" &&
        application.vacancyId.vacancyType === "RIDER";

    return (
        <tr className="group">
            <td
                colSpan={6}
                className="p-0"
            >
                <div className="grid min-w-[1100px] grid-cols-[1.25fr_1.25fr_0.85fr_1fr_1fr_48px] items-center transition hover:bg-gray-50">

                    {/* Candidate */}

                    <div className="px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                                {getInitials(
                                    application.name,
                                )}
                            </div>

                            <div className="min-w-0">
                                <p className="truncate font-semibold text-gray-900">
                                    {
                                        application.name
                                    }
                                </p>

                                <a
                                    href={`mailto:${application.email}`}
                                    className="mt-0.5 block truncate text-sm text-gray-500 transition hover:text-gray-900"
                                >
                                    {
                                        application.email
                                    }
                                </a>
                            </div>
                        </div>
                    </div>


                    {/* Position */}

                    <div className="px-5 py-4">
                        <p className="truncate text-sm font-medium text-gray-800">
                            {
                                vacancyTitle
                            }
                        </p>

                        {application.phone && (
                            <a
                                href={`tel:${application.phone}`}
                                className="mt-1 block text-xs text-gray-400 hover:text-gray-700"
                            >
                                {
                                    application.phone
                                }
                            </a>
                        )}
                    </div>


                    {/* Applied */}

                    <div className="px-5 py-4 text-sm text-gray-600">
                        <p>
                            {formatDate(
                                application.appliedAt,
                            )}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                            {
                                formatDateTime(
                                    application.appliedAt,
                                )
                            }
                        </p>
                    </div>


                    {/* Status */}

                    <div className="px-5 py-4">
                        <StatusBadge
                            status={
                                application.status
                            }
                            Icon={
                                StatusIcon
                            }
                        />
                    </div>


                    {/* Next Action */}

                    <div className="px-5 py-4">
                        {application.status === "SELECTED" ? (
                            isRiderVacancy ? (
                                application.riderConversionRequestedAt && !isOwner ? (
                                    <span className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                                        Awaiting owner approval
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={isUpdating}
                                        onClick={() => void onConvertToRider(application._id)}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-50"
                                    >
                                        <UserPlus size={14} />
                                        {isUpdating
                                            ? (isOwner ? "Converting..." : "Submitting...")
                                            : isOwner
                                              ? (application.riderConversionRequestedAt
                                                  ? "Approve & Convert to Rider"
                                                  : "Convert to Rider")
                                              : "Request Rider Conversion"}
                                    </button>
                                )
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onCreateEmployeeInvitation(application._id)}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-gray-800"
                                >
                                    <UserPlus size={14} />
                                    Create Employee Invitation
                                </button>
                            )
                        ) : (
                            <StatusSelect
                                application={
                                    application
                                }
                                nextStatuses={
                                    nextStatuses
                                }
                                isUpdating={
                                    isUpdating
                                }
                                onUpdateStatus={
                                    onUpdateStatus
                                }
                            />
                        )}
                    </div>


                    {/* Expand */}

                    <button
                        type="button"
                        aria-label={
                            isExpanded
                                ? `Hide details for ${application.name}`
                                : `Show details for ${application.name}`
                        }
                        aria-expanded={
                            isExpanded
                        }
                        onClick={
                            onToggle
                        }
                        className="flex h-full min-h-[88px] items-center justify-center text-gray-400 transition hover:bg-gray-100 hover:text-gray-900"
                    >
                        <ChevronDown
                            size={18}
                            className={
                                isExpanded
                                    ? "rotate-180 transition"
                                    : "transition"
                            }
                        />
                    </button>
                </div>


                {isExpanded && (
                    <ApplicationExpandedDetails
                        application={
                            application
                        }
                        StatusIcon={
                            StatusIcon
                        }
                        isUpdating={
                            isUpdating
                        }
                        onUpdateStatus={
                            onUpdateStatus
                        }
                    />
                )}
            </td>
        </tr>
    );
}


/*
|--------------------------------------------------------------------------
| Mobile Application Card
|--------------------------------------------------------------------------
*/

interface MobileApplicationCardProps {
    application: JobApplication;

    nextStatuses: JobApplicationStatus[];

    StatusIcon: typeof FileCheck;

    onCreateEmployeeInvitation: (
        applicationId: string,
    ) => void;

    onConvertToRider: (applicationId: string) => Promise<void>;
    isOwner: boolean;

    isExpanded: boolean;

    isUpdating: boolean;

    onToggle: () => void;

    onUpdateStatus: (
        applicationId: string,
        input: UpdateJobApplicationInput,
    ) => Promise<void>;
}


function MobileApplicationCard({
    application,
    nextStatuses,
    StatusIcon,
    isExpanded,
    isUpdating,
    onToggle,
    onUpdateStatus,
    onCreateEmployeeInvitation,
    onConvertToRider,
    isOwner,
}: MobileApplicationCardProps) {
    const vacancyTitle =
        getVacancyTitle(
            application,
        );

    const isRiderVacancy =
        application.vacancyId !== null &&
        typeof application.vacancyId === "object" &&
        application.vacancyId.vacancyType === "RIDER";

    return (
        <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                        {getInitials(
                            application.name,
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h2 className="truncate text-sm font-semibold text-gray-900">
                                    {
                                        application.name
                                    }
                                </h2>

                                <a
                                    href={`mailto:${application.email}`}
                                    className="mt-0.5 block truncate text-xs text-gray-500"
                                >
                                    {
                                        application.email
                                    }
                                </a>
                            </div>

                            <StatusBadge
                                status={
                                    application.status
                                }
                                Icon={
                                    StatusIcon
                                }
                            />
                        </div>
                    </div>
                </div>


                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3">
                    <div>
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                            Position
                        </span>

                        <p className="mt-1 truncate text-sm font-medium text-gray-800">
                            {
                                vacancyTitle
                            }
                        </p>
                    </div>

                    <div>
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                            Applied
                        </span>

                        <p className="mt-1 text-sm text-gray-700">
                            {formatDate(
                                application.appliedAt,
                            )}
                        </p>
                    </div>
                </div>


                <div className="mt-4">
                    {application.status === "SELECTED" ? (
                        isRiderVacancy ? (
                            application.riderConversionRequestedAt && !isOwner ? (
                                <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">
                                    Awaiting owner approval
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => void onConvertToRider(application._id)}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-50"
                                >
                                    <UserPlus size={16} />
                                    {isUpdating
                                            ? (isOwner ? "Converting..." : "Submitting...")
                                            : isOwner
                                              ? (application.riderConversionRequestedAt
                                                  ? "Approve & Convert to Rider"
                                                  : "Convert to Rider")
                                              : "Request Rider Conversion"}
                                </button>
                            )
                        ) : (
                            <button
                                type="button"
                                onClick={() => onCreateEmployeeInvitation(application._id)}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
                            >
                                <UserPlus size={16} />
                                Create Employee Invitation
                            </button>
                        )
                    ) : (
                        <StatusSelect
                            application={
                                application
                            }
                            nextStatuses={
                                nextStatuses
                            }
                            isUpdating={
                                isUpdating
                            }
                            onUpdateStatus={
                                onUpdateStatus
                            }
                        />
                    )}
                </div>


                <button
                    type="button"
                    onClick={
                        onToggle
                    }
                    aria-expanded={
                        isExpanded
                    }
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                >
                    {isExpanded
                        ? "Hide details"
                        : "View details"}

                    <ChevronDown
                        size={16}
                        className={
                            isExpanded
                                ? "rotate-180 transition"
                                : "transition"
                        }
                    />
                </button>
            </div>


            {isExpanded && (
                <ApplicationExpandedDetails
                    application={
                        application
                    }
                    StatusIcon={
                        StatusIcon
                    }
                    isUpdating={
                        isUpdating
                    }
                    onUpdateStatus={
                        onUpdateStatus
                    }
                />
            )}
        </article>
    );
}


/*
|--------------------------------------------------------------------------
| Status Badge
|--------------------------------------------------------------------------
*/

interface StatusBadgeProps {
    status: JobApplicationStatus;

    Icon: typeof FileCheck;
}


function StatusBadge({
    status,
    Icon,
}: StatusBadgeProps) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status]}`}
        >
            <Icon size={13} />

            {formatStatus(
                status,
            )}
        </span>
    );
}


/*
|--------------------------------------------------------------------------
| Status Select
|--------------------------------------------------------------------------
*/

interface StatusSelectProps {
    application: JobApplication;

    nextStatuses: JobApplicationStatus[];

    isUpdating: boolean;

    onUpdateStatus: (
        applicationId: string,
        input: UpdateJobApplicationInput,
    ) => Promise<void>;
}


function StatusSelect({
    application,
    nextStatuses,
    isUpdating,
    onUpdateStatus,
}: StatusSelectProps) {
    if (
        nextStatuses.length ===
        0
    ) {
        return (
            <span className="text-xs text-gray-400">
                No further actions
            </span>
        );
    }

    return (
        <select
            aria-label={`Update status for ${application.name}`}
            value=""
            disabled={
                isUpdating
            }
            onChange={(
                event,
            ) => {
                const nextStatus =
                    event.target
                        .value as JobApplicationStatus;

                if (
                    nextStatus
                ) {
                    void onUpdateStatus(
                        application._id,
                        {
                            status:
                                nextStatus,
                        },
                    );
                }
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
            <option value="">
                {isUpdating
                    ? "Updating..."
                    : "Change status"}
            </option>

            {nextStatuses.map(
                (
                    nextStatus,
                ) => (
                    <option
                        key={
                            nextStatus
                        }
                        value={
                            nextStatus
                        }
                    >
                        {formatStatus(
                            nextStatus,
                        )}
                    </option>
                ),
            )}
        </select>
    );
}


/*
|--------------------------------------------------------------------------
| Expanded Details
|--------------------------------------------------------------------------
*/

interface ApplicationExpandedDetailsProps {
    application: JobApplication;

    StatusIcon: typeof FileCheck;

    isUpdating: boolean;

    onUpdateStatus: (
        applicationId: string,
        input: UpdateJobApplicationInput,
    ) => Promise<void>;
}


function ApplicationExpandedDetails({
    application,
    StatusIcon,
    isUpdating,
    onUpdateStatus,
}: ApplicationExpandedDetailsProps) {
    return (
        <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-5 md:px-5 md:py-6">
            <div className="grid gap-5 xl:grid-cols-[1fr_1fr_1.2fr]">

                {/* Candidate */}

                <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <Users
                            size={17}
                            className="text-gray-500"
                        />

                        <h2 className="text-sm font-semibold text-gray-900">
                            Candidate
                        </h2>
                    </div>

                    <div className="space-y-4 text-sm">
                        <DetailItem
                            label="Full name"
                            value={
                                application.name
                            }
                        />

                        <div>
                            <span className="block text-xs font-medium uppercase tracking-wide text-gray-400">
                                Email
                            </span>

                            <a
                                href={`mailto:${application.email}`}
                                className="mt-1 inline-flex items-center gap-1.5 break-all text-gray-700 hover:text-gray-900 hover:underline"
                            >
                                <Mail
                                    size={14}
                                />

                                {
                                    application.email
                                }
                            </a>
                        </div>

                        <div>
                            <span className="block text-xs font-medium uppercase tracking-wide text-gray-400">
                                Phone
                            </span>

                            {application.phone ? (
                                <a
                                    href={`tel:${application.phone}`}
                                    className="mt-1 inline-flex items-center gap-1.5 text-gray-700 hover:text-gray-900 hover:underline"
                                >
                                    <Phone
                                        size={14}
                                    />

                                    {
                                        application.phone
                                    }
                                </a>
                            ) : (
                                <p className="mt-1 text-gray-500">
                                    Not provided
                                </p>
                            )}
                        </div>

                        <DetailItem
                            label="Applied"
                            value={formatDateTime(
                                application.appliedAt,
                            )}
                        />

                        {application.resumeUrl && (
                            <a
                                href={
                                    application.resumeUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                            >
                                View resume

                                <ExternalLink
                                    size={14}
                                />
                            </a>
                        )}
                    </div>
                </div>


                {/* Status */}

                <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <StatusIcon
                            size={17}
                            className="text-gray-500"
                        />

                        <h2 className="text-sm font-semibold text-gray-900">
                            Application status
                        </h2>
                    </div>

                    <div className="space-y-4 text-sm">
                        <DetailItem
                            label="Current status"
                            value={formatStatus(
                                application.status,
                            )}
                        />

                        {application.reviewedAt && (
                            <DetailItem
                                label="Reviewed"
                                value={formatDateTime(
                                    application.reviewedAt,
                                )}
                            />
                        )}

                        {application.interviewAt && (
                            <DetailItem
                                label="Interview"
                                value={formatDateTime(
                                    application.interviewAt,
                                )}
                            />
                        )}

                        {application.selectedAt && (
                            <DetailItem
                                label="Selected"
                                value={formatDateTime(
                                    application.selectedAt,
                                )}
                            />
                        )}

                        {application.rejectedAt && (
                            <DetailItem
                                label="Rejected"
                                value={formatDateTime(
                                    application.rejectedAt,
                                )}
                            />
                        )}

                        {application.withdrawnAt && (
                            <DetailItem
                                label="Withdrawn"
                                value={formatDateTime(
                                    application.withdrawnAt,
                                )}
                            />
                        )}

                        {application.rejectionReason && (
                            <div>
                                <span className="block text-xs font-medium uppercase tracking-wide text-gray-400">
                                    Rejection reason
                                </span>

                                <p className="mt-1 whitespace-pre-wrap leading-6 text-gray-600">
                                    {
                                        application.rejectionReason
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                </div>


                {/* Cover Letter */}

                <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <h2 className="text-sm font-semibold text-gray-900">
                        Cover letter
                    </h2>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                        {application.coverLetter ||
                            "No cover letter provided."}
                    </p>

                    {application.notes && (
                        <div className="mt-5 border-t border-gray-100 pt-5">
                            <h3 className="text-sm font-semibold text-gray-900">
                                Reviewer notes
                            </h3>

                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                                {
                                    application.notes
                                }
                            </p>
                        </div>
                    )}
                </div>
            </div>


            {/* Review Form */}

            <div className="mt-6">
                <JobApplicationReviewForm
                    key={`${application._id}-${application.status}-${application.reviewedAt ?? ""}-${application.interviewAt ?? ""}`}
                    application={
                        application
                    }
                    onSave={
                        onUpdateStatus
                    }
                    saving={
                        isUpdating
                    }
                />
            </div>
        </div>
    );
}


/*
|--------------------------------------------------------------------------
| Detail Item
|--------------------------------------------------------------------------
*/

interface DetailItemProps {
    label: string;
    value: string;
}


function DetailItem({
    label,
    value,
}: DetailItemProps) {
    return (
        <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-gray-400">
                {label}
            </span>

            <p className="mt-1 leading-6 text-gray-700">
                {value}
            </p>
        </div>
    );
}


/*
|--------------------------------------------------------------------------
| Empty State
|--------------------------------------------------------------------------
*/

interface EmptyStateProps {
    hasFilters: boolean;

    onClear: () => void;
}


function EmptyState({
    hasFilters,
    onClear,
}: EmptyStateProps) {
    return (
        <tr>
            <td
                colSpan={6}
                className="px-5 py-16 text-center"
            >
                <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                        <BriefcaseBusiness
                            size={22}
                            className="text-gray-400"
                        />
                    </div>

                    <h2 className="text-sm font-semibold text-gray-900">
                        No applications found
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-gray-500">
                        {hasFilters
                            ? "Try changing your search or filters."
                            : "There are no job applications to display yet."}
                    </p>

                    {hasFilters && (
                        <button
                            type="button"
                            onClick={
                                onClear
                            }
                            className="mt-4 text-sm font-semibold text-gray-900 underline underline-offset-4"
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}


/*
|--------------------------------------------------------------------------
| Desktop Loading Skeleton
|--------------------------------------------------------------------------
*/

function ApplicationSkeletonRows() {
    return (
        <>
            {Array.from(
                {
                    length: 6,
                },
                (_, index) => (
                    <tr
                        key={
                            index
                        }
                    >
                        <td
                            colSpan={6}
                            className="p-0"
                        >
                            <div className="grid min-w-[1100px] grid-cols-[1.25fr_1.25fr_0.85fr_1fr_1fr_48px] items-center">
                                {Array.from(
                                    {
                                        length: 6,
                                    },
                                    (
                                        __,
                                        cellIndex,
                                    ) => (
                                        <div
                                            key={
                                                cellIndex
                                            }
                                            className="px-5 py-6"
                                        >
                                            <div className="h-4 animate-pulse rounded bg-gray-100" />
                                        </div>
                                    ),
                                )}
                            </div>
                        </td>
                    </tr>
                ),
            )}
        </>
    );
}


/*
|--------------------------------------------------------------------------
| Mobile Loading Skeleton
|--------------------------------------------------------------------------
*/

function MobileSkeletonCards() {
    return (
        <>
            {Array.from(
                {
                    length: 5,
                },
                (_, index) => (
                    <div
                        key={
                            index
                        }
                        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                        <div className="flex gap-3">
                            <div className="h-11 w-11 animate-pulse rounded-full bg-gray-100" />

                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />

                                <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                            </div>
                        </div>

                        <div className="mt-4 h-16 animate-pulse rounded-xl bg-gray-100" />

                        <div className="mt-4 h-9 animate-pulse rounded-lg bg-gray-100" />
                    </div>
                ),
            )}
        </>
    );
}
