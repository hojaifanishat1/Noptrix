"use client";

import { isAxiosError } from "axios";
import {
    ArrowLeft,
    BriefcaseBusiness,
    CalendarDays,
    Check,
    ChevronDown,
    CircleAlert,
    CircleDollarSign,
    ExternalLink,
    GripVertical,
    MapPin,
    Plus,
    Save,
    Trash2,
    Users,
    X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
    useMemo,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";

import { jobVacanciesApi } from "@/services/api/job-vacancies.api";

import {
    JOB_EMPLOYMENT_TYPES,
    JOB_SALARY_TYPES,
    type CreateJobVacancyInput,
    type JobVacancy,
} from "./job-vacancy.types";

const DEFAULT_CURRENCY = "BDT";
const DESCRIPTION_MIN_LENGTH = 20;
const DESCRIPTION_MAX_LENGTH = 10000;
const MAX_LIST_ITEMS = 30;

const initialForm: CreateJobVacancyInput = {
    vacancyType: "GENERAL",
    title: "",
    slug: "",
    department: "",
    jobTitle: "",
    description: "",
    responsibilities: [],
    requirements: [],
    qualifications: [],
    skills: [],
    employmentType: JOB_EMPLOYMENT_TYPES.FULL_TIME,
    location: "",
    isRemote: false,
    salaryType: JOB_SALARY_TYPES.UNDISCLOSED,
    salaryMin: undefined,
    salaryMax: undefined,
    salaryCurrency: DEFAULT_CURRENCY,
    openings: 1,
    applicationDeadline: "",
};

interface JobVacancyFormProps {
    vacancyId?: string;
    initialVacancy?: JobVacancy;
}

interface FieldProps {
    label: string;
    required?: boolean;
    hint?: string;
    error?: string;
    children: ReactNode;
}

interface TagInputProps {
    label: string;
    values: string[];
    placeholder: string;
    onChange: (values: string[]) => void;
    required?: boolean;
    hint?: string;
    error?: string;
    maxItems?: number;
}

const cn = (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" ");

const normalizeSlug = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

const joinDateForInput = (value?: string): string => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value.slice(0, 10);
    }

    return date.toISOString().slice(0, 10);
};

const getInitialForm = (
    vacancy?: JobVacancy,
): CreateJobVacancyInput => {
    if (!vacancy) {
        return {
            ...initialForm,
            responsibilities: [],
            requirements: [],
            qualifications: [],
            skills: [],
        };
    }

    return {
        title: vacancy.title ?? "",
        vacancyType: vacancy.vacancyType ?? "GENERAL",
        slug: vacancy.slug ?? "",
        department: vacancy.department ?? "",
        jobTitle: vacancy.jobTitle ?? "",
        description: vacancy.description ?? "",
        responsibilities: [...(vacancy.responsibilities ?? [])],
        requirements: [...(vacancy.requirements ?? [])],
        qualifications: [...(vacancy.qualifications ?? [])],
        skills: [...(vacancy.skills ?? [])],
        employmentType: vacancy.employmentType,
        location: vacancy.location ?? "",
        isRemote: Boolean(vacancy.isRemote),
        salaryType: vacancy.salaryType,
        salaryMin: vacancy.salaryMin,
        salaryMax: vacancy.salaryMax,
        salaryCurrency:
            vacancy.salaryCurrency?.toUpperCase() ??
            DEFAULT_CURRENCY,
        openings: vacancy.openings ?? 1,
        applicationDeadline: joinDateForInput(
            vacancy.applicationDeadline,
        ),
    };
};

const formatEnum = (value: string): string =>
    value
        .toLowerCase()
        .split("_")
        .map(
            (part) =>
                part.charAt(0).toUpperCase() +
                part.slice(1),
        )
        .join(" ");

const getSaveErrorMessage = (error: unknown): string => {
    if (isAxiosError(error)) {
        const responseMessage = error.response?.data?.message;

        if (typeof responseMessage === "string" && responseMessage.trim()) {
            return responseMessage;
        }

        if (error.message) {
            return error.message;
        }
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "Unable to save this job vacancy. Please try again.";
};

const Card = ({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) => (
    <section
        className={cn(
            "rounded-2xl border border-gray-200 bg-white shadow-sm",
            className,
        )}
    >
        {children}
    </section>
);

const CardHeader = ({
    icon: Icon,
    title,
    description,
}: {
    icon: typeof BriefcaseBusiness;
    title: string;
    description?: string;
}) => (
    <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Icon className="h-5 w-5" />
            </div>

            <div>
                <h2 className="text-sm font-bold text-gray-900">
                    {title}
                </h2>

                {description ? (
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                        {description}
                    </p>
                ) : null}
            </div>
        </div>
    </div>
);

const Field = ({
    label,
    required,
    hint,
    error,
    children,
}: FieldProps) => (
    <div className="space-y-2">
        <div>
            <label className="text-xs font-bold uppercase tracking-[0.08em] text-gray-600">
                {label}
                {required ? (
                    <span className="ml-1 text-red-500">*</span>
                ) : null}
            </label>

            {hint ? (
                <p className="mt-1 text-xs text-gray-400">
                    {hint}
                </p>
            ) : null}
        </div>

        {children}

        {error ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                {error}
            </p>
        ) : null}
    </div>
);

const Input = (
    props: React.InputHTMLAttributes<HTMLInputElement>,
) => (
    <input
        {...props}
        className={cn(
            "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-900",
            "outline-none transition placeholder:text-gray-400",
            "focus:border-slate-400 focus:ring-4 focus:ring-slate-100",
            "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
            props.className,
        )}
    />
);

const Select = (
    props: React.SelectHTMLAttributes<HTMLSelectElement>,
) => (
    <div className="relative">
        <select
            {...props}
            className={cn(
                "h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white px-3.5 pr-10 text-sm text-gray-900",
                "outline-none transition",
                "focus:border-slate-400 focus:ring-4 focus:ring-slate-100",
                "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
                props.className,
            )}
        />

        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
);

const Textarea = (
    props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) => (
    <textarea
        {...props}
        className={cn(
            "min-h-32 w-full resize-y rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900",
            "outline-none transition placeholder:text-gray-400",
            "focus:border-slate-400 focus:ring-4 focus:ring-slate-100",
            props.className,
        )}
    />
);

const TagInput = ({
    label,
    values,
    placeholder,
    onChange,
    required,
    hint,
    error,
    maxItems = MAX_LIST_ITEMS,
}: TagInputProps) => {
    const [draft, setDraft] = useState("");

    const addValue = () => {
        const value = draft.trim().replace(/\s+/g, " ");

        if (!value || values.length >= maxItems) {
            setDraft("");
            return;
        }

        const exists = values.some(
            (item) => item.toLowerCase() === value.toLowerCase(),
        );

        if (!exists) {
            onChange([...values, value]);
        }

        setDraft("");
    };

    const removeValue = (index: number) => {
        onChange(values.filter((_, itemIndex) => itemIndex !== index));
    };

    const handleKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addValue();
            return;
        }

        if (
            event.key === "Backspace" &&
            !draft &&
            values.length > 0
        ) {
            event.preventDefault();
            onChange(values.slice(0, -1));
        }
    };

    return (
        <Field
            label={label}
            required={required}
            hint={hint}
            error={error}
        >
            <div className="rounded-xl border border-gray-200 bg-white p-3 focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-100">
                <div className="flex flex-wrap gap-2">
                    {values.map((value, index) => (
                        <span
                            key={`${value}-${index}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700"
                        >
                            {value}

                            <button
                                type="button"
                                onClick={() => removeValue(index)}
                                className="rounded p-0.5 text-slate-400 transition hover:bg-white hover:text-red-500"
                                aria-label={`Remove ${value}`}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </span>
                    ))}
                </div>

                <div className="mt-2 flex items-center gap-2">
                    <input
                        value={draft}
                        onChange={(event) =>
                            setDraft(event.target.value)
                        }
                        onKeyDown={handleKeyDown}
                        onBlur={() => {
                            if (draft.trim()) {
                                addValue();
                            }
                        }}
                        disabled={values.length >= maxItems}
                        placeholder={
                            values.length >= maxItems
                                ? `Maximum ${maxItems} items`
                                : placeholder
                        }
                        className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm text-gray-900 outline-none placeholder:text-gray-400"
                    />

                    <button
                        type="button"
                        onClick={addValue}
                        disabled={
                            !draft.trim() ||
                            values.length >= maxItems
                        }
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                    </button>
                </div>
            </div>
        </Field>
    );
};

const Toggle = ({
    checked,
    onChange,
    label,
    description,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
    description: string;
}) => (
    <button
        type="button"
        onClick={() => onChange(!checked)}
        className="flex w-full items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:border-gray-300"
    >
        <div>
            <p className="text-sm font-semibold text-gray-900">
                {label}
            </p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
                {description}
            </p>
        </div>

        <span
            className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition",
                checked ? "bg-slate-900" : "bg-gray-200",
            )}
        >
            <span
                className={cn(
                    "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition",
                    checked ? "left-6" : "left-1",
                )}
            />
        </span>
    </button>
);

export default function JobVacancyForm({
    vacancyId,
    initialVacancy,
}: JobVacancyFormProps) {
    const router = useRouter();

    const isEditMode = Boolean(vacancyId);

    const initialState = useMemo(
        () => getInitialForm(initialVacancy),
        [initialVacancy],
    );

    const [form, setForm] =
        useState<CreateJobVacancyInput>(initialState);

    const [errors, setErrors] = useState<
        Record<string, string>
    >({});

    const [submitError, setSubmitError] =
        useState<string | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [slugManuallyEdited, setSlugManuallyEdited] =
        useState(isEditMode);

    const updateField = <K extends keyof CreateJobVacancyInput>(
        field: K,
        value: CreateJobVacancyInput[K],
    ) => {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));

        setIsDirty(true);

        setErrors((current) => {
            if (!current[field as string]) {
                return current;
            }

            const next = { ...current };
            delete next[field as string];
            return next;
        });
    };

    const updateTitle = (value: string) => {
        updateField("title", value);

        if (!slugManuallyEdited) {
            setForm((current) => ({
                ...current,
                title: value,
                slug: normalizeSlug(value),
            }));
        }
    };

    const updateSlug = (value: string) => {
        setSlugManuallyEdited(true);
        updateField("slug", normalizeSlug(value));
    };

    const checklist = useMemo(
        () => [
            {
                label: "Position title",
                complete: form.title.trim().length >= 3,
            },
            {
                label: "Department",
                complete: form.department.trim().length >= 2,
            },
            {
                label: "Description",
                complete:
                    form.description.trim().length >=
                    DESCRIPTION_MIN_LENGTH,
            },
            {
                label: "Responsibilities",
                complete: form.responsibilities.length > 0,
            },
            {
                label: "Requirements",
                complete: form.requirements.length > 0,
            },
            {
                label: "Work location",
                complete:
                    form.isRemote ||
                    Boolean(form.location?.trim()),
            },
            {
                label: "Openings",
                complete: Number(form.openings) >= 1,
            },
        ],
        [form],
    );

    const completedChecklist = checklist.filter(
        (item) => item.complete,
    ).length;

    const isFormReady =
        completedChecklist === checklist.length;

    const publicUrl = form.slug.trim()
        ? `/jobs/${normalizeSlug(form.slug)}`
        : "/jobs/your-job-slug";

    const salaryPreview = useMemo(() => {
        switch (form.salaryType) {
            case JOB_SALARY_TYPES.FIXED:
                return form.salaryMin
                    ? `${form.salaryCurrency || DEFAULT_CURRENCY} ${Number(form.salaryMin).toLocaleString()}`
                    : "Salary not specified";

            case JOB_SALARY_TYPES.RANGE:
                if (
                    form.salaryMin !== undefined &&
                    form.salaryMax !== undefined
                ) {
                    return `${form.salaryCurrency || DEFAULT_CURRENCY} ${Number(form.salaryMin).toLocaleString()} – ${Number(form.salaryMax).toLocaleString()}`;
                }

                return "Salary range not specified";

            case JOB_SALARY_TYPES.NEGOTIABLE:
                return "Negotiable";

            default:
                return "Salary undisclosed";
        }
    }, [
        form.salaryCurrency,
        form.salaryMax,
        form.salaryMin,
        form.salaryType,
    ]);

    const validate = (): boolean => {
        const nextErrors: Record<string, string> = {};

        if (form.title.trim().length < 3) {
            nextErrors.title =
                "Position title must contain at least 3 characters.";
        }

        if (!form.slug.trim()) {
            nextErrors.slug = "Slug is required.";
        } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
            nextErrors.slug =
                "Use lowercase letters, numbers and hyphens only.";
        }

        if (form.department.trim().length < 2) {
            nextErrors.department =
                "Department is required.";
        }

        if (form.jobTitle.trim().length < 2) {
            nextErrors.jobTitle =
                "Job title is required.";
        }

        const descriptionLength =
            form.description.trim().length;

        if (descriptionLength < DESCRIPTION_MIN_LENGTH) {
            nextErrors.description = `Description must contain at least ${DESCRIPTION_MIN_LENGTH} characters.`;
        } else if (
            descriptionLength > DESCRIPTION_MAX_LENGTH
        ) {
            nextErrors.description = `Description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters.`;
        }

        if (form.responsibilities.length === 0) {
            nextErrors.responsibilities =
                "Add at least one responsibility.";
        }

        if (form.requirements.length === 0) {
            nextErrors.requirements =
                "Add at least one requirement.";
        }

        if (!form.isRemote && !form.location?.trim()) {
            nextErrors.location =
                "Location is required for onsite or hybrid work.";
        }

        if (!Number.isInteger(Number(form.openings)) || form.openings < 1) {
            nextErrors.openings =
                "Openings must be at least 1.";
        }

        if (
            form.salaryType === JOB_SALARY_TYPES.FIXED
        ) {
            if (
                form.salaryMin === undefined ||
                Number(form.salaryMin) < 0
            ) {
                nextErrors.salaryMin =
                    "Enter a valid salary amount.";
            }
        }

        if (
            form.salaryType === JOB_SALARY_TYPES.RANGE
        ) {
            if (
                form.salaryMin === undefined ||
                Number(form.salaryMin) < 0
            ) {
                nextErrors.salaryMin =
                    "Enter a minimum salary.";
            }

            if (
                form.salaryMax === undefined ||
                Number(form.salaryMax) < 0
            ) {
                nextErrors.salaryMax =
                    "Enter a maximum salary.";
            }

            if (
                form.salaryMin !== undefined &&
                form.salaryMax !== undefined &&
                Number(form.salaryMax) <
                    Number(form.salaryMin)
            ) {
                nextErrors.salaryMax =
                    "Maximum salary cannot be lower than minimum salary.";
            }
        }

        if (form.applicationDeadline) {
            const deadline = new Date(
                `${form.applicationDeadline}T23:59:59`,
            );

            if (Number.isNaN(deadline.getTime())) {
                nextErrors.applicationDeadline =
                    "Enter a valid application deadline.";
            }
        }

        setErrors(nextErrors);

        return Object.keys(nextErrors).length === 0;
    };

    const buildPayload = (): CreateJobVacancyInput => {
        const payload: CreateJobVacancyInput = {
            ...form,
            title: form.title.trim(),
            slug: normalizeSlug(form.slug),
            department: form.department.trim(),
            jobTitle: form.jobTitle.trim(),
            description: form.description.trim(),
            responsibilities: form.responsibilities
                .map((item) => item.trim())
                .filter(Boolean),
            requirements: form.requirements
                .map((item) => item.trim())
                .filter(Boolean),
            qualifications: form.qualifications
                ?.map((item) => item.trim())
                .filter(Boolean),
            skills: form.skills
                ?.map((item) => item.trim())
                .filter(Boolean),
            location: form.isRemote
                ? undefined
                : form.location?.trim() || undefined,
            salaryCurrency:
                form.salaryCurrency?.trim().toUpperCase() ||
                DEFAULT_CURRENCY,
            openings: Number(form.openings),
            applicationDeadline:
                form.applicationDeadline || undefined,
        };

        if (
            form.salaryType === JOB_SALARY_TYPES.UNDISCLOSED ||
            form.salaryType === JOB_SALARY_TYPES.NEGOTIABLE
        ) {
            payload.salaryMin = undefined;
            payload.salaryMax = undefined;
        }

        if (form.salaryType === JOB_SALARY_TYPES.FIXED) {
            payload.salaryMax = undefined;
        }

        return payload;
    };

    const handleSubmit = async (
        event: FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        setSubmitError(null);

        if (!validate()) {
            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });
            return;
        }

        const payload = buildPayload();

        setIsSaving(true);

        try {
            if (isEditMode && vacancyId) {
                await jobVacanciesApi.update(
                    vacancyId,
                    payload,
                );
            } else {
                await jobVacanciesApi.create(payload);
            }

            setIsDirty(false);

            router.push(
                isEditMode
                    ? `/admin/job-vacancies/${vacancyId}`
                    : "/admin/job-vacancies",
            );

            router.refresh();
        } catch (error) {
            setSubmitError(
                getSaveErrorMessage(error),
            );

            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        if (
            isDirty &&
            !window.confirm(
                "You have unsaved changes. Are you sure you want to leave?",
            )
        ) {
            return;
        }

        router.back();
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="min-h-screen bg-gray-50 pb-28"
        >
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-gray-500 transition hover:text-gray-900"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Job Vacancies
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                                <BriefcaseBusiness className="h-5 w-5" />
                            </div>

                            <div>
                                <h1 className="text-xl font-bold tracking-tight text-gray-950 sm:text-2xl">
                                    {isEditMode
                                        ? "Edit Job Vacancy"
                                        : "Create Job Vacancy"}
                                </h1>

                                <p className="mt-1 text-sm text-gray-500">
                                    {isEditMode
                                        ? "Update the position details and recruitment requirements."
                                        : "Create a structured vacancy that candidates can discover and apply for."}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start">
                        <span
                            className={cn(
                                "rounded-full px-3 py-1.5 text-xs font-semibold",
                                isDirty
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-emerald-50 text-emerald-700",
                            )}
                        >
                            {isDirty
                                ? "Unsaved changes"
                                : "All changes saved"}
                        </span>
                    </div>
                </div>

                {submitError ? (
                    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
                        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />

                        <div>
                            <p className="text-sm font-semibold">
                                Unable to save vacancy
                            </p>
                            <p className="mt-1 text-xs leading-5 text-red-700">
                                {submitError}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setSubmitError(null)
                            }
                            className="ml-auto rounded-lg p-1 text-red-400 transition hover:bg-red-100 hover:text-red-700"
                            aria-label="Dismiss error"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-6">
                        {/* Position */}
                        <Card>
                            <CardHeader
                                icon={BriefcaseBusiness}
                                title="Position Details"
                                description="Define the position identity and how candidates will find it."
                            />

                            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                                <div className="sm:col-span-2">
                                    <Field
                                        label="Position title"
                                        required
                                        hint="Use a clear, candidate-facing title."
                                        error={errors.title}
                                    >
                                        <Input
                                            value={form.title}
                                            onChange={(event) =>
                                                updateTitle(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="e.g. Senior Backend Engineer"
                                            maxLength={150}
                                        />
                                    </Field>
                                </div>

                                <Field
                                    label="Job title"
                                    required
                                    hint="Internal role title."
                                    error={errors.jobTitle}
                                >
                                    <Input
                                        value={form.jobTitle}
                                        onChange={(event) =>
                                            updateField(
                                                "jobTitle",
                                                event.target.value,
                                            )
                                        }
                                        placeholder="e.g. Backend Engineer"
                                        maxLength={150}
                                    />
                                </Field>

                                <Field
                                    label="Department"
                                    required
                                    error={errors.department}
                                >
                                    <Input
                                        value={form.department}
                                        onChange={(event) =>
                                            updateField(
                                                "department",
                                                event.target.value,
                                            )
                                        }
                                        placeholder="e.g. Engineering"
                                        maxLength={100}
                                    />
                                </Field>

                                <div className="sm:col-span-2">
                                    <Field
                                        label="Public slug"
                                        required
                                        hint="Used in the public job URL."
                                        error={errors.slug}
                                    >
                                        <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-100">
                                            <span className="flex items-center border-r border-gray-100 bg-gray-50 px-3 text-xs text-gray-400">
                                                /jobs/
                                            </span>

                                            <input
                                                value={form.slug}
                                                onChange={(event) =>
                                                    updateSlug(
                                                        event.target.value,
                                                    )
                                                }
                                                className="h-11 min-w-0 flex-1 px-3.5 text-sm text-gray-900 outline-none"
                                                placeholder="senior-backend-engineer"
                                            />

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSlugManuallyEdited(
                                                        false,
                                                    );
                                                    setForm(
                                                        (current) => ({
                                                            ...current,
                                                            slug: normalizeSlug(
                                                                current.title,
                                                            ),
                                                        }),
                                                    );
                                                    setIsDirty(true);
                                                }}
                                                className="border-l border-gray-100 px-3 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                            >
                                                Regenerate
                                            </button>
                                        </div>
                                    </Field>
                                </div>

                                <div className="sm:col-span-2">
                                    <Field
                                        label="Description"
                                        required
                                        hint={`${form.description.length.toLocaleString()} / ${DESCRIPTION_MAX_LENGTH.toLocaleString()} characters`}
                                        error={errors.description}
                                    >
                                        <Textarea
                                            value={form.description}
                                            onChange={(event) =>
                                                updateField(
                                                    "description",
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Describe the role, team, expectations and what makes this opportunity valuable."
                                            maxLength={
                                                DESCRIPTION_MAX_LENGTH
                                            }
                                        />
                                    </Field>
                                </div>
                            </div>
                        </Card>

                        {/* Employment */}
                        <Card>
                            <CardHeader
                                icon={Users}
                                title="Employment & Location"
                                description="Specify the working arrangement and number of available positions."
                            />

                            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                                <Field label="Vacancy type" required>
                                    <Select
                                        value={form.vacancyType}
                                        onChange={(event) =>
                                            updateField(
                                                "vacancyType",
                                                event.target.value as CreateJobVacancyInput["vacancyType"],
                                            )
                                        }
                                    >
                                        <option value="GENERAL">General</option>
                                        <option value="RIDER">Rider</option>
                                    </Select>
                                </Field>

                                <Field
                                    label="Employment type"
                                    required
                                >
                                    <Select
                                        value={form.employmentType}
                                        onChange={(event) =>
                                            updateField(
                                                "employmentType",
                                                event.target
                                                    .value as CreateJobVacancyInput["employmentType"],
                                            )
                                        }
                                    >
                                        {Object.values(
                                            JOB_EMPLOYMENT_TYPES,
                                        ).map((type) => (
                                            <option
                                                key={type}
                                                value={type}
                                            >
                                                {formatEnum(type)}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>

                                <Field
                                    label="Openings"
                                    required
                                    error={errors.openings}
                                >
                                    <Input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={form.openings}
                                        onChange={(event) =>
                                            updateField(
                                                "openings",
                                                Math.max(
                                                    1,
                                                    Number(
                                                        event.target
                                                            .value,
                                                    ) || 1,
                                                ),
                                            )
                                        }
                                    />
                                </Field>

                                <div className="sm:col-span-2">
                                    <Toggle
                                        checked={form.isRemote}
                                        onChange={(value) => {
                                            updateField(
                                                "isRemote",
                                                value,
                                            );

                                            if (value) {
                                                updateField(
                                                    "location",
                                                    "",
                                                );
                                            }
                                        }}
                                        label="Remote position"
                                        description="Candidates can work remotely without a fixed physical location."
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <Field
                                        label="Location"
                                        required={!form.isRemote}
                                        hint={
                                            form.isRemote
                                                ? "Disabled for remote positions."
                                                : "Enter the primary workplace location."
                                        }
                                        error={errors.location}
                                    >
                                        <div className="relative">
                                            <MapPin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                                            <Input
                                                value={
                                                    form.location ?? ""
                                                }
                                                onChange={(event) =>
                                                    updateField(
                                                        "location",
                                                        event.target
                                                            .value,
                                                    )
                                                }
                                                disabled={
                                                    form.isRemote
                                                }
                                                className="pl-10"
                                                placeholder="e.g. Dhaka, Bangladesh"
                                            />
                                        </div>
                                    </Field>
                                </div>
                            </div>
                        </Card>

                        {/* Responsibilities */}
                        <Card>
                            <CardHeader
                                icon={Check}
                                title="Role Expectations"
                                description="Give candidates a clear picture of what they will do and what they need."
                            />

                            <div className="space-y-6 p-5 sm:p-6">
                                <TagInput
                                    label="Responsibilities"
                                    required
                                    values={
                                        form.responsibilities
                                    }
                                    onChange={(values) =>
                                        updateField(
                                            "responsibilities",
                                            values,
                                        )
                                    }
                                    placeholder="Type a responsibility and press Enter"
                                    hint="Add concrete day-to-day responsibilities."
                                    error={
                                        errors.responsibilities
                                    }
                                />

                                <TagInput
                                    label="Requirements"
                                    required
                                    values={form.requirements}
                                    onChange={(values) =>
                                        updateField(
                                            "requirements",
                                            values,
                                        )
                                    }
                                    placeholder="Type a requirement and press Enter"
                                    hint="Add experience, availability or other mandatory criteria."
                                    error={errors.requirements}
                                />

                                <TagInput
                                    label="Qualifications"
                                    values={
                                        form.qualifications ?? []
                                    }
                                    onChange={(values) =>
                                        updateField(
                                            "qualifications",
                                            values,
                                        )
                                    }
                                    placeholder="e.g. Bachelor's degree"
                                    hint="Optional educational or professional qualifications."
                                />

                                <TagInput
                                    label="Skills"
                                    values={form.skills ?? []}
                                    onChange={(values) =>
                                        updateField(
                                            "skills",
                                            values,
                                        )
                                    }
                                    placeholder="e.g. TypeScript"
                                    hint="Add technical or professional skills."
                                />
                            </div>
                        </Card>

                        {/* Compensation */}
                        <Card>
                            <CardHeader
                                icon={CircleDollarSign}
                                title="Compensation"
                                description="Configure how compensation should appear to candidates."
                            />

                            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                                <div className="sm:col-span-2">
                                    <Field
                                        label="Salary visibility"
                                        required
                                    >
                                        <Select
                                            value={
                                                form.salaryType
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                    "salaryType",
                                                    event.target
                                                        .value as CreateJobVacancyInput["salaryType"],
                                                )
                                            }
                                        >
                                            {Object.values(
                                                JOB_SALARY_TYPES,
                                            ).map((type) => (
                                                <option
                                                    key={type}
                                                    value={type}
                                                >
                                                    {formatEnum(
                                                        type,
                                                    )}
                                                </option>
                                            ))}
                                        </Select>
                                    </Field>
                                </div>

                                <Field
                                    label="Currency"
                                    required
                                >
                                    <Input
                                        value={
                                            form.salaryCurrency ??
                                            DEFAULT_CURRENCY
                                        }
                                        onChange={(event) =>
                                            updateField(
                                                "salaryCurrency",
                                                event.target.value
                                                    .toUpperCase()
                                                    .slice(0, 3),
                                            )
                                        }
                                        maxLength={3}
                                        placeholder="BDT"
                                    />
                                </Field>

                                {form.salaryType ===
                                    JOB_SALARY_TYPES.FIXED ||
                                form.salaryType ===
                                    JOB_SALARY_TYPES.RANGE ? (
                                    <Field
                                        label={
                                            form.salaryType ===
                                            JOB_SALARY_TYPES.RANGE
                                                ? "Minimum salary"
                                                : "Salary amount"
                                        }
                                        required
                                        error={
                                            errors.salaryMin
                                        }
                                    >
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={
                                                form.salaryMin ??
                                                ""
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                    "salaryMin",
                                                    event.target
                                                        .value ===
                                                        ""
                                                        ? undefined
                                                        : Number(
                                                              event
                                                                  .target
                                                                  .value,
                                                          ),
                                                )
                                            }
                                            placeholder="0"
                                        />
                                    </Field>
                                ) : null}

                                {form.salaryType ===
                                JOB_SALARY_TYPES.RANGE ? (
                                    <Field
                                        label="Maximum salary"
                                        required
                                        error={
                                            errors.salaryMax
                                        }
                                    >
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={
                                                form.salaryMax ??
                                                ""
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                    "salaryMax",
                                                    event.target
                                                        .value ===
                                                        ""
                                                        ? undefined
                                                        : Number(
                                                              event
                                                                  .target
                                                                  .value,
                                                          ),
                                                )
                                            }
                                            placeholder="0"
                                        />
                                    </Field>
                                ) : null}

                                <div className="sm:col-span-2">
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-start gap-3">
                                            <CircleDollarSign className="mt-0.5 h-4 w-4 text-slate-500" />

                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600">
                                                    Candidate preview
                                                </p>

                                                <p className="mt-1 text-sm font-semibold text-slate-900">
                                                    {salaryPreview}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* Application */}
                        <Card>
                            <CardHeader
                                icon={CalendarDays}
                                title="Application Settings"
                                description="Control when candidates can submit applications."
                            />

                            <div className="p-5 sm:p-6">
                                <Field
                                    label="Application deadline"
                                    hint="Leave empty if the vacancy should remain open until manually closed."
                                    error={
                                        errors.applicationDeadline
                                    }
                                >
                                    <div className="relative max-w-md">
                                        <CalendarDays className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                                        <Input
                                            type="date"
                                            value={
                                                form.applicationDeadline ??
                                                ""
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                    "applicationDeadline",
                                                    event.target
                                                        .value,
                                                )
                                            }
                                            className="pl-10"
                                        />
                                    </div>
                                </Field>
                            </div>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <aside className="space-y-6">
                        {/* Preview */}
                        <Card className="overflow-hidden">
                            <div className="border-b border-gray-100 bg-slate-950 px-5 py-4 text-white">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                            Live Preview
                                        </p>

                                        <p className="mt-1 text-sm font-semibold">
                                            Candidate view
                                        </p>
                                    </div>

                                    <ExternalLink className="h-4 w-4 text-slate-400" />
                                </div>
                            </div>

                            <div className="p-5">
                                <div className="mb-5">
                                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                        {formatEnum(
                                            form.employmentType,
                                        )}
                                    </span>

                                    <h3 className="mt-3 text-lg font-bold leading-7 text-gray-950">
                                        {form.title ||
                                            "Your job title"}
                                    </h3>

                                    <p className="mt-1 text-xs text-gray-500">
                                        {form.department ||
                                            "Department"}
                                    </p>
                                </div>

                                <div className="space-y-3 border-y border-gray-100 py-4">
                                    <div className="flex items-center gap-2.5 text-xs text-gray-600">
                                        <MapPin className="h-4 w-4 text-gray-400" />

                                        <span>
                                            {form.isRemote
                                                ? "Remote"
                                                : form.location ||
                                                  "Location not specified"}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2.5 text-xs text-gray-600">
                                        <Users className="h-4 w-4 text-gray-400" />

                                        <span>
                                            {form.openings}{" "}
                                            {form.openings === 1
                                                ? "opening"
                                                : "openings"}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2.5 text-xs text-gray-600">
                                        <CircleDollarSign className="h-4 w-4 text-gray-400" />

                                        <span>
                                            {salaryPreview}
                                        </span>
                                    </div>

                                    {form.applicationDeadline ? (
                                        <div className="flex items-center gap-2.5 text-xs text-gray-600">
                                            <CalendarDays className="h-4 w-4 text-gray-400" />

                                            <span>
                                                Apply by{" "}
                                                {
                                                    form.applicationDeadline
                                                }
                                            </span>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="mt-5">
                                    <p className="line-clamp-5 text-xs leading-5 text-gray-600">
                                        {form.description ||
                                            "Your candidate-facing job description will appear here."}
                                    </p>
                                </div>

                                <div className="mt-5 rounded-xl bg-gray-50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                                        Public URL
                                    </p>

                                    <p className="mt-1 break-all text-xs font-medium text-gray-700">
                                        {publicUrl}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        {/* Checklist */}
                        <Card>
                            <div className="border-b border-gray-100 px-5 py-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-900">
                                            Publishing checklist
                                        </h2>

                                        <p className="mt-1 text-xs text-gray-500">
                                            Complete the essentials before saving.
                                        </p>
                                    </div>

                                    <span className="text-xs font-bold text-gray-500">
                                        {completedChecklist}/
                                        {checklist.length}
                                    </span>
                                </div>

                                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100">
                                    <div
                                        className="h-full rounded-full bg-slate-900 transition-all"
                                        style={{
                                            width: `${(completedChecklist / checklist.length) * 100}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1 p-3">
                                {checklist.map((item) => (
                                    <div
                                        key={item.label}
                                        className="flex items-center gap-3 rounded-xl px-2.5 py-2.5"
                                    >
                                        <span
                                            className={cn(
                                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                                                item.complete
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-gray-100 text-gray-400",
                                            )}
                                        >
                                            {item.complete ? (
                                                <Check className="h-3.5 w-3.5" />
                                            ) : (
                                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                            )}
                                        </span>

                                        <span
                                            className={cn(
                                                "text-xs font-medium",
                                                item.complete
                                                    ? "text-gray-700"
                                                    : "text-gray-400",
                                            )}
                                        >
                                            {item.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Workflow tip */}
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                            <div className="flex items-start gap-3">
                                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />

                                <div>
                                    <p className="text-xs font-bold text-blue-900">
                                        Recruitment workflow
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-blue-700">
                                        Save the vacancy first. Publishing,
                                        pausing and closing are managed from
                                        the vacancy details/list workflow.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            {/* Sticky action bar */}
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
                    <div className="hidden min-w-0 sm:block">
                        <div className="flex items-center gap-2">
                            <span
                                className={cn(
                                    "h-2 w-2 rounded-full",
                                    isDirty
                                        ? "bg-amber-500"
                                        : "bg-emerald-500",
                                )}
                            />

                            <span className="truncate text-xs font-medium text-gray-500">
                                {isDirty
                                    ? "You have unsaved changes"
                                    : "Ready"}
                            </span>
                        </div>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isSaving}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <X className="h-4 w-4" />
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    {isEditMode
                                        ? "Save changes"
                                        : "Create draft"}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
}