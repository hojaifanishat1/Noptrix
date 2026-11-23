"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";

import {
  exportJobsApi,
  type ExportDataset,
  type ExportFormat,
  type ExportJob,
} from "@/services/api/export-jobs.api";

function formatBytes(value?: number): string {
  if (!value || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function Status({ status }: { status: ExportJob["status"] }) {
  const styles: Record<ExportJob["status"], string> = {
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    PROCESSING: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    FAILED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function ExportJobsWorkspace() {
  const [datasets, setDatasets] = useState<ExportDataset[]>([]);
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  const [dataset, setDataset] = useState("");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyJob, setBusyJob] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError("");

    try {
      const [catalog, history] = await Promise.all([
        exportJobsApi.getDatasets(),
        exportJobsApi.getJobs({ page, limit: 25, search }),
      ]);

      setDatasets(catalog);
      setJobs(history.items);
      setTotal(history.pagination.total);
      setTotalPages(Math.max(1, history.pagination.totalPages));

      setDataset((current) =>
        current && catalog.some((item) => item.key === current)
          ? current
          : catalog[0]?.key ?? "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load export jobs.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(false);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [load]);

  const createExport = async () => {
    if (!dataset) {
      setError("Select an export dataset.");
      return;
    }

    if (from && to && new Date(from) > new Date(to)) {
      setError("Start date cannot be later than end date.");
      return;
    }

    setCreating(true);
    setError("");
    setNotice("");

    try {
      await exportJobsApi.create({
        dataset,
        format,
        ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
        ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
      });

      setNotice("Export job queued successfully.");
      setPage(1);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create export.");
    } finally {
      setCreating(false);
    }
  };

  const retry = async (jobId: string) => {
    setBusyJob(jobId);
    setError("");
    setNotice("");

    try {
      await exportJobsApi.retry(jobId);
      setNotice("Export job queued for retry.");
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retry export.");
    } finally {
      setBusyJob("");
    }
  };

  const download = async (jobId: string) => {
    setBusyJob(jobId);
    setError("");

    try {
      const url = await exportJobsApi.getDownloadUrl(jobId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download export.");
    } finally {
      setBusyJob("");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Export Jobs
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create secure data exports and monitor background processing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {notice}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-gray-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Create new export
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">Dataset</span>
            <select
              value={dataset}
              onChange={(event) => setDataset(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              {datasets.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">File format</span>
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as ExportFormat)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="json">JSON (.json)</option>
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">From date</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">To date</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Maximum {(100000).toLocaleString()} records per export. Files expire after 24 hours.
          </p>

          <button
            type="button"
            onClick={() => void createExport()}
            disabled={creating || !dataset}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900"
          >
            {creating
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Plus className="h-4 w-4" />}
            {creating ? "Queueing..." : "Create Export"}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Export history
            </h2>
            <p className="text-sm text-gray-500">{total} total export jobs</p>
          </div>

          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Search dataset, file, job ID or status"
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 p-10 text-center dark:border-gray-800">
            <RefreshCw className="mx-auto h-7 w-7 animate-spin text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">Loading export history...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-950">
            <FileSpreadsheet className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">No export jobs found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900">
                <tr>
                  {["Dataset", "Format", "Status", "Progress", "Rows", "File size", "Created", "Expires", "Actions"].map((heading) => (
                    <th key={heading} className="whitespace-nowrap px-4 py-3 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {jobs.map((job) => (
                  <tr key={job.jobId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {datasets.find((item) => item.key === job.dataset)?.label ?? job.dataset}
                      </p>
                      <p className="max-w-[180px] truncate text-xs text-gray-400">{job.fileName ?? job.jobId}</p>
                    </td>
                    <td className="px-4 py-3 uppercase text-gray-600 dark:text-gray-300">{job.format}</td>
                    <td className="px-4 py-3"><Status status={job.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, job.progress ?? 0))}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-gray-500">{job.progress ?? 0}%</span>
                      </div>
                      {job.status === "FAILED" && job.errorMessage && (
                        <p className="mt-1 max-w-[180px] text-xs text-red-600">{job.errorMessage}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">{job.rowCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatBytes(job.fileSize)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatDate(job.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatDate(job.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {job.status === "COMPLETED" && job.downloadAvailable && (
                          <button
                            type="button"
                            onClick={() => void download(job.jobId)}
                            disabled={busyJob === job.jobId}
                            title="Download export"
                            className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                        {job.status === "FAILED" && (
                          <button
                            type="button"
                            onClick={() => void retry(job.jobId)}
                            disabled={busyJob === job.jobId}
                            title="Retry export"
                            className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-900"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        {busyJob === job.jobId && <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Clock className="h-3.5 w-3.5" />
        Status refreshes every 5 seconds. Download links are short-lived private URLs.
      </div>
    </div>
  );
}
