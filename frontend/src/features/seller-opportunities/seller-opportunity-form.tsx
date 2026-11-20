"use client";

import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";

import { sellerOpportunitiesApi } from "@/services/api/seller-opportunities.api";
import {
  SELLER_OPPORTUNITY_FIELD_TYPES,
  type CreateSellerOpportunityInput,
  type SellerOpportunity,
  type SellerOpportunityFormField,
  type SellerOpportunityDocumentRequirement,
} from "./seller-opportunity.types";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100";

const initialForm: CreateSellerOpportunityInput = {
  title: "",
  slug: "",
  summary: "",
  description: "",
  category: "",
  targetSellerCount: 1,
  eligibility: [],
  requiredDocuments: [],
  applicationForm: [],
  applicationDeadline: "",
  visibility: "PUBLIC",
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function errorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | {
          message?: unknown;
          errors?: Array<{
            field?: unknown;
            message?: unknown;
          }>;
        }
      | undefined;

    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      return data.errors
        .map((item) => {
          const field =
            typeof item.field === "string" ? item.field : "Field";

          const message =
            typeof item.message === "string"
              ? item.message
              : "Invalid value";

          return `${field}: ${message}`;
        })
        .join("\n");
    }

    if (
      typeof data?.message === "string" &&
      data.message.trim()
    ) {
      return data.message;
    }
  }

  return error instanceof Error
    ? error.message
    : "Unable to save opportunity.";
}

function TagEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (!value || values.length >= 50) return;
    if (!values.some((item) => item.toLowerCase() === value.toLowerCase())) {
      onChange([...values, value]);
    }
    setDraft("");
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700">{label}</label>
      <div className="rounded-xl border border-gray-200 p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {values.map((value, index) => (
            <span key={`${value}-${index}`} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700">
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                className="text-red-500"
                aria-label={`Remove ${value}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className="min-w-0 flex-1 px-1 py-2 text-sm outline-none"
          />
          <button type="button" onClick={add} className="rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="font-bold text-gray-900">{title}</h2>
        {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function makeInitialForm(opportunity?: SellerOpportunity): CreateSellerOpportunityInput {
  if (!opportunity) {
    return {
      ...initialForm,
      eligibility: [],
      requiredDocuments: [],
      applicationForm: [],
    };
  }

  return {
    title: opportunity.title,
    slug: opportunity.slug,
    summary: opportunity.summary,
    description: opportunity.description,
    category: opportunity.category,
    targetSellerCount: opportunity.targetSellerCount,
    eligibility: [...(opportunity.eligibility ?? [])],
    requiredDocuments: (opportunity.requiredDocuments ?? []).map((item) => ({
      ...item,
      acceptedMimeTypes: [...(item.acceptedMimeTypes ?? [])],
    })),
    applicationForm: (opportunity.applicationForm ?? []).map((item) => ({
      ...item,
      options: item.options ? [...item.options] : undefined,
    })),
    applicationDeadline: opportunity.applicationDeadline
      ? new Date(opportunity.applicationDeadline).toISOString().slice(0, 10)
      : "",
    visibility: opportunity.visibility,
  };
}

export default function SellerOpportunityForm({
  opportunity,
}: {
  opportunity?: SellerOpportunity;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CreateSellerOpportunityInput>(() => makeInitialForm(opportunity));
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(opportunity?.slug));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = <K extends keyof CreateSellerOpportunityInput>(
    key: K,
    value: CreateSellerOpportunityInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const addQuestion = () => {
    if (form.applicationForm.length >= 100) return;
    const field: SellerOpportunityFormField = {
      key: `question_${Date.now()}`,
      label: "",
      type: "TEXT",
      required: false,
      placeholder: "",
    };
    update("applicationForm", [...form.applicationForm, field]);
  };

  const updateQuestion = (
    index: number,
    patch: Partial<SellerOpportunityFormField>,
  ) => {
    update(
      "applicationForm",
      form.applicationForm.map((field, i) => i === index ? { ...field, ...patch } : field),
    );
  };

  const addDocument = () => {
    if (form.requiredDocuments.length >= 30) return;
    const item: SellerOpportunityDocumentRequirement = {
      key: `document_${Date.now()}`,
      label: "",
      required: true,
      acceptedMimeTypes: ["application/pdf"],
      maxSizeMB: 10,
    };
    update("requiredDocuments", [...form.requiredDocuments, item]);
  };

  const updateDocument = (
    index: number,
    patch: Partial<SellerOpportunityDocumentRequirement>,
  ) => {
    update(
      "requiredDocuments",
      form.requiredDocuments.map((item, i) => i === index ? { ...item, ...patch } : item),
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (form.eligibility.length === 0) {
      setError("Add at least one eligibility requirement.");
      return;
    }

    if (form.applicationForm.some((field) => !field.key.trim() || !field.label.trim())) {
      setError("Every application question needs a key and label.");
      return;
    }

    if (form.requiredDocuments.some((item) => !item.key.trim() || !item.label.trim())) {
      setError("Every document requirement needs a key and label.");
      return;
    }

    if (form.applicationForm.some((field) =>
      (field.type === "SELECT" || field.type === "MULTI_SELECT") &&
      (!field.options || field.options.length === 0)
    )) {
      setError("Select and Multi-select questions must have at least one option.");
      return;
    }

    const payload: CreateSellerOpportunityInput = {
      ...form,
      title: form.title.trim(),
      slug: form.slug?.trim() || undefined,
      summary: form.summary.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      targetSellerCount: Number(form.targetSellerCount),
      applicationDeadline: form.applicationDeadline || undefined,
    };

    setSaving(true);
    try {
      if (opportunity) {
        await sellerOpportunitiesApi.update(opportunity._id, payload);
        router.push(`/admin/seller-opportunities/${opportunity._id}`);
      } else {
        const created = await sellerOpportunitiesApi.create(payload);
        router.push(`/admin/seller-opportunities/${created._id}`);
      }
      router.refresh();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving..." : opportunity ? "Save Changes" : "Create Opportunity"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <Section title="Opportunity Information" description="The public-facing information for this seller recruitment campaign.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Opportunity title" required>
            <input
              required minLength={3} maxLength={200}
              value={form.title}
              onChange={(event) => {
                const title = event.target.value;
                setForm((current) => ({
                  ...current,
                  title,
                  slug: slugManuallyEdited ? current.slug : slugify(title),
                }));
              }}
              className={inputClass}
              placeholder="e.g. Electronics Sellers Recruitment"
            />
          </Field>
          <Field label="URL slug">
            <input
              value={form.slug}
              minLength={3}
              maxLength={220}
              onChange={(event) => {
                setSlugManuallyEdited(true);
                update("slug", slugify(event.target.value));
              }}
              className={inputClass}
              placeholder="electronics-sellers"
            />
          </Field>
          <Field label="Category" required>
            <input required minLength={2} maxLength={100} value={form.category} onChange={(e) => update("category", e.target.value)} className={inputClass} placeholder="Electronics" />
          </Field>
          <Field label="Target seller count" required>
            <input required type="number" min={1} max={100000} value={form.targetSellerCount} onChange={(e) => update("targetSellerCount", Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Application deadline">
            <input type="date" value={form.applicationDeadline ?? ""} onChange={(e) => update("applicationDeadline", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Visibility" required>
            <select value={form.visibility} onChange={(e) => update("visibility", e.target.value as "PUBLIC" | "PRIVATE")} className={inputClass}>
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </Field>
        </div>
        <Field label="Short summary" required>
          <textarea required minLength={10} maxLength={500} rows={3} value={form.summary} onChange={(e) => update("summary", e.target.value)} className={inputClass} placeholder="A short description shown on the public opportunity listing." />
        </Field>
        <Field label="Full description" required>
          <textarea required minLength={20} maxLength={15000} rows={8} value={form.description} onChange={(e) => update("description", e.target.value)} className={inputClass} placeholder="Explain the opportunity, benefits, expectations and application process." />
        </Field>
        <TagEditor label="Eligibility requirements" values={form.eligibility} onChange={(values) => update("eligibility", values)} placeholder="Add eligibility requirement and press Enter" />
      </Section>

      <Section title="Required Documents" description="Specify the documents applicants must submit. MIME types must match the backend validator.">
        {form.requiredDocuments.map((item, index) => (
          <div key={item.key} className="rounded-xl border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">Document {index + 1}</p>
              <button type="button" onClick={() => update("requiredDocuments", form.requiredDocuments.filter((_, i) => i !== index))} className="text-red-500" aria-label="Remove document">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Document key">
                <input value={item.key} onChange={(e) => updateDocument(index, { key: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Document label">
                <input value={item.label} onChange={(e) => updateDocument(index, { label: e.target.value })} className={inputClass} placeholder="Business registration certificate" />
              </Field>
              <Field label="Accepted MIME types (comma separated)">
                <input value={item.acceptedMimeTypes.join(", ")} onChange={(e) => updateDocument(index, { acceptedMimeTypes: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} className={inputClass} placeholder="application/pdf, image/jpeg" />
              </Field>
              <Field label="Maximum size (MB)">
                <input type="number" min={1} max={100} value={item.maxSizeMB} onChange={(e) => updateDocument(index, { maxSizeMB: Number(e.target.value) })} className={inputClass} />
              </Field>
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={item.required} onChange={(e) => updateDocument(index, { required: e.target.checked })} />
              Required document
            </label>
          </div>
        ))}
        <button type="button" onClick={addDocument} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <Plus className="h-4 w-4" /> Add document requirement
        </button>
      </Section>

      <Section title="Dynamic Application Form" description="Questions shown to applicants when they apply for this opportunity.">
        {form.applicationForm.map((field, index) => (
          <div key={`${field.key}-${index}`} className="rounded-xl border border-gray-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">Question {index + 1}</p>
              <button type="button" onClick={() => update("applicationForm", form.applicationForm.filter((_, i) => i !== index))} className="text-red-500" aria-label="Remove question">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Field key">
                <input value={field.key} onChange={(e) => updateQuestion(index, { key: slugify(e.target.value).replace(/-/g, "_") })} className={inputClass} placeholder="monthly_sales" />
              </Field>
              <Field label="Question label">
                <input value={field.label} onChange={(e) => updateQuestion(index, { label: e.target.value })} className={inputClass} placeholder="What are your average monthly sales?" />
              </Field>
              <Field label="Field type">
                <select value={field.type} onChange={(e) => updateQuestion(index, { type: e.target.value as SellerOpportunityFormField["type"], options: ["SELECT", "MULTI_SELECT"].includes(e.target.value) ? (field.options?.length ? field.options : ["Option 1"]) : undefined })} className={inputClass}>
                  {SELLER_OPPORTUNITY_FIELD_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Placeholder">
                <input value={field.placeholder ?? ""} onChange={(e) => updateQuestion(index, { placeholder: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Maximum length">
                <input type="number" min={1} max={10000} value={field.maxLength ?? ""} onChange={(e) => updateQuestion(index, { maxLength: e.target.value ? Number(e.target.value) : undefined })} className={inputClass} />
              </Field>
            </div>
            {(field.type === "SELECT" || field.type === "MULTI_SELECT") && (
              <div className="mt-3">
                <TagEditor label="Options" values={field.options ?? []} onChange={(options) => updateQuestion(index, { options })} placeholder="Add option and press Enter" />
              </div>
            )}
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={field.required} onChange={(e) => updateQuestion(index, { required: e.target.checked })} />
              Required answer
            </label>
          </div>
        ))}
        <button type="button" onClick={addQuestion} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <Plus className="h-4 w-4" /> Add application question
        </button>
      </Section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700">Cancel</button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? "Saving..." : opportunity ? "Save Changes" : "Create Draft"}
        </button>
      </div>
    </form>
  );
}
