
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Store,
  User,
  XCircle,
  Ban,
  AlertCircle,
  FileText,
  Hash,
} from "lucide-react";

import {
  sellersApi,
  type Seller,
  type SellerStatus,
} from "@/services/api/sellers.api";

const STATUS_STYLES: Record<SellerStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-700",
  SUSPENDED: "bg-red-100 text-red-800",
  REJECTED: "bg-rose-100 text-rose-800",
};

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (error as {
      response?: { data?: { message?: string } };
    }).response;

    if (response?.data?.message) {
      return response.data.message;
    }
  }

  if (error instanceof Error) return error.message;

  return "Something went wrong. Please try again.";
}

function unwrapSeller(value: unknown): Seller | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;

  if (typeof record._id === "string") {
    return value as Seller;
  }

  if (record.seller) {
    return unwrapSeller(record.seller);
  }

  if (record.data) {
    return unwrapSeller(record.data);
  }

  return null;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function DetailItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | number | null;
  icon?: React.ElementType;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
        {Icon && <Icon size={16} />}
        {label}
      </div>

      <p className="break-words text-sm font-semibold text-gray-900">
        {value || "—"}
      </p>
    </div>
  );
}

export default function SellerDetailPage() {
  const params = useParams();
  const router = useRouter();

  const sellerId =
    typeof params.sellerId === "string" ? params.sellerId : "";

  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const loadSeller = useCallback(async () => {
    if (!sellerId) return;

    setLoading(true);
    setError("");

    try {
      const response = await sellersApi.getById(sellerId);
      const result = unwrapSeller(response);

      if (!result) {
        throw new Error("Seller information could not be loaded.");
      }

      setSeller(result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    void loadSeller();
  }, [loadSeller]);

  const handleStatusUpdate = async (nextStatus: SellerStatus) => {
    if (!seller) return;

    let reason: string | undefined;

    if (nextStatus === "SUSPENDED" || nextStatus === "REJECTED") {
      const input = window.prompt(
        `Enter a reason for ${nextStatus.toLowerCase()}:`
      );

      if (!input?.trim()) return;

      reason = input.trim();
    }

    const confirmed = window.confirm(
      `Are you sure you want to change seller status to ${nextStatus}?`
    );

    if (!confirmed) return;

    setUpdating(true);
    setError("");

    try {
      await sellersApi.updateStatus(
        seller._id,
        nextStatus,
        reason
      );

      await loadSeller();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="animate-spin text-gray-500" size={28} />
      </div>
    );
  }

  if (error && !seller) {
    return (
      <div className="space-y-4 p-6">
        <Link
          href="/admin/sellers"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black"
        >
          <ArrowLeft size={16} />
          Back to Sellers
        </Link>

        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
          <AlertCircle className="mb-2" size={22} />
          <p className="font-semibold">Unable to load seller</p>
          <p className="mt-1 text-sm">{error}</p>

          <button
            onClick={() => void loadSeller()}
            className="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-800"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!seller) return null;

  const sellerName = seller.legalName || seller.businessName || "—";
  const sellerEmail = seller.email || "—";
  const sellerPhone = seller.phone || "—";

  const statusActions: {
    status: SellerStatus;
    label: string;
    icon: React.ElementType;
    className: string;
  }[] = [
    {
      status: "ACTIVE",
      label: "Activate",
      icon: CheckCircle2,
      className: "bg-green-600 hover:bg-green-700",
    },
    {
      status: "INACTIVE",
      label: "Deactivate",
      icon: Ban,
      className: "bg-gray-600 hover:bg-gray-700",
    },
    {
      status: "SUSPENDED",
      label: "Suspend",
      icon: XCircle,
      className: "bg-red-600 hover:bg-red-700",
    },
    {
      status: "REJECTED",
      label: "Reject",
      icon: AlertCircle,
      className: "bg-rose-600 hover:bg-rose-700",
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link
            href="/admin/sellers"
            className="mb-3 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to Sellers
          </Link>

          <h1 className="text-2xl font-bold text-gray-900">
            Seller Details
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage seller information, account status and verification.
          </p>
        </div>

        <button
          onClick={() => void loadSeller()}
          disabled={loading || updating}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Seller Overview */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
              {seller.logoUrl ? (
                <img
                  src={seller.logoUrl}
                  alt={seller.businessName || "Seller"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store size={28} className="text-gray-500" />
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {seller.businessName || seller.legalName || "Unnamed Seller"}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Seller Code: {seller.sellerCode || "—"}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    STATUS_STYLES[seller.status]
                  }`}
                >
                  {seller.status}
                </span>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {seller.type}
                </span>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500">
            <p>Seller ID</p>
            <p className="mt-1 break-all font-mono text-gray-800">
              {seller._id}
            </p>
          </div>
        </div>
      </div>

      {/* Status Management */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Seller Status Management
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Current status: {seller.status}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {statusActions
            .filter((action) => action.status !== seller.status)
            .map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.status}
                  disabled={updating}
                  onClick={() => handleStatusUpdate(action.status)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${action.className}`}
                >
                  <Icon size={16} />
                  {action.label}
                </button>
              );
            })}
        </div>

        {updating && (
          <p className="mt-3 text-sm text-gray-500">
            Updating seller status...
          </p>
        )}

        {seller.status === "SUSPENDED" && seller.suspensionReason && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <strong>Suspension reason:</strong> {seller.suspensionReason}
          </div>
        )}

        {seller.status === "REJECTED" && seller.rejectionReason && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            <strong>Rejection reason:</strong> {seller.rejectionReason}
          </div>
        )}
      </section>

      {/* Business Information */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 size={20} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Business Information
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <DetailItem
            label="Business Name"
            value={seller.businessName}
            icon={Building2}
          />

          <DetailItem
            label="Legal Name"
            value={seller.legalName}
            icon={User}
          />

          <DetailItem
            label="Seller Type"
            value={seller.type}
            icon={Store}
          />

          <DetailItem
            label="Tax Number"
            value={seller.taxNumber}
            icon={FileText}
          />

          <DetailItem
            label="Registration Number"
            value={seller.registrationNumber}
            icon={Hash}
          />

          <DetailItem
            label="Website"
            value={seller.website}
            icon={Globe}
          />

          <DetailItem
            label="Email"
            value={seller.email}
            icon={Mail}
          />

          <DetailItem
            label="Phone"
            value={seller.phone}
            icon={Phone}
          />
        </div>

        {seller.description && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-2 text-sm text-gray-500">Description</p>
            <p className="whitespace-pre-wrap text-sm text-gray-800">
              {seller.description}
            </p>
          </div>
        )}
      </section>

      {/* Account Owner */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <User size={20} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Account Owner
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <DetailItem label="Seller Name" value={sellerName} icon={User} />
          <DetailItem label="Seller Email" value={sellerEmail} icon={Mail} />
          <DetailItem label="Seller Phone" value={sellerPhone} icon={Phone} />
          <DetailItem label="Seller ID" value={seller._id} icon={Hash} />
          <DetailItem
            label="Account Status"
            value={seller.status}
            icon={ShieldCheck}
          />
        </div>
      </section>

      {/* Verification & History */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Verification & Account History
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <DetailItem
            label="Verified At"
            value={formatDate(seller.verifiedAt)}
            icon={CheckCircle2}
          />

          <DetailItem
            label="Verified By"
            value={
              typeof seller.verifiedBy === "object" && seller.verifiedBy
                ? seller.verifiedBy.name
                : seller.verifiedBy || "—"
            }
            icon={ShieldCheck}
          />

          <DetailItem
            label="Suspended At"
            value={formatDate(seller.suspendedAt)}
            icon={Ban}
          />

          <DetailItem
            label="Suspended By"
            value={
              typeof seller.suspendedBy === "object" && seller.suspendedBy
                ? seller.suspendedBy.name
                : seller.suspendedBy || "—"
            }
            icon={User}
          />

          <DetailItem
            label="Created At"
            value={formatDate(seller.createdAt)}
            icon={CalendarDays}
          />

          <DetailItem
            label="Last Updated"
            value={formatDate(seller.updatedAt)}
            icon={Clock}
          />
        </div>
      </section>

      {/* Internal Notes */}
      {seller.notes && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Internal Notes
          </h2>

          <p className="whitespace-pre-wrap text-sm text-gray-700">
            {seller.notes}
          </p>
        </section>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => router.push("/admin/sellers")}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Sellers
        </button>
      </div>
    </div>
  );
}
