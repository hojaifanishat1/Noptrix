"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  ArchiveX,
  ChevronRight,
  FileText,
  Inbox,
  Mail,
  MailOpen,
  Paperclip,
  Plus,
  Reply,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from "lucide-react";

import { AdminAuthGuard } from "@/components/common/AdminAuthGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { communicationApi } from "@/services/api/communication.api";
import { useAuthStore } from "@/stores/auth.store";
import {
  MESSAGE_PRIORITIES,
  MESSAGE_STATUSES,
  type InternalMessage,
  type MessageListQuery,
  type MessagePriority,
  type MessageRecipient,
  type MessageRecipientType,
  type MessageStatus,
} from "@/features/communication/message.types";

const PAGE_SIZE = 20;

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = error.response;
    if (
      typeof response === "object" &&
      response !== null &&
      "data" in response
    ) {
      const data = response.data;
      if (
        typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
      ) {
        return data.message;
      }
    }
  }

  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

export function MessageMailbox({
  recipientTypeFilter,
}: {
  recipientTypeFilter?: MessageRecipientType;
} = {}) {
  const userId = useAuthStore((state) => state.user?.id);
  const [folder, setFolder] = useState<
    "inbox" | "unread" | "archived" | "trash"
  >("inbox");
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [previewThread, setPreviewThread] = useState<InternalMessage[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMessageId, setPreviewMessageId] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | MessageStatus>("");
  const [priority, setPriority] = useState<"" | MessagePriority>("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [selectedRecipient, setSelectedRecipient] =
    useState<MessageRecipient | null>(null);
  const [replyTo, setReplyTo] = useState<{
    userId: string;
    name: string;
    role?: string;
    messageId: string;
  } | null>(null);
  const [recipients, setRecipients] = useState<MessageRecipient[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientType, setRecipientType] = useState<"" | MessageRecipientType>(
    recipientTypeFilter ?? "",
  );
  const effectiveRecipientType = recipientTypeFilter ?? recipientType;
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsError, setRecipientsError] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [composePriority, setComposePriority] =
    useState<MessagePriority>("NORMAL");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const conversations = [
    ...new Map(
      messages.map((message) => [message.threadId ?? message._id, message]),
    ).values(),
  ];

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params: MessageListQuery = { page, limit: PAGE_SIZE };
      if (recipientTypeFilter === "RIDER") {
        params.participantType = "RIDER";
      }
      if (search) params.search = search;
      if (status) params.status = status;
      else if (folder === "archived") params.status = "ARCHIVED";
      else if (folder === "trash") params.status = "DELETED";
      if (priority) params.priority = priority;
      if (unreadOnly || folder === "unread") params.unreadOnly = true;
      if (fromDate)
        params.fromDate = new Date(`${fromDate}T00:00:00`).toISOString();
      if (toDate)
        params.toDate = new Date(`${toDate}T23:59:59.999`).toISOString();
      params.sort = sort;

      const result = await communicationApi.getInbox(params);
      setMessages(result.messages);
      setSelectedIds([]);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to load messages."));
    } finally {
      setLoading(false);
    }
  }, [
    fromDate,
    folder,
    page,
    priority,
    search,
    sort,
    status,
    toDate,
    unreadOnly,
    recipientTypeFilter,
  ]);

  useEffect(() => {
    void Promise.resolve().then(loadMessages);
  }, [loadMessages]);

  const refreshUnreadCount = useCallback(async () => {
    try {
      setUnreadCount(await communicationApi.getUnreadCount());
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to load unread count."));
    }
  }, []);

  const openPreview = async (message: InternalMessage) => {
    setPreviewMessageId(message._id);
    setPreviewLoading(true);
    setError("");
    try {
      const thread = await communicationApi.getThread(message._id);
      setPreviewThread(thread);
      const readMessageIds = new Set(
        thread
          .filter((entry) => entry.recipientId === userId)
          .map((entry) => entry._id),
      );
      setMessages((current) =>
        current.map((entry) =>
          readMessageIds.has(entry._id) && entry.status === "SENT"
            ? { ...entry, status: "READ" }
            : entry,
        ),
      );
      await refreshUnreadCount();
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to open this conversation."));
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refreshUnreadCount(), 0);
    const timer = window.setInterval(() => void refreshUnreadCount(), 30_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!showCompose || replyTo) return;

    let active = true;
    const timer = window.setTimeout(() => {
      setRecipientsLoading(true);
      setRecipientsError("");
      void communicationApi
        .getRecipients({
          page: 1,
          limit: 100,
          ...(recipientSearch.trim() ? { search: recipientSearch.trim() } : {}),
          ...(effectiveRecipientType
            ? { accountType: effectiveRecipientType }
            : {}),
        })
        .then((result) => {
          if (active) setRecipients(result.recipients);
        })
        .catch((requestError: unknown) => {
          if (active) {
            setRecipientsError(
              errorMessage(requestError, "Unable to load recipients."),
            );
          }
        })
        .finally(() => {
          if (active) setRecipientsLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [recipientSearch, effectiveRecipientType, replyTo, showCompose]);

  const submitCompose = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError("");
    setNotice("");

    const recipientId = replyTo?.userId ?? selectedRecipient?.userId;
    if (!recipientId) {
      setError("Choose a recipient from the account list.");
      setSending(false);
      return;
    }

    try {
      const attachments = selectedFiles.length
        ? await communicationApi.uploadAttachments(selectedFiles)
        : [];
      if (replyTo) {
        await communicationApi.reply(replyTo.messageId, {
          body: body.trim(),
          ...(attachments.length ? { attachments } : {}),
        });
        setPreviewThread(await communicationApi.getThread(replyTo.messageId));
      } else {
        await communicationApi.create({
          recipientId,
          subject: subject.trim(),
          body: body.trim(),
          priority: composePriority,
          ...(attachments.length ? { attachments } : {}),
        });
      }
      setSelectedRecipient(null);
      setReplyTo(null);
      setSubject("");
      setBody("");
      setSelectedFiles([]);
      setComposePriority("NORMAL");
      setShowCompose(false);
      setNotice("Message sent successfully.");
      await loadMessages();
      await refreshUnreadCount();
    } catch (requestError) {
      setError(errorMessage(requestError, "Unable to send the message."));
    } finally {
      setSending(false);
    }
  };

  const performAction = async (
    message: InternalMessage,
    action: "archive" | "delete",
  ) => {
    const verb = action === "archive" ? "archive" : "delete";
    if (!window.confirm(`Are you sure you want to ${verb} this message?`))
      return;

    setActionId(message._id);
    setError("");
    setNotice("");
    try {
      if (action === "archive") {
        await communicationApi.archive(message._id);
        setNotice("Message archived.");
      } else {
        await communicationApi.remove(message._id);
        setNotice("Message deleted.");
      }
      await loadMessages();
    } catch (requestError) {
      setError(errorMessage(requestError, `Unable to ${verb} the message.`));
    } finally {
      setActionId("");
    }
  };

  const performBulkAction = async (
    action: "read" | "unread" | "archive" | "delete",
  ) => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    setError("");
    setNotice("");
    try {
      const count = await communicationApi.bulkAction(selectedIds, action);
      setSelectedIds([]);
      setNotice(`${count} message${count === 1 ? "" : "s"} updated.`);
      await Promise.all([loadMessages(), refreshUnreadCount()]);
    } catch (requestError) {
      setError(
        errorMessage(requestError, "Unable to update selected messages."),
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const startReply = (message: InternalMessage) => {
    const recipientIsCurrentUser = message.recipientId === userId;
    setReplyTo({
      userId: recipientIsCurrentUser ? message.senderId : message.recipientId,
      name: recipientIsCurrentUser ? message.senderName : message.recipientName,
      role: recipientIsCurrentUser ? message.senderRole : message.recipientRole,
      messageId: message.threadId ?? message._id,
    });
    setSelectedRecipient(null);
    setSelectedFiles([]);
    setSubject(
      /^re\s*:/i.test(message.subject)
        ? message.subject.slice(0, 250)
        : `Re: ${message.subject}`.slice(0, 250),
    );
    setBody("");
    setShowCompose(true);
    setError("");
    setNotice("");
  };

  const resetCompose = () => {
    setShowCompose(false);
    setSelectedRecipient(null);
    setReplyTo(null);
    setSubject("");
    setBody("");
    setSelectedFiles([]);
    setComposePriority("NORMAL");
  };

  return (
    <AdminAuthGuard>
      <main className="mx-auto w-full max-w-[1600px] space-y-4 p-2 md:p-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {recipientTypeFilter === "RIDER" ? "Rider Messages" : "Messages"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {recipientTypeFilter === "RIDER"
                  ? "Manage conversations and replies with riders."
                  : "One mailbox for your inbox, sent conversations, and replies."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                if (showCompose) {
                  resetCompose();
                } else {
                  setReplyTo(null);
                  setSelectedRecipient(null);
                  setSubject("");
                  setBody("");
                  setComposePriority("NORMAL");
                  setShowCompose(true);
                }
              }}
            >
              <Plus className="h-4 w-4" /> New message
            </Button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700"
          >
            {notice}
          </div>
        )}

        {showCompose && !replyTo && (
          <Card>
            <CardHeader>
              <CardTitle>Compose internal message</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitCompose} className="space-y-4">
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                    <div>
                      <label
                        htmlFor="recipientSearch"
                        className="mb-1 block text-sm font-medium"
                      >
                        Search accounts
                      </label>
                      <Input
                        id="recipientSearch"
                        value={recipientSearch}
                        onChange={(event) =>
                          setRecipientSearch(event.target.value)
                        }
                        placeholder="Name, email, or phone"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="recipientType"
                        className="mb-1 block text-sm font-medium"
                      >
                        Account type
                      </label>
                      <Select
                        id="recipientType"
                        value={effectiveRecipientType}
                        disabled={Boolean(recipientTypeFilter)}
                        onChange={(event) =>
                          setRecipientType(
                            event.target.value as "" | MessageRecipientType,
                          )
                        }
                      >
                        <option value="">All account types</option>
                        <option value="OWNER">Owner</option>
                        <option value="EMPLOYEE">Employees</option>
                        <option value="SELLER">Sellers</option>
                        <option value="RIDER">Riders</option>
                        <option value="ADMIN">Admins</option>
                      </Select>
                    </div>
                  </div>
                  <label
                    htmlFor="recipientId"
                    className="mb-1 block text-sm font-medium"
                  >
                    Select recipient
                  </label>
                  <Select
                    id="recipientId"
                    value={selectedRecipient?.userId ?? ""}
                    onChange={(event) => {
                      const recipient = recipients.find(
                        (item) => item.userId === event.target.value,
                      );
                      setSelectedRecipient(recipient ?? null);
                    }}
                    required
                  >
                    <option value="">
                      {recipientsLoading
                        ? "Loading accounts..."
                        : "Choose an account"}
                    </option>
                    {selectedRecipient &&
                      !recipients.some(
                        (item) => item.userId === selectedRecipient.userId,
                      ) && (
                        <option value={selectedRecipient.userId}>
                          {selectedRecipient.profileName ||
                            selectedRecipient.name}{" "}
                          ({selectedRecipient.accountType})
                        </option>
                      )}
                    {recipients.map((recipient) => (
                      <option key={recipient.userId} value={recipient.userId}>
                        {recipient.profileName || recipient.name} ·{" "}
                        {recipient.accountType}
                        {recipient.email ? ` · ${recipient.email}` : ""}
                      </option>
                    ))}
                  </Select>
                  {selectedRecipient && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {selectedRecipient.name}
                      {selectedRecipient.email
                        ? ` · ${selectedRecipient.email}`
                        : ""}
                    </p>
                  )}
                  {recipientsError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {recipientsError}
                    </p>
                  ) : !recipientsLoading && recipients.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No eligible accounts found. Try another name or account
                      type.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Active team and marketplace accounts are listed here.
                    </p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                  <div>
                    <label
                      htmlFor="messageSubject"
                      className="mb-1 block text-sm font-medium"
                    >
                      Subject
                    </label>
                    <Input
                      id="messageSubject"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      required
                      maxLength={250}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="messagePriority"
                      className="mb-1 block text-sm font-medium"
                    >
                      Priority
                    </label>
                    <Select
                      id="messagePriority"
                      value={composePriority}
                      onChange={(event) =>
                        setComposePriority(
                          event.target.value as MessagePriority,
                        )
                      }
                    >
                      {MESSAGE_PRIORITIES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="messageBody"
                    className="mb-1 block text-sm font-medium"
                  >
                    Message
                  </label>
                  <Textarea
                    id="messageBody"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    required
                    maxLength={10000}
                    rows={5}
                  />
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {body.length}/10000
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="messageAttachments"
                    className="mb-1 block text-sm font-medium"
                  >
                    Attachments
                  </label>
                  <Input
                    id="messageAttachments"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      if (
                        files.length > 10 ||
                        files.some((file) => file.size > 10 * 1024 * 1024)
                      ) {
                        setError(
                          "Choose up to 10 files, each no larger than 10 MB.",
                        );
                        event.target.value = "";
                        return;
                      }
                      setError("");
                      setSelectedFiles(files);
                    }}
                  />
                  {selectedFiles.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedFiles.map((file) => file.name).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetCompose}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={sending}>
                    <Send className="h-4 w-4" /> Send message
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>
                All Mail
                {` (${total})`}
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 align-middle text-xs font-medium text-primary">
                  <MailOpen className="h-3 w-3" /> {unreadCount} unread
                </span>
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadMessages()}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />{" "}
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px_170px_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                setPage(1);
                setSearch(searchInput.trim());
              }}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search subject or message"
                  aria-label="Search messages"
                />
              </div>
              <Select
                aria-label="Filter by status"
                value={status}
                onChange={(event) => {
                  setPage(1);
                  setStatus(event.target.value as "" | MessageStatus);
                }}
              >
                <option value="">Default folder</option>
                {MESSAGE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Filter by priority"
                value={priority}
                onChange={(event) => {
                  setPage(1);
                  setPriority(event.target.value as "" | MessagePriority);
                }}
              >
                <option value="">All priorities</option>
                {MESSAGE_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="outline">
                <Search className="h-4 w-4" /> Search
              </Button>
            </form>

            <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(event) => {
                    setPage(1);
                    setUnreadOnly(event.target.checked);
                  }}
                />
                Unread only
              </label>
              <label className="flex items-center gap-2 text-sm">
                From
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(event) => {
                    setPage(1);
                    setFromDate(event.target.value);
                  }}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                To
                <Input
                  type="date"
                  value={toDate}
                  onChange={(event) => {
                    setPage(1);
                    setToDate(event.target.value);
                  }}
                />
              </label>
              <Select
                aria-label="Sort messages"
                value={sort}
                onChange={(event) => {
                  setPage(1);
                  setSort(event.target.value as "newest" | "oldest");
                }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </Select>
            </div>

            <div className="grid gap-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-[190px_minmax(0,1fr)]">
              <nav
                aria-label="Message folders"
                className="space-y-1 border-b border-border bg-muted/20 p-3 lg:border-b-0 lg:border-r lg:p-4"
              >
                {(
                  [
                    ["inbox", "All Mail", Inbox, undefined],
                    ["unread", "Unread", MailOpen, unreadCount],
                    ["archived", "Archived", Archive, undefined],
                    ["trash", "Trash", Trash2, undefined],
                  ] as const
                ).map(([key, label, Icon, count]) => {
                  const active = folder === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => {
                        setFolder(key);
                        setStatus("");
                        setUnreadOnly(false);
                        setPage(1);
                        setPreviewMessageId("");
                        setPreviewThread([]);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                        active
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{label}</span>
                      {count !== undefined && count > 0 && (
                        <span className="text-xs">{count}</span>
                      )}
                    </button>
                  );
                })}
              </nav>
              <div className="min-w-0">
                {loading && messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Loading messages...
                  </p>
                ) : messages.length === 0 ? (
                  <div className="py-10 text-center">
                    <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">
                      {error
                        ? "Messages could not be loaded."
                        : `No messages in ${folder === "trash" ? "Trash" : folder === "archived" ? "Archive" : folder === "unread" ? "Unread" : "All Mail"}.`}
                    </p>
                  </div>
                ) : (
                  <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.1fr)]">
                    <div className="min-w-0 space-y-0 border-border xl:border-r">
                      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 p-3">
                        <label className="mr-auto flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={
                              conversations.length > 0 &&
                              conversations.every((message) =>
                                selectedIds.includes(message._id),
                              )
                            }
                            onChange={(event) =>
                              setSelectedIds(
                                event.target.checked
                                  ? conversations.map((message) => message._id)
                                  : [],
                              )
                            }
                          />
                          Select page
                        </label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!selectedIds.length || bulkLoading}
                          onClick={() => void performBulkAction("read")}
                        >
                          Mark read
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!selectedIds.length || bulkLoading}
                          onClick={() => void performBulkAction("unread")}
                        >
                          Mark unread
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!selectedIds.length || bulkLoading}
                          onClick={() => void performBulkAction("archive")}
                        >
                          Archive
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          disabled={!selectedIds.length || bulkLoading}
                          onClick={() => void performBulkAction("delete")}
                        >
                          Delete
                        </Button>
                      </div>
                      {conversations.map((message) => (
                        <article
                          key={message._id}
                          className={`border-b border-border transition-colors ${
                            previewMessageId === message._id
                              ? "border-l-4 border-l-primary bg-primary/10"
                              : message.recipientId === userId &&
                                  message.status === "SENT"
                                ? "border-l-4 border-l-primary/50 bg-primary/[0.04]"
                                : "border-l-4 border-l-transparent hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center gap-2 px-3 py-4 hover:bg-muted/30">
                            <input
                              type="checkbox"
                              aria-label={`Select ${message.subject}`}
                              checked={selectedIds.includes(message._id)}
                              onChange={(event) =>
                                setSelectedIds((ids) =>
                                  event.target.checked
                                    ? [...ids, message._id]
                                    : ids.filter((id) => id !== message._id),
                                )
                              }
                            />
                            <button
                              type="button"
                              onClick={() => void openPreview(message)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className={`min-w-0 break-words text-sm ${
                                    message.recipientId === userId &&
                                    message.status === "SENT"
                                      ? "font-bold text-foreground"
                                      : "font-medium"
                                  }`}
                                >
                                  {message.recipientId === userId
                                    ? message.senderName
                                    : message.recipientName}
                                </span>
                                {(message.recipientId === userId
                                  ? message.senderRole
                                  : message.recipientRole) && (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    (
                                    {message.recipientId === userId
                                      ? message.senderRole
                                      : message.recipientRole}
                                    )
                                  </span>
                                )}
                                {message.attachments &&
                                  message.attachments.length > 0 && (
                                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  )}
                              </span>
                              <span className="mt-1 flex min-w-0 items-center gap-2">
                                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                                  {message.subject}
                                </span>
                                <span className="min-w-0 truncate text-xs text-muted-foreground">
                                  {message.body}
                                </span>
                              </span>
                              <span className="mt-1 block text-right text-[11px] text-muted-foreground">
                                {formatDate(message.createdAt)}
                              </span>
                            </button>
                            <Badge
                              variant={
                                message.recipientId === userId &&
                                message.status === "SENT"
                                  ? "info"
                                  : message.status === "READ"
                                    ? "success"
                                    : "default"
                              }
                            >
                              {message.recipientId !== userId
                                ? message.status === "READ"
                                  ? "Read"
                                  : "Sent"
                                : message.status}
                            </Badge>
                            <Link
                              aria-label="Open conversation"
                              href={`/admin/communication/inbox/${encodeURIComponent(message._id)}`}
                              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                            {folder !== "trash" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={actionId === message._id}
                                aria-label="Archive conversation"
                                onClick={() =>
                                  void performAction(message, "archive")
                                }
                              >
                                <ArchiveX className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={actionId === message._id}
                              aria-label="Move conversation to trash"
                              onClick={() =>
                                void performAction(message, "delete")
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                    <aside className="flex min-h-[520px] flex-col overflow-hidden bg-muted/10">
                      {previewLoading ? (
                        <p className="p-8 text-center text-sm text-muted-foreground">
                          Loading conversation...
                        </p>
                      ) : previewThread.length > 0 ? (
                        <div className="flex h-full flex-col">
                          <div className="border-b border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h2 className="font-semibold">
                                  {previewThread[0]?.subject}
                                </h2>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {previewThread.length} message
                                  {previewThread.length === 1 ? "" : "s"} · All
                                  Mail
                                </p>
                              </div>
                              <Link
                                href={`/admin/communication/inbox/${encodeURIComponent(previewMessageId)}`}
                                className="text-sm text-primary hover:underline"
                              >
                                Open
                              </Link>
                            </div>
                          </div>
                          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] [background-size:22px_22px] p-4 md:p-6">
                            {previewThread.map((entry) => (
                              <article
                                key={entry._id}
                                className="max-w-[88%] rounded-2xl border border-border bg-card p-3 shadow-sm"
                              >
                                <div className="flex justify-between gap-2 text-xs">
                                  <span className="font-semibold">
                                    {entry.senderName}
                                  </span>
                                  {entry.senderRole && (
                                    <span className="text-muted-foreground">
                                      · {entry.senderRole}
                                    </span>
                                  )}
                                  <span className="text-muted-foreground">
                                    {formatDate(entry.createdAt)}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  To {entry.recipientName}
                                  {entry.recipientRole
                                    ? ` · ${entry.recipientRole}`
                                    : ""}
                                </p>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                                  {entry.body}
                                </p>
                                {entry.attachments &&
                                  entry.attachments.length > 0 && (
                                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                      <Paperclip className="h-3.5 w-3.5" />
                                      {entry.attachments.length} attachment
                                      {entry.attachments.length === 1
                                        ? ""
                                        : "s"}
                                    </div>
                                  )}
                              </article>
                            ))}
                          </div>
                          <div className="flex justify-end border-t border-border bg-card p-3">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                const latest = previewThread.at(-1);
                                if (latest) startReply(latest);
                              }}
                            >
                              <Reply className="h-4 w-4" /> Reply
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
                          <FileText className="mb-3 h-8 w-8" />
                          Select a message to preview the conversation.
                        </div>
                      )}
                    </aside>
                  </div>
                )}
              </div>
            </div>

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        {showCompose && replyTo && (
          <Card>
            <CardHeader>
              <CardTitle>
                Reply to {replyTo.name}
                {replyTo.role ? ` · ${replyTo.role}` : ""}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Your reply will be added to this conversation.
              </p>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={submitCompose}
                className="overflow-hidden rounded-xl border border-border"
              >
                <div className="divide-y divide-border px-4">
                  <div className="flex gap-3 py-3 text-sm">
                    <span className="w-16 shrink-0 text-muted-foreground">
                      To
                    </span>
                    <span className="font-medium">
                      {replyTo.name}
                      {replyTo.role ? ` · ${replyTo.role}` : ""}
                    </span>
                  </div>
                  <div className="flex gap-3 py-3 text-sm">
                    <span className="w-16 shrink-0 text-muted-foreground">
                      Subject
                    </span>
                    <span className="font-medium">{subject}</span>
                  </div>
                </div>
                <div className="border-t border-border px-4 py-3">
                  <Textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    required
                    maxLength={10000}
                    rows={6}
                    aria-label="Reply message"
                    placeholder="Write your reply..."
                    className="min-h-36 resize-y border-0 px-0 shadow-none focus:border-0 focus:ring-0"
                  />
                  {previewThread.at(-1) && (
                    <details className="mt-2 rounded-lg bg-muted/40 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                        Show quoted message from{" "}
                        {previewThread.at(-1)?.senderName}
                      </summary>
                      <blockquote className="mt-2 whitespace-pre-wrap border-l-2 border-border pl-3 text-xs leading-5 text-muted-foreground">
                        {previewThread.at(-1)?.body}
                      </blockquote>
                    </details>
                  )}
                  {selectedFiles.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {selectedFiles.map((file, index) => (
                        <li
                          key={`${file.name}-${file.lastModified}`}
                          className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="max-w-48 truncate">{file.name}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            className="font-semibold text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              setSelectedFiles((files) =>
                                files.filter(
                                  (_, fileIndex) => fileIndex !== index,
                                ),
                              )
                            }
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="replyMessageAttachments"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Paperclip className="h-4 w-4" />
                      Attach files
                    </label>
                    <input
                      id="replyMessageAttachments"
                      type="file"
                      multiple
                      className="sr-only"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf"
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        const nextFiles = [...selectedFiles, ...files];
                        if (
                          nextFiles.length > 10 ||
                          nextFiles.some((file) => file.size > 10 * 1024 * 1024)
                        ) {
                          setError(
                            "Choose up to 10 files, each no larger than 10 MB.",
                          );
                          event.target.value = "";
                          return;
                        }
                        setError("");
                        setSelectedFiles(nextFiles);
                        event.target.value = "";
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      Up to 10 files · 10 MB each
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetCompose}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" loading={sending}>
                      <Reply className="h-4 w-4" /> Send reply
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </AdminAuthGuard>
  );
}
