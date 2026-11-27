"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { riderAuthApi, type RiderProfile } from "@/services/api/rider-auth.api";
import {
    riderSettingsApi,
    type RiderSettings,
    type RiderChangeRequest,
    type RiderSupportTicket,
    type RiderSupportCategory,
} from "@/services/api/rider-settings.api";

type Section =
    | "account"
    | "vehicle"
    | "location"
    | "notifications"
    | "security"
    | "payment"
    | "app"
    | "support";

const sections: { id: Section; label: string; icon: string }[] = [
    { id: "account", label: "Account Settings", icon: "👤" },
    { id: "vehicle", label: "Vehicle Settings", icon: "🏍️" },
    { id: "location", label: "Location & Availability", icon: "📍" },
    { id: "notifications", label: "Notification Preferences", icon: "🔔" },
    { id: "security", label: "Security & Privacy", icon: "🔒" },
    { id: "payment", label: "Payment Settings", icon: "💳" },
    { id: "app", label: "App Preferences", icon: "⚙️" },
    { id: "support", label: "Help & Support", icon: "💬" },
];

const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white";

const buttonClass =
    "rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

function Field({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
            </span>
            {children}
        </label>
    );
}

function Status({ value }: { value: string }) {
    const color =
        value === "APPROVED" || value === "RESOLVED" || value === "ACTIVE"
            ? "bg-green-100 text-green-700"
            : value === "REJECTED" || value === "CLOSED"
              ? "bg-gray-100 text-gray-600"
              : "bg-amber-100 text-amber-700";

    return (
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
            {value.replaceAll("_", " ")}
        </span>
    );
}

export default function RiderSettingsPage() {
    const [section, setSection] = useState<Section>("account");
    const [profile, setProfile] = useState<RiderProfile | null>(null);
    const [settings, setSettings] = useState<RiderSettings | null>(null);
    const [requests, setRequests] = useState<RiderChangeRequest[]>([]);
    const [tickets, setTickets] = useState<RiderSupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState("");

    const [vehicleType, setVehicleType] = useState("MOTORCYCLE");
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [licenseNumber, setLicenseNumber] = useState("");

    const [provider, setProvider] = useState("");
    const [accountHolderName, setAccountHolderName] = useState("");
    const [accountLast4, setAccountLast4] = useState("");

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [ticketSubject, setTicketSubject] = useState("");
    const [ticketCategory, setTicketCategory] =
        useState<RiderSupportCategory>("OTHER");
    const [ticketDescription, setTicketDescription] = useState("");
    const [activeTicketId, setActiveTicketId] = useState("");
    const [reply, setReply] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [rider, preferences, changeRequests, supportTickets] =
                await Promise.all([
                    riderAuthApi.getMe(),
                    riderSettingsApi.getSettings(),
                    riderSettingsApi.getChangeRequests(),
                    riderSettingsApi.getSupportTickets(),
                ]);

            setProfile(rider);
            setSettings(preferences);
            setRequests(changeRequests);
            setTickets(supportTickets);
            setVehicleType(rider.vehicleType || "MOTORCYCLE");
            setVehicleNumber(rider.vehicleNumber || "");
        } catch (error) {
            console.error(error);
            setNotice("Could not load all settings. Please refresh the page.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const runAction = async (action: () => Promise<void>, success: string) => {
        setSaving(true);
        setNotice("");
        try {
            await action();
            setNotice(success);
        } catch (error) {
            console.error(error);
            setNotice(
                error instanceof Error ? error.message : "Something went wrong.",
            );
        } finally {
            setSaving(false);
        }
    };

    const updateNotification = async (
        key: keyof RiderSettings["notifications"],
        value: boolean,
    ) => {
        if (!settings) return;
        await runAction(async () => {
            const updated = await riderSettingsApi.updateSettings({
                notifications: { [key]: value },
            });
            setSettings(updated);
        }, "Notification preference saved.");
    };

    const updateAppPreference = async (
        key: keyof RiderSettings["app"],
        value: string,
    ) => {
        if (!settings) return;
        await runAction(async () => {
            const updated = await riderSettingsApi.updateSettings({
                app: { [key]: value } as Partial<RiderSettings["app"]>,
            });
            setSettings(updated);
        }, "App preference saved.");
    };

    const submitVehicleRequest = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await runAction(async () => {
            await riderSettingsApi.createVehicleChangeRequest({
                vehicleType: vehicleType as
                    | "MOTORCYCLE"
                    | "CAR"
                    | "BICYCLE"
                    | "VAN"
                    | "OTHER",
                vehicleNumber,
                licenseNumber,
            });
            setRequests(await riderSettingsApi.getChangeRequests());
        }, "Vehicle change request submitted for Owner approval.");
    };

    const submitPaymentRequest = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await runAction(async () => {
            await riderSettingsApi.createPaymentChangeRequest({
                provider,
                accountHolderName,
                accountLast4,
            });
            setRequests(await riderSettingsApi.getChangeRequests());
            setProvider("");
            setAccountHolderName("");
            setAccountLast4("");
        }, "Payment change request submitted for Owner approval.");
    };

    const refreshLocation = async () => {
        if (!navigator.geolocation) {
            setNotice("Geolocation is not supported by this device.");
            return;
        }

        setSaving(true);
        setNotice("");
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const updated = await riderAuthApi.updateLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                    setProfile(updated);
                    setNotice("Your current location has been updated.");
                } catch (error) {
                    console.error(error);
                    setNotice("Could not update location. Please try again.");
                } finally {
                    setSaving(false);
                }
            },
            (error) => {
                setSaving(false);
                setNotice(
                    error.code === error.PERMISSION_DENIED
                        ? "Location permission denied. Enable location access in your device settings."
                        : "Unable to get your location. Please try again.",
                );
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
    };

    const toggleAvailability = async () => {
        if (!profile) return;
        await runAction(async () => {
            const updated = await riderAuthApi.updateAvailability(
                !profile.isAvailable,
            );
            setProfile(updated);
        }, "Availability updated.");
    };

    const changePassword = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (newPassword !== confirmPassword) {
            setNotice("New password and confirmation do not match.");
            return;
        }
        await runAction(async () => {
            await riderSettingsApi.changePassword({
                currentPassword,
                newPassword,
                confirmPassword,
            });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        }, "Password changed successfully.");
    };

    const createTicket = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await runAction(async () => {
            const ticket = await riderSettingsApi.createSupportTicket({
                subject: ticketSubject,
                category: ticketCategory,
                description: ticketDescription,
            });
            setTickets((previous) => [ticket, ...previous]);
            setTicketSubject("");
            setTicketDescription("");
        }, "Support ticket created successfully.");
    };

    const sendReply = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!activeTicketId || !reply.trim()) return;
        await runAction(async () => {
            const updated = await riderSettingsApi.replyToSupportTicket(
                activeTicketId,
                reply,
            );
            setTickets((previous) =>
                previous.map((ticket) =>
                    ticket._id === updated._id ? updated : ticket,
                ),
            );
            setReply("");
        }, "Your reply has been sent.");
    };

    const closeTicket = async (ticketId: string) => {
        await runAction(async () => {
            const updated = await riderSettingsApi.closeSupportTicket(ticketId);
            setTickets((previous) =>
                previous.map((ticket) =>
                    ticket._id === updated._id ? updated : ticket,
                ),
            );
        }, "Support ticket closed.");
    };

    if (loading) {
        return (
            <div className="p-6 text-sm text-gray-500">
                Loading rider settings...
            </div>
        );
    }

    const pendingRequests = requests.filter(
        (request) => request.status === "PENDING",
    );

    return (
        <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
            <header>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Rider Settings
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                    Manage your account, preferences, vehicle and support.
                </p>
            </header>

            {notice && (
                <div
                    role="status"
                    className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200"
                >
                    {notice}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
                <nav className="flex gap-2 overflow-x-auto pb-2 md:flex-col md:overflow-visible">
                    {sections.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setSection(item.id)}
                            className={`flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
                                section === item.id
                                    ? "bg-blue-600 text-white"
                                    : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                            }`}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </nav>

                <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-950">
                    {section === "account" && (
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold">Account Settings</h2>
                            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                                <p className="font-semibold">
                                    {profile?.name || "Rider"}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                    {profile?.email || "No email available"}
                                </p>
                                <p className="text-sm text-gray-500">
                                    {profile?.phone || "No phone available"}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Status value={profile?.riderStatus || "UNKNOWN"} />
                                    <Status value={profile?.onboardingStatus || "NOT_STARTED"} />
                                </div>
                            </div>
                            <Link
                                href="/rider-panel/profile"
                                className="inline-flex rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                            >
                                Edit Profile
                            </Link>
                            <p className="text-xs text-gray-500">
                                Profile details and avatar are managed from your Rider Profile page.
                            </p>
                        </div>
                    )}

                    {section === "vehicle" && (
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold">Vehicle Settings</h2>
                            <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-900">
                                <p>Current vehicle: <strong>{profile?.vehicleType || "Not set"}</strong></p>
                                <p className="mt-1">Vehicle number: <strong>{profile?.vehicleNumber || "Not set"}</strong></p>
                            </div>
                            <form onSubmit={submitVehicleRequest} className="space-y-4">
                                <h3 className="font-semibold">Request a vehicle change</h3>
                                <Field label="Vehicle type">
                                    <select className={inputClass} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                                        <option value="MOTORCYCLE">Motorcycle</option>
                                        <option value="CAR">Car</option>
                                        <option value="BICYCLE">Bicycle</option>
                                        <option value="VAN">Van</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </Field>
                                <Field label="Vehicle number">
                                    <input className={inputClass} value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} required />
                                </Field>
                                <Field label="Driving license number">
                                    <input className={inputClass} value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required />
                                </Field>
                                <button className={buttonClass} disabled={saving}>Submit for approval</button>
                            </form>
                        </div>
                    )}

                    {section === "location" && (
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold">Location & Availability</h2>
                            <div className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-900">
                                <p>Availability: <strong>{profile?.isAvailable ? "Online" : "Offline"}</strong></p>
                                <p className="mt-2">Latitude: {profile?.currentLatitude ?? "Not available"}</p>
                                <p>Longitude: {profile?.currentLongitude ?? "Not available"}</p>
                                <p className="mt-2 text-xs text-gray-500">
                                    Last location update: {profile?.lastLocationAt ? new Date(profile.lastLocationAt).toLocaleString() : "Never"}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <button type="button" className={buttonClass} onClick={refreshLocation} disabled={saving}>
                                    Update my location
                                </button>
                                <button type="button" className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50 dark:border-gray-700" onClick={toggleAvailability} disabled={saving || profile?.onboardingStatus !== "COMPLETED" || profile?.riderStatus !== "ACTIVE"}>
                                    {profile?.isAvailable ? "Go Offline" : "Go Online"}
                                </button>
                            </div>
                            {profile?.onboardingStatus !== "COMPLETED" && (
                                <p className="text-sm text-amber-700">
                                    Complete your rider onboarding before going online.
                                </p>
                            )}
                            <p className="text-xs text-gray-500">
                                Location permission is required. Online availability also requires a recent location update.
                            </p>
                        </div>
                    )}

                    {section === "notifications" && settings && (
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold">Notification Preferences</h2>
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                {(
                                    [
                                        ["announcements", "Announcements"],
                                        ["orderUpdates", "Order updates"],
                                        ["earnings", "Earnings and payouts"],
                                        ["promotions", "Promotions"],
                                        ["sound", "Notification sound"],
                                        ["push", "Push notifications"],
                                        ["email", "Email notifications"],
                                    ] as [keyof RiderSettings["notifications"], string][]
                                ).map(([key, label]) => (
                                    <label key={key} className="flex items-center justify-between gap-4 py-4">
                                        <span className="text-sm font-medium">{label}</span>
                                        <input
                                            type="checkbox"
                                            className="h-5 w-5 accent-blue-600"
                                            checked={settings.notifications[key]}
                                            disabled={saving}
                                            onChange={(e) => void updateNotification(key, e.target.checked)}
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {section === "security" && (
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold">Security & Privacy</h2>
                            <form onSubmit={changePassword} className="max-w-lg space-y-4">
                                <h3 className="font-semibold">Change password</h3>
                                <Field label="Current password">
                                    <input className={inputClass} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                                </Field>
                                <Field label="New password">
                                    <input className={inputClass} type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                                </Field>
                                <Field label="Confirm new password">
                                    <input className={inputClass} type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                                </Field>
                                <button className={buttonClass} disabled={saving}>Change password</button>
                            </form>
                            <p className="text-xs text-gray-500">
                                Never share your password or verification codes with anyone.
                            </p>
                        </div>
                    )}

                    {section === "payment" && (
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold">Payment Settings</h2>
                            <p className="text-sm text-gray-500">
                                Submit payout account changes for Owner approval. Do not enter your full bank account or card number here.
                            </p>
                            <form onSubmit={submitPaymentRequest} className="max-w-lg space-y-4">
                                <Field label="Payment provider">
                                    <input className={inputClass} placeholder="Bank or payment provider" value={provider} onChange={(e) => setProvider(e.target.value)} required />
                                </Field>
                                <Field label="Account holder name">
                                    <input className={inputClass} value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} required />
                                </Field>
                                <Field label="Last 4 digits only">
                                    <input className={inputClass} inputMode="numeric" maxLength={4} minLength={4} pattern="[0-9]{4}" value={accountLast4} onChange={(e) => setAccountLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} required />
                                </Field>
                                <button className={buttonClass} disabled={saving || accountLast4.length !== 4}>Submit for approval</button>
                            </form>
                        </div>
                    )}

                    {section === "app" && settings && (
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold">App Preferences</h2>
                            <Field label="Language">
                                <select className={inputClass} value={settings.app.language} onChange={(e) => void updateAppPreference("language", e.target.value)} disabled={saving}>
                                    <option value="en">English</option>
                                    <option value="bn">বাংলা</option>
                                    <option value="ar">العربية</option>
                                </select>
                            </Field>
                            <Field label="Theme">
                                <select className={inputClass} value={settings.app.theme} onChange={(e) => void updateAppPreference("theme", e.target.value)} disabled={saving}>
                                    <option value="system">System default</option>
                                    <option value="light">Light</option>
                                    <option value="dark">Dark</option>
                                </select>
                            </Field>
                            <Field label="Distance unit">
                                <select className={inputClass} value={settings.app.distanceUnit} onChange={(e) => void updateAppPreference("distanceUnit", e.target.value)} disabled={saving}>
                                    <option value="km">Kilometers (km)</option>
                                    <option value="mi">Miles (mi)</option>
                                </select>
                            </Field>
                            <p className="text-xs text-gray-500">
                                These preferences are saved to your rider account.
                            </p>
                        </div>
                    )}

                    {section === "support" && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-lg font-bold">Help & Support</h2>
                                <p className="mt-1 text-sm text-gray-500">
                                    Create a support ticket and follow its replies.
                                </p>
                            </div>

                            <form onSubmit={createTicket} className="space-y-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                                <h3 className="font-semibold">Create a ticket</h3>
                                <Field label="Subject">
                                    <input className={inputClass} minLength={3} maxLength={150} value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} required />
                                </Field>
                                <Field label="Category">
                                    <select className={inputClass} value={ticketCategory} onChange={(e) => setTicketCategory(e.target.value as RiderSupportCategory)}>
                                        <option value="ACCOUNT">Account</option>
                                        <option value="ORDERS">Orders</option>
                                        <option value="PAYMENTS">Payments</option>
                                        <option value="VEHICLE">Vehicle</option>
                                        <option value="APP">App</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </Field>
                                <Field label="Describe your issue">
                                    <textarea className={inputClass} rows={4} minLength={10} maxLength={3000} value={ticketDescription} onChange={(e) => setTicketDescription(e.target.value)} required />
                                </Field>
                                <button className={buttonClass} disabled={saving}>Create support ticket</button>
                            </form>

                            <div className="space-y-3">
                                <h3 className="font-semibold">Your tickets</h3>
                                {tickets.length === 0 && (
                                    <p className="text-sm text-gray-500">You have no support tickets yet.</p>
                                )}
                                {tickets.map((ticket) => (
                                    <article key={ticket._id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <strong className="text-sm">{ticket.subject}</strong>
                                            <Status value={ticket.status} />
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {ticket.ticketNumber} · {ticket.category} · {new Date(ticket.createdAt).toLocaleDateString()}
                                        </p>
                                        <p className="mt-3 whitespace-pre-wrap text-sm">{ticket.description}</p>

                                        <button
                                            type="button"
                                            className="mt-3 text-sm font-semibold text-blue-600"
                                            onClick={() => setActiveTicketId(activeTicketId === ticket._id ? "" : ticket._id)}
                                        >
                                            {activeTicketId === ticket._id ? "Hide conversation" : "View conversation / Reply"}
                                        </button>

                                        {activeTicketId === ticket._id && (
                                            <div className="mt-4 space-y-3 border-t border-gray-200 pt-3 dark:border-gray-800">
                                                {ticket.messages.map((message, index) => (
                                                    <div key={message._id || index} className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900">
                                                        <p className="whitespace-pre-wrap">{message.message}</p>
                                                        <p className="mt-1 text-xs text-gray-500">
                                                            {new Date(message.createdAt).toLocaleString()}
                                                        </p>
                                                    </div>
                                                ))}
                                                {ticket.status !== "CLOSED" && (
                                                    <form onSubmit={sendReply} className="space-y-2">
                                                        <textarea className={inputClass} rows={2} placeholder="Write a reply..." value={reply} onChange={(e) => setReply(e.target.value)} required />
                                                        <div className="flex flex-wrap gap-2">
                                                            <button className={buttonClass} disabled={saving || !reply.trim()}>Send reply</button>
                                                            <button type="button" className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700" disabled={saving} onClick={() => void closeTicket(ticket._id)}>Close ticket</button>
                                                        </div>
                                                    </form>
                                                )}
                                            </div>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </div>
                    )}

                    {(section === "vehicle" || section === "payment") && (
                        <div className="mt-6 space-y-3 border-t border-gray-200 pt-5 dark:border-gray-800">
                            <h3 className="font-semibold">Change request history</h3>
                            {requests.filter((request) =>
                                request.type === (section === "vehicle" ? "VEHICLE" : "PAYMENT"),
                            ).length === 0 && (
                                <p className="text-sm text-gray-500">No requests submitted yet.</p>
                            )}
                            {requests
                                .filter((request) =>
                                    request.type === (section === "vehicle" ? "VEHICLE" : "PAYMENT"),
                                )
                                .map((request) => (
                                    <div key={request._id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium">{request.type} request</span>
                                            <Status value={request.status} />
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">
                                            Submitted {new Date(request.createdAt).toLocaleString()}
                                        </p>
                                        {request.reviewNote && (
                                            <p className="mt-2 text-sm">Review note: {request.reviewNote}</p>
                                        )}
                                    </div>
                                ))}
                            {pendingRequests.length > 0 && (
                                <p className="text-xs text-amber-700">
                                    You have {pendingRequests.length} request(s) awaiting Owner review.
                                </p>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
