"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import apiClient from "@/services/api/client";

type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface Announcement {
  _id: string;
  title: string;
  body: string;
  priority: Priority;
  publishedAt?: string;
  createdAt: string;
  attachments?: {
    name: string;
    url: string;
    mimeType: string;
    size: number;
  }[];
}

interface Recipient {
  _id: string;
  announcementId: Announcement | string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

interface NotificationResponse {
  recipients: Recipient[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function getError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: { data?: { message?: string } };
      }
    ).response;

    if (response?.data?.message) return response.data.message;
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function getPriorityStyle(priority: Priority): string {
  switch (priority) {
    case "URGENT":
      return "bg-red-100 text-red-700";
    case "HIGH":
      return "bg-orange-100 text-orange-700";
    case "LOW":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-blue-100 text-blue-700";
  }
}

function formatDate(value?: string): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString();
}

export default function RiderNotificationsPage() {
  const [notifications, setNotifications] = useState<Recipient[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState("");
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [listResponse, unreadResponse] = await Promise.all([
        apiClient.get("/communication/announcements/rider/mine", {
          params: {
            page,
            limit: 20,
            ...(filter === "UNREAD" ? { unreadOnly: true } : {}),
          },
        }),
        apiClient.get("/communication/announcements/rider/mine", {
          params: { page: 1, limit: 1, unreadOnly: true },
        }),
      ]);

      const data: NotificationResponse = listResponse.data.data;

      setNotifications(data.recipients ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(Math.max(1, data.totalPages ?? 1));
      setUnreadCount(unreadResponse.data.data?.total ?? 0);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const markAsRead = async (announcementId: string) => {
    if (!announcementId) return;

    setMarkingId(announcementId);

    try {
      await apiClient.patch(
        `/communication/announcements/rider/${encodeURIComponent(announcementId)}/read`,
      );
      await loadNotifications();
    } catch (err) {
      setError(getError(err));
    } finally {
      setMarkingId("");
    }
  };

  const changeFilter = (value: "ALL" | "UNREAD") => {
    setFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            View announcements and important updates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadNotifications()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Notifications</p>
              <p className="text-2xl font-bold text-slate-900">{total}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-3 text-amber-600">
              <CheckCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Unread Notifications</p>
              <p className="text-2xl font-bold text-slate-900">{unreadCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => changeFilter("ALL")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              filter === "ALL"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-600"
            }`}
          >
            All
          </button>

          <button
            type="button"
            onClick={() => changeFilter("UNREAD")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              filter === "UNREAD"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-600"
            }`}
          >
            Unread
          </button>
        </div>

        <p className="text-sm text-slate-500">{total} notifications</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <Bell className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 font-semibold text-slate-800">
            No notifications
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            You do not have any {filter === "UNREAD" ? "unread " : ""}
            notifications right now.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((recipient) => {
            const announcement =
              typeof recipient.announcementId === "object"
                ? recipient.announcementId
                : null;

            if (!announcement) return null;

            const unread = !recipient.readAt;

            return (
              <article
                key={recipient._id}
                className={`rounded-xl border bg-white p-5 ${
                  unread ? "border-blue-200" : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-900">
                        {announcement.title}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getPriorityStyle(
                          announcement.priority,
                        )}`}
                      >
                        {announcement.priority}
                      </span>
                      {unread && (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          Unread
                        </span>
                      )}
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {announcement.body}
                    </p>

                    <p className="mt-3 text-xs text-slate-400">
                      {formatDate(
                        announcement.publishedAt ??
                          recipient.deliveredAt ??
                          recipient.createdAt,
                      )}
                    </p>

                    {announcement.attachments?.length ? (
                      <div className="mt-3 space-y-1">
                        {announcement.attachments.map((attachment) => (
                          <a
                            key={attachment.url}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-sm font-medium text-blue-600 hover:underline"
                          >
                            {attachment.name}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {unread && (
                    <button
                      type="button"
                      onClick={() => void markAsRead(announcement._id)}
                      disabled={markingId === announcement._id}
                      className="shrink-0 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                    >
                      {markingId === announcement._id
                        ? "Saving..."
                        : "Mark as read"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
