"use client";

import {
    useCallback,
    useEffect,
    useState,
} from "react";

import {
    Archive,
    BellRing,
    CalendarClock,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Plus,
    RefreshCw,
    Search,
    Send,
} from "lucide-react";

import {
    AdminAuthGuard,
} from "@/components/common/AdminAuthGuard";

import {
    Badge,
} from "@/components/ui/Badge";

import {
    Button,
} from "@/components/ui/Button";

import {
    Card,
} from "@/components/ui/Card";

import {
    Input,
} from "@/components/ui/Input";

import {
    Select,
} from "@/components/ui/Select";

import {
    Textarea,
} from "@/components/ui/Textarea";

import {
    useAuthStore,
} from "@/stores/auth.store";

import {
    hasPermission,
} from "@/lib/permissions/permission";

import {
    announcementsApi,
} from "@/services/api/announcements.api";

import {
    ANNOUNCEMENT_PRIORITIES,
    ANNOUNCEMENT_STATUSES,
    ANNOUNCEMENT_TARGET_TYPES,
    type Announcement,
    type AnnouncementPriority,
    type AnnouncementQuery,
    type AnnouncementStatus,
    type AnnouncementTargetType,
    type CreateAnnouncementInput,
} from "@/features/announcements/announcement.types";

const PAGE_SIZE = 20;

function formatDate(value?: string): string {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function statusVariant(
    status: AnnouncementStatus,
): "default" | "success" | "warning" | "danger" | "info" {
    switch (status) {
        case "PUBLISHED": return "success";
        case "SCHEDULED": return "info";
        case "DRAFT": return "warning";
        case "EXPIRED": return "danger";
        default: return "default";
    }
}

function priorityVariant(
    priority: AnnouncementPriority,
): "default" | "warning" | "danger" | "info" {
    switch (priority) {
        case "URGENT": return "danger";
        case "HIGH": return "warning";
        case "LOW": return "info";
        default: return "default";
    }
}

const EMPTY_FORM: CreateAnnouncementInput = {
    title: "",
    body: "",
    priority: "NORMAL",
    targetType: "ALL_ADMINS",
};

export default function AdminAnnouncementsPage() {
    const user = useAuthStore((state) => state.user);

    const canRead = hasPermission(user, "announcements.read");
    const canCreate = hasPermission(user, "announcements.create");
    const canUpdate = hasPermission(user, "announcements.update");

    const [items, setItems] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<"" | AnnouncementStatus>("");
    const [priority, setPriority] = useState<"" | AnnouncementPriority>("");
    const [targetType, setTargetType] = useState<"" | AnnouncementTargetType>("");

    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const [actionId, setActionId] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState<CreateAnnouncementInput>(EMPTY_FORM);
    const [roleIds, setRoleIds] = useState("");
    const [userIds, setUserIds] = useState("");
    const [riderIds, setRiderIds] = useState("");
    const [scheduledAt, setScheduledAt] = useState("");
    const [expiresAt, setExpiresAt] = useState("");

    const loadAnnouncements = useCallback(async () => {
        if (!canRead) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const params: AnnouncementQuery = {
                page,
                limit: PAGE_SIZE,
            };

            if (search) params.search = search;
            if (status) params.status = status;
            if (priority) params.priority = priority;
            if (targetType) params.targetType = targetType;

            const result = await announcementsApi.getAll(params);

            setItems(result.announcements ?? []);
            setTotal(result.total ?? 0);
            setTotalPages(result.totalPages ?? 0);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to load announcements.",
            );
        } finally {
            setLoading(false);
        }
    }, [canRead, page, search, status, priority, targetType]);

    useEffect(() => {
        void loadAnnouncements();
    }, [loadAnnouncements]);

    const submitSearch = () => {
        setPage(1);
        setSearch(searchInput.trim());
    };

    const createAnnouncement = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        if (!canCreate) return;

        setActionId("create");
        setError("");
        setNotice("");

        try {
            const payload: CreateAnnouncementInput = {
                ...form,
            };

            if (form.targetType === "ROLES") {
                payload.targetRoleIds = roleIds
                    .split(/[\s,]+/)
                    .map((id) => id.trim())
                    .filter(Boolean);
            }

            if (form.targetType === "USERS") {
                payload.targetUserIds = userIds
                    .split(/[\s,]+/)
                    .map((id) => id.trim())
                    .filter(Boolean);
            }

            if (form.targetType === "RIDERS") {
                payload.targetRiderIds = riderIds
                    .split(/[\s,]+/)
                    .map((id) => id.trim())
                    .filter(Boolean);
            }

            if (scheduledAt) {
                payload.scheduledAt = new Date(scheduledAt).toISOString();
            }

            if (expiresAt) {
                payload.expiresAt = new Date(expiresAt).toISOString();
            }

            await announcementsApi.create(payload);

            setForm(EMPTY_FORM);
            setRoleIds("");
            setUserIds("");
            setRiderIds("");
            setScheduledAt("");
            setExpiresAt("");
            setShowCreate(false);
            setPage(1);
            setSearch("");
            setSearchInput("");
            setNotice("Announcement created successfully.");

            await loadAnnouncements();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to create announcement.",
            );
        } finally {
            setActionId("");
        }
    };

    const runAction = async (
        item: Announcement,
        action: "publish" | "archive",
    ) => {
        if (!canUpdate) return;

        const message = action === "publish"
            ? `Publish "${item.title}" now?`
            : `Archive "${item.title}"?`;

        if (!window.confirm(message)) return;

        setActionId(item._id);
        setError("");
        setNotice("");

        try {
            if (action === "publish") {
                await announcementsApi.publish(item._id);
                setNotice("Announcement published.");
            } else {
                await announcementsApi.archive(item._id);
                setNotice("Announcement archived.");
            }

            await loadAnnouncements();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : `Failed to ${action} announcement.`,
            );
        } finally {
            setActionId("");
        }
    };

    return (
        <AdminAuthGuard>
            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Announcements
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Create, schedule, publish and archive administrative announcements.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => void loadAnnouncements()}>
                            <RefreshCw size={16} />
                            Refresh
                        </Button>

                        {canCreate && (
                            <Button onClick={() => setShowCreate((value) => !value)}>
                                <Plus size={17} />
                                {showCreate ? "Close Form" : "Create Announcement"}
                            </Button>
                        )}
                    </div>
                </div>

                {error && (
                    <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600">
                        {error}
                    </div>
                )}

                {notice && (
                    <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-600">
                        {notice}
                    </div>
                )}

                <div className="grid gap-4 sm:grid-cols-3">
                    <Card className="p-5">
                        <p className="text-sm text-muted-foreground">Total announcements</p>
                        <p className="mt-2 text-2xl font-bold">{total}</p>
                    </Card>

                    <Card className="p-5">
                        <p className="text-sm text-muted-foreground">Current page</p>
                        <p className="mt-2 text-2xl font-bold">
                            {page}{totalPages ? ` / ${totalPages}` : ""}
                        </p>
                    </Card>

                    <Card className="p-5">
                        <p className="text-sm text-muted-foreground">Loaded on this page</p>
                        <p className="mt-2 text-2xl font-bold">{items.length}</p>
                    </Card>
                </div>

                {showCreate && canCreate && (
                    <Card className="p-5 sm:p-6">
                        <h2 className="mb-5 text-lg font-semibold">
                            <BellRing className="mr-2 inline-block" size={19} />
                            New Announcement
                        </h2>

                        <form onSubmit={createAnnouncement} className="space-y-5">
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-2 text-sm font-medium">
                                    Title
                                    <Input
                                        required
                                        maxLength={250}
                                        value={form.title}
                                        onChange={(event) => setForm((old) => ({
                                            ...old,
                                            title: event.target.value,
                                        }))}
                                        placeholder="Announcement title"
                                    />
                                </label>

                                <label className="space-y-2 text-sm font-medium">
                                    Priority
                                    <Select
                                        value={form.priority}
                                        onChange={(event) => setForm((old) => ({
                                            ...old,
                                            priority: event.target.value as AnnouncementPriority,
                                        }))}
                                    >
                                        {ANNOUNCEMENT_PRIORITIES.map((value) => (
                                            <option key={value} value={value}>{value}</option>
                                        ))}
                                    </Select>
                                </label>

                                <label className="space-y-2 text-sm font-medium">
                                    Audience
                                    <Select
                                        value={form.targetType}
                                        onChange={(event) => setForm((old) => ({
                                            ...old,
                                            targetType: event.target.value as AnnouncementTargetType,
                                        }))}
                                    >
                                        {ANNOUNCEMENT_TARGET_TYPES.map((value) => (
                                            <option key={value} value={value}>
                                                {value === "ALL_ADMINS"
                                                    ? "All administrators"
                                                    : value === "ROLES"
                                                        ? "Specific roles"
                                                        : value === "USERS"
                                                            ? "Specific users"
                                                            : value === "ALL_RIDERS"
                                                                ? "All active riders"
                                                                : "Specific riders"}
                                            </option>
                                        ))}
                                    </Select>
                                </label>

                                {form.targetType === "ROLES" && (
                                    <label className="space-y-2 text-sm font-medium">
                                        Role IDs
                                        <Input
                                            required
                                            value={roleIds}
                                            onChange={(event) => setRoleIds(event.target.value)}
                                            placeholder="MongoDB IDs, separated by commas"
                                        />
                                    </label>
                                )}

                                {form.targetType === "USERS" && (
                                    <label className="space-y-2 text-sm font-medium">
                                        User IDs
                                        <Input
                                            required
                                            value={userIds}
                                            onChange={(event) => setUserIds(event.target.value)}
                                            placeholder="MongoDB IDs, separated by commas"
                                        />
                                    </label>
                                )}

                                {form.targetType === "RIDERS" && (
                                    <label className="space-y-2 text-sm font-medium">
                                        Rider IDs
                                        <Input
                                            required
                                            value={riderIds}
                                            onChange={(event) => setRiderIds(event.target.value)}
                                            placeholder="Rider MongoDB IDs, separated by commas"
                                        />
                                    </label>
                                )}

                                <label className="space-y-2 text-sm font-medium">
                                    <span className="flex items-center gap-2">
                                        <CalendarClock size={15} />
                                        Schedule (optional)
                                    </span>
                                    <Input
                                        type="datetime-local"
                                        value={scheduledAt}
                                        onChange={(event) => setScheduledAt(event.target.value)}
                                    />
                                </label>

                                <label className="space-y-2 text-sm font-medium">
                                    Expiry (optional)
                                    <Input
                                        type="datetime-local"
                                        value={expiresAt}
                                        min={scheduledAt || undefined}
                                        onChange={(event) => setExpiresAt(event.target.value)}
                                    />
                                </label>
                            </div>

                            <label className="block space-y-2 text-sm font-medium">
                                Message
                                <Textarea
                                    required
                                    maxLength={20000}
                                    rows={7}
                                    value={form.body}
                                    onChange={(event) => setForm((old) => ({
                                        ...old,
                                        body: event.target.value,
                                    }))}
                                    placeholder="Write the announcement..."
                                />
                            </label>

                            <p className="text-xs text-muted-foreground">
                                Times are converted to ISO timestamps by your browser before submission.
                            </p>

                            <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowCreate(false)}
                                >
                                    Cancel
                                </Button>

                                <Button type="submit" loading={actionId === "create"}>
                                    <Plus size={16} />
                                    Create
                                </Button>
                            </div>
                        </form>
                    </Card>
                )}

                <Card className="p-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_150px_170px_auto]">
                        <div className="flex min-w-0 gap-2">
                            <Input
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") submitSearch();
                                }}
                                placeholder="Search title or message..."
                            />
                            <Button variant="outline" onClick={submitSearch}>
                                <Search size={16} />
                                Search
                            </Button>
                        </div>

                        <Select
                            value={status}
                            onChange={(event) => {
                                setPage(1);
                                setStatus(event.target.value as "" | AnnouncementStatus);
                            }}
                        >
                            <option value="">All statuses</option>
                            {ANNOUNCEMENT_STATUSES.map((value) => (
                                <option key={value} value={value}>{value}</option>
                            ))}
                        </Select>

                        <Select
                            value={priority}
                            onChange={(event) => {
                                setPage(1);
                                setPriority(event.target.value as "" | AnnouncementPriority);
                            }}
                        >
                            <option value="">All priorities</option>
                            {ANNOUNCEMENT_PRIORITIES.map((value) => (
                                <option key={value} value={value}>{value}</option>
                            ))}
                        </Select>

                        <Select
                            value={targetType}
                            onChange={(event) => {
                                setPage(1);
                                setTargetType(event.target.value as "" | AnnouncementTargetType);
                            }}
                        >
                            <option value="">All audiences</option>
                            {ANNOUNCEMENT_TARGET_TYPES.map((value) => (
                                <option key={value} value={value}>{value}</option>
                            ))}
                        </Select>

                        <Button
                            variant="outline"
                            onClick={() => {
                                setSearchInput("");
                                setSearch("");
                                setStatus("");
                                setPriority("");
                                setTargetType("");
                                setPage(1);
                            }}
                        >
                            Reset
                        </Button>
                    </div>
                </Card>

                <Card className="overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-sm text-muted-foreground">
                            Loading announcements...
                        </div>
                    ) : !canRead ? (
                        <div className="p-12 text-center text-sm text-muted-foreground">
                            You do not have permission to view announcements.
                        </div>
                    ) : items.length === 0 ? (
                        <div className="p-12 text-center">
                            <BellRing className="mx-auto mb-3 text-muted-foreground" size={28} />
                            <p className="font-medium">No announcements found</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Try changing the filters or create a new announcement.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {items.map((item) => (
                                <article key={item._id} className="space-y-4 p-5">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="break-words font-semibold">
                                                    {item.title}
                                                </h2>
                                                <Badge variant={statusVariant(item.status)}>
                                                    {item.status}
                                                </Badge>
                                                <Badge variant={priorityVariant(item.priority)}>
                                                    {item.priority}
                                                </Badge>
                                            </div>

                                            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                                                {item.body.length > 500
                                                    ? `${item.body.slice(0, 500)}…`
                                                    : item.body}
                                            </p>

                                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                                                <span>Audience: {item.targetType}</span>
                                                <span>Created: {formatDate(item.createdAt)}</span>
                                                {item.scheduledAt && (
                                                    <span>Scheduled: {formatDate(item.scheduledAt)}</span>
                                                )}
                                                {item.publishedAt && (
                                                    <span>Published: {formatDate(item.publishedAt)}</span>
                                                )}
                                                {item.expiresAt && (
                                                    <span>Expires: {formatDate(item.expiresAt)}</span>
                                                )}
                                            </div>
                                        </div>

                                        {canUpdate && (
                                            <div className="flex shrink-0 flex-wrap gap-2">
                                                {(item.status === "DRAFT" ||
                                                    item.status === "SCHEDULED") && (
                                                    <Button
                                                        size="sm"
                                                        loading={actionId === item._id}
                                                        disabled={Boolean(actionId)}
                                                        onClick={() => void runAction(item, "publish")}
                                                    >
                                                        <Send size={14} />
                                                        Publish
                                                    </Button>
                                                )}

                                                {item.status !== "ARCHIVED" &&
                                                    item.status !== "EXPIRED" && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        loading={actionId === item._id}
                                                        disabled={Boolean(actionId)}
                                                        onClick={() => void runAction(item, "archive")}
                                                    >
                                                        <Archive size={14} />
                                                        Archive
                                                    </Button>
                                                )}

                                                {item.status === "PUBLISHED" && (
                                                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                                        <CheckCircle2 size={14} />
                                                        Published
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            {total} announcement(s)
                        </p>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1 || loading}
                                onClick={() => setPage((value) => Math.max(1, value - 1))}
                            >
                                <ChevronLeft size={16} />
                                Previous
                            </Button>

                            <span className="min-w-20 text-center text-sm">
                                {page}{totalPages ? ` / ${totalPages}` : ""}
                            </span>

                            <Button
                                variant="outline"
                                size="sm"
                                disabled={loading || !totalPages || page >= totalPages}
                                onClick={() => setPage((value) => value + 1)}
                            >
                                Next
                                <ChevronRight size={16} />
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </AdminAuthGuard>
    );
}
