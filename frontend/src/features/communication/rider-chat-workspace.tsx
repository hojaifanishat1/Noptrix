"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  MessageCircle,
  Plus,
  Search,
  Send,
  UserRound,
  X,
} from "lucide-react";

import { communicationApi } from "@/services/api/communication.api";
import { riderMessagesApi } from "@/services/api/rider-messages.api";
import { riderAuthApi } from "@/services/api/rider-auth.api";
import { useAuthStore } from "@/stores/auth.store";

import type {
  InternalMessage,
  MessageRecipient,
} from "./message.types";

type Mode = "admin" | "rider";

function getError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function threadKey(message: InternalMessage) {
  return message.threadId || message._id;
}

function timeLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export function RiderChatWorkspace({ mode, participantTypeFilter }: { mode: Mode; participantTypeFilter?: "RIDER" | "ADMIN_EMPLOYEE" }) {
  const authUser = useAuthStore((state) => state.user);
  const [riderId, setRiderId] = useState("");
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [thread, setThread] = useState<InternalMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mobileChat, setMobileChat] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipients, setRecipients] = useState<MessageRecipient[]>([]);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [selectedRecipient, setSelectedRecipient] =
    useState<MessageRecipient | null>(null);

  const loadInbox = useCallback(async () => {
    try {
      setError("");
      const result =
        mode === "admin"
          ? await communicationApi.getInbox({
              page: 1,
              limit: 100,
              ...(participantTypeFilter ? { participantType: participantTypeFilter } : {}),
              sort: "newest",
            })
          : await riderMessagesApi.getInbox();

      setMessages(result.messages);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  }, [mode, participantTypeFilter]);

  useEffect(() => {
    if (mode === "rider") {
      void riderAuthApi.getMe()
        .then((profile) => setRiderId(profile.riderId))
        .catch((err) => setError(getError(err)));
    }
  }, [mode]);

  useEffect(() => {
    void loadInbox();
    const timer = window.setInterval(() => void loadInbox(), 20000);
    return () => window.clearInterval(timer);
  }, [loadInbox]);

  const conversations = useMemo(() => {
    const map = new Map<string, InternalMessage>();
    for (const message of messages) {
      const key = threadKey(message);
      const previous = map.get(key);
      if (
        !previous ||
        new Date(message.createdAt).getTime() >
          new Date(previous.createdAt).getTime()
      ) {
        map.set(key, message);
      }
    }
    return [...map.values()].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );
  }, [messages]);

  const filtered = conversations.filter((message) => {
    const otherName =
      mode === "admin"
        ? (message.senderId === authUser?.id
            ? message.recipientName
            : message.senderName)
        : (message.senderId === riderId
            ? message.recipientName
            : message.senderName);
    const term = search.trim().toLowerCase();
    return (
      !term ||
      otherName.toLowerCase().includes(term) ||
      message.subject.toLowerCase().includes(term) ||
      message.body.toLowerCase().includes(term)
    );
  });

  const openThread = async (message: InternalMessage) => {
    setSelectedId(threadKey(message));
    setMobileChat(true);
    setThreadLoading(true);
    setError("");
    try {
      const result =
        mode === "admin"
          ? await communicationApi.getThread(message._id)
          : await riderMessagesApi.getThread(message._id);
      setThread(result);
      await loadInbox();
    } catch (err) {
      setError(getError(err));
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    if (!showNewChat || mode !== "admin") return;
    let active = true;
    const timer = window.setTimeout(() => {
      setRecipientLoading(true);
      void communicationApi.getRecipients({
        page: 1,
        limit: 100,
        ...(participantTypeFilter === "RIDER"
          ? { accountType: "RIDER" as const }
          : participantTypeFilter === "ADMIN_EMPLOYEE"
            ? { accountTypes: "ADMIN,EMPLOYEE" }
            : {}),
        ...(recipientSearch.trim()
          ? { search: recipientSearch.trim() }
          : {}),
      }).then((result) => {
        if (active) setRecipients(result.recipients);
      }).catch((err) => {
        if (active) setError(getError(err));
      }).finally(() => {
        if (active) setRecipientLoading(false);
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [showNewChat, mode, recipientSearch, participantTypeFilter]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || sending) return;

    setSending(true);
    setError("");
    try {
      if (showNewChat && mode === "admin") {
        if (!selectedRecipient) {
          throw new Error(participantTypeFilter === "RIDER" ? "Select a rider first." : "Select a recipient first.");
        }
        await communicationApi.create({
          recipientId: selectedRecipient.userId,
          subject: participantTypeFilter === "RIDER" ? "Rider conversation" : "Conversation",
          body: text,
          priority: "NORMAL",
        });
        setShowNewChat(false);
        setSelectedRecipient(null);
        setRecipientSearch("");
      } else {
        if (!selectedId) return;
        const root = thread[0];
        if (!root) return;
        if (mode === "admin") {
          await communicationApi.reply(root._id, { body: text });
        } else {
          await riderMessagesApi.reply(root._id, text);
        }
      }
      setBody("");
      await loadInbox();
      if (selectedId && thread[0]) {
        const rootMessageId = thread[0]._id;
        const updated =
          mode === "admin"
            ? await communicationApi.getThread(rootMessageId)
            : await riderMessagesApi.getThread(rootMessageId);
        setThread(updated);
      }
    } catch (err) {
      setError(getError(err));
    } finally {
      setSending(false);
    }
  };

  const selectedConversation = conversations.find(
    (message) => threadKey(message) === selectedId,
  );

  const otherName = selectedConversation
    ? mode === "admin"
      ? (selectedConversation.senderId === authUser?.id
          ? selectedConversation.recipientName
          : selectedConversation.senderName)
      : (selectedConversation.senderId === riderId
          ? selectedConversation.recipientName
          : selectedConversation.senderName)
    : "";

  return (
    <section className="mx-auto w-full max-w-7xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <MessageCircle className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {mode === "admin" ? (participantTypeFilter === "RIDER" ? "Rider Messages" : "Messages") : "Messages"}
              </h1>
              <p className="text-sm text-slate-500">
                {mode === "admin"
                  ? participantTypeFilter === "RIDER"
                    ? "Direct conversations with your riders"
                    : "All your conversations across NOPTRIX"
                  : "Your conversations with NOPTRIX Admin"}
              </p>
            </div>
          </div>
        </div>
        {mode === "admin" && (
          <button
            type="button"
            onClick={() => {
              setShowNewChat(true);
              setSelectedId("");
              setThread([]);
              setMobileChat(false);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> New chat
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid h-[min(720px,calc(100vh-220px))] min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={`min-h-0 flex-col border-r border-slate-200 ${mobileChat ? "hidden md:flex" : "flex"}`}>
          <div className="border-b border-slate-100 p-4">
            <h2 className="mb-3 font-semibold text-slate-900">Chats</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations"
                className="w-full rounded-xl bg-slate-100 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-5 text-sm text-slate-500">Loading chats...</p>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                <MessageCircle className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                No conversations yet
              </div>
            ) : filtered.map((message) => {
              const active = selectedId === threadKey(message);
              const name =
                mode === "admin"
                  ? (message.senderId === authUser?.id
                      ? message.recipientName
                      : message.senderName)
                  : (message.senderId === riderId
                      ? message.recipientName
                      : message.senderName);
              const otherRole =
                mode === "admin"
                  ? (message.senderId === authUser?.id
                      ? message.recipientRole
                      : message.senderRole)
                  : message.senderRole;
              const unread =
                mode === "admin"
                  ? message.recipientId === authUser?.id &&
                    message.status === "SENT"
                  : message.recipientId === riderId &&
                    message.status === "SENT";

              return (
                <button
                  key={threadKey(message)}
                  type="button"
                  onClick={() => void openThread(message)}
                  className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-4 text-left transition hover:bg-slate-50 ${active ? "bg-emerald-50" : ""}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800">
                    {name?.slice(0, 1).toUpperCase() || <UserRound className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{name}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{dateLabel(message.createdAt)}</span>
                    </span>
                    {otherRole && (
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">{otherRole}</span>
                    )}
                    <span className="mt-1 block truncate text-xs text-slate-500">{message.body}</span>
                  </span>
                  {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />}
                </button>
              );
            })}
          </div>
        </aside>

        <div className={`min-h-0 flex-col ${mobileChat || showNewChat ? "flex" : "hidden md:flex"}`}>
          {showNewChat && mode === "admin" ? (
            <>
              <div className="flex items-center gap-3 border-b border-slate-200 p-4">
                <button type="button" onClick={() => setShowNewChat(false)} className="rounded-lg p-2 hover:bg-slate-100">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="font-semibold">Start a new chat</h2>
                  <p className="text-xs text-slate-500">{participantTypeFilter === "RIDER" ? "Choose an active rider" : "Choose a recipient"}</p>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <input
                  value={recipientSearch}
                  onChange={(event) => setRecipientSearch(event.target.value)}
                  placeholder={participantTypeFilter === "RIDER" ? "Search riders by name, email or phone" : "Search people by name, email or phone"}
                  className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
                {recipientLoading && <p className="p-3 text-sm text-slate-500">Searching riders...</p>}
                {recipients.map((recipient) => (
                  <button
                    key={recipient.userId}
                    type="button"
                    onClick={() => setSelectedRecipient(recipient)}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-slate-50 ${selectedRecipient?.userId === recipient.userId ? "bg-emerald-50 ring-1 ring-emerald-300" : ""}`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{recipient.name}</span>
                      <span className="block truncate text-xs text-slate-600">
                        {recipient.profileName || recipient.accountType}
                      </span>
                      {recipient.email && (
                        <span className="block truncate text-[11px] text-slate-400">{recipient.email}</span>
                      )}
                    </span>
                    {selectedRecipient?.userId === recipient.userId && <Check className="h-5 w-5 text-emerald-600" />}
                  </button>
                ))}
                {!recipientLoading && recipients.length === 0 && (
                  <p className="p-4 text-center text-sm text-slate-500">{participantTypeFilter === "RIDER" ? "No active riders found." : "No recipients found."}</p>
                )}
              </div>
              {selectedRecipient && (
                <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-200 p-3">
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder={`Message ${selectedRecipient.name}...`}
                    rows={2}
                    className="min-h-11 flex-1 resize-none rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button disabled={sending || !body.trim()} className="rounded-full bg-emerald-600 p-3 text-white disabled:opacity-50">
                    <Send className="h-5 w-5" />
                  </button>
                </form>
              )}
            </>
          ) : selectedId ? (
            <>
              <div className="flex items-center gap-3 border-b border-slate-200 bg-white p-3 md:px-5">
                <button type="button" onClick={() => setMobileChat(false)} className="rounded-lg p-2 hover:bg-slate-100 md:hidden">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800">
                  {otherName?.slice(0, 1).toUpperCase() || <UserRound className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-slate-900">{otherName}</h2>
                  <p className="text-xs text-emerald-600">{mode === "admin" ? (participantTypeFilter === "RIDER" ? "Rider conversation" : "NOPTRIX conversation") : "NOPTRIX Admin"}</p>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#efeae2] p-4 md:p-6">
                {threadLoading ? (
                  <p className="m-auto rounded-xl bg-white/80 px-4 py-2 text-sm text-slate-500">Loading conversation...</p>
                ) : thread.map((message) => {
                  const mine =
                    mode === "admin"
                      ? message.senderId === authUser?.id
                      : message.senderId === riderId;

                  return (
                    <div key={message._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm md:max-w-[70%] ${mine ? "rounded-tr-sm bg-[#d9fdd3]" : "rounded-tl-sm bg-white"}`}>
                        {message.body && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{message.body}</p>}
                        <div className="mt-1 flex items-center justify-end gap-1.5">
                          <span className="text-[10px] text-slate-500">{timeLabel(message.createdAt)}</span>
                          {mine && (message.status === "READ" ? <CheckCheck className="h-3.5 w-3.5 text-sky-600" /> : <Check className="h-3.5 w-3.5 text-slate-400" />)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!threadLoading && thread.length === 0 && (
                  <p className="m-auto rounded-xl bg-white/80 px-4 py-2 text-sm text-slate-500">No messages in this conversation.</p>
                )}
              </div>

              <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 md:p-4">
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Type a message..."
                  rows={1}
                  className="max-h-32 min-h-11 flex-1 resize-y rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button type="submit" disabled={sending || !body.trim()} className="rounded-full bg-emerald-600 p-3 text-white transition hover:bg-emerald-700 disabled:opacity-50">
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </>
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center bg-[#f7f8fa] p-8 text-center md:flex">
              <span className="mb-4 rounded-full bg-emerald-100 p-5 text-emerald-700">
                <MessageCircle className="h-12 w-12" />
              </span>
              <h2 className="text-xl font-semibold text-slate-800">Your messages</h2>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Select a conversation to start chatting.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
