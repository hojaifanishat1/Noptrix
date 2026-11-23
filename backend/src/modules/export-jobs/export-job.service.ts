import crypto from "crypto";
import mongoose from "mongoose";

import {
  generateExport,
  registerExportProvider,
  type ExportProviderAdapter,
  type ExportProviderContext,
} from "../../services/export.service";

import {
  uploadBufferToCloudinary,
  createPrivateCloudinaryDownloadUrl,
  deleteFromCloudinary,
} from "../../services/cloudinary.service";

import { ExportJob } from "./export-job.model";
import { getExportQueue } from "./export-job.queue";

const MAX_EXPORT_ROWS = 100_000;
const FILE_EXPIRY_HOURS = 24;

type ExportFormat = "csv" | "xlsx" | "json";

interface DatasetDefinition {
  label: string;
  category: string;
  collection: string;
  fields: readonly string[];
  dateField?: string;
  staticFilter?: Record<string, unknown>;
}

/*
 * Explicit field allowlist.
 * Never export complete MongoDB documents.
 * Authentication credentials, tokens, payment secrets and private data
 * are intentionally excluded.
 */
export const EXPORT_DATASETS: Record<string, DatasetDefinition> = {
  // ORDERS & SALES
  orders: {
    label: "Orders",
    category: "Orders & Sales",
    collection: "orders",
    fields: [
      "_id", "orderNumber", "userId", "status", "paymentStatus",
      "totals.subtotal", "totals.discountAmount", "delivery.fee",
      "totals.totalAmount", "totals.currency", "createdAt", "updatedAt",
    ],
  },

  // PEOPLE
  customers: {
    label: "Customers",
    category: "People",
    collection: "customers",
    fields: [
      "_id", "userId", "status", "totalOrders", "totalSpent",
      "totalRefunded", "lastOrderAt", "lastActiveAt", "createdAt", "updatedAt",
    ],
  },
  sellers: {
    label: "Sellers",
    category: "People",
    collection: "sellers",
    fields: [
      "_id", "sellerCode", "type", "businessName", "status",
      "onboardingStatus", "onboardingCompletedAt", "verifiedAt",
      "createdAt", "updatedAt",
    ],
  },
  riders: {
    label: "Riders",
    category: "People",
    collection: "riders",
    fields: [
      "_id", "riderCode", "type", "vehicleType", "isAvailable",
      "status", "onboardingStatus", "onboardingCompletedAt",
      "joinedAt", "createdAt", "updatedAt",
    ],
  },
  employees: {
    label: "Employees",
    category: "People",
    collection: "employees",
    fields: [
      "_id", "employeeCode", "department", "jobTitle",
      "employmentType", "status", "joiningDate", "leavingDate",
      "createdAt", "updatedAt",
    ],
  },

  // CATALOG
  products: {
    label: "Products",
    category: "Catalog",
    collection: "products",
    fields: [
      "_id", "name", "slug", "type", "status", "visibility", "sku",
      "barcode", "sellerId", "categoryId", "subcategoryId", "brandId",
      "price", "compareAtPrice", "salePrice", "currency",
      "trackInventory", "stockQuantity", "lowStockThreshold",
      "featured", "sortOrder", "createdAt", "updatedAt",
    ],
  },
  categories: {
    label: "Categories",
    category: "Catalog",
    collection: "categories",
    fields: [
      "_id", "name", "slug", "description", "status",
      "isFeatured", "sortOrder", "createdAt", "updatedAt",
    ],
  },
  brands: {
    label: "Brands",
    category: "Catalog",
    collection: "brands",
    fields: [
      "_id", "name", "slug", "description", "logo", "website",
      "status", "sortOrder", "createdAt", "updatedAt",
    ],
  },
  productVariants: {
    label: "Product Variants",
    category: "Catalog",
    collection: "productvariants",
    fields: [
      "_id", "productId", "title", "sku", "barcode", "options",
      "price", "compareAtPrice", "trackInventory", "stockQuantity",
      "lowStockThreshold", "status", "sortOrder", "createdAt", "updatedAt",
    ],
  },

  // INVENTORY & PROCUREMENT
  inventory: {
    label: "Stock",
    category: "Inventory & Procurement",
    collection: "inventories",
    fields: [
      "_id", "productId", "variantId", "warehouseId", "quantity",
      "reservedQuantity", "lowStockThreshold", "createdAt", "updatedAt",
    ],
  },
  warehouses: {
    label: "Warehouses",
    category: "Inventory & Procurement",
    collection: "warehouses",
    fields: [
      "_id", "name", "code", "description", "city", "state",
      "postalCode", "country", "status", "isDefault", "deactivatedAt",
      "createdAt", "updatedAt",
    ],
  },
  stockTransfers: {
    label: "Stock Transfers",
    category: "Inventory & Procurement",
    collection: "stocktransfers",
    fields: [
      "_id", "transferNumber", "productId", "variantId",
      "sourceWarehouseId", "destinationWarehouseId", "quantity",
      "status", "reason", "referenceType", "referenceId",
      "approvedAt", "dispatchedAt", "receivedAt", "cancelledAt",
      "rejectedAt", "createdAt", "updatedAt",
    ],
  },
  purchaseOrders: {
    label: "Purchase Orders",
    category: "Inventory & Procurement",
    collection: "purchases",
    fields: [
      "_id", "purchaseNumber", "supplierId", "warehouseId",
      "subtotal", "discountAmount", "taxAmount", "shippingCost",
      "grandTotal", "amountPaid", "amountDue", "paymentStatus",
      "status", "currency", "expectedDeliveryDate", "orderedAt",
      "approvedAt", "receivedAt", "cancelledAt", "referenceNumber",
      "createdAt", "updatedAt",
    ],
  },
  suppliers: {
    label: "Suppliers",
    category: "Inventory & Procurement",
    collection: "suppliers",
    fields: [
      "_id", "name", "code", "slug", "website", "paymentTermsDays",
      "creditLimit", "currency", "status", "tags",
      "address.city", "address.state", "address.postalCode",
      "address.country", "createdAt", "updatedAt",
    ],
  },

  // FINANCE
  payments: {
    label: "Payments",
    category: "Finance",
    collection: "payments",
    fields: [
      "_id", "transactionId", "referenceId", "orderId", "amount",
      "currency", "method", "provider", "status", "providerTransactionId",
      "failureCode", "paidAt", "expiresAt", "createdAt", "updatedAt",
    ],
  },
  transactions: {
    label: "Transactions",
    category: "Finance",
    collection: "transactions",
    fields: [
      "_id", "paymentId", "transactionId", "orderId", "type",
      "previousStatus", "status", "amount", "currency", "provider",
      "providerEventId", "correlationId", "createdAt",
    ],
  },
  refunds: {
    label: "Refunds",
    category: "Finance",
    collection: "refunds",
    fields: [
      "_id", "refundNumber", "orderId", "paymentId", "returnId",
      "amount", "currency", "reason", "status", "requestedAt",
      "processedAt", "failedAt", "cancelledAt", "createdAt", "updatedAt",
    ],
  },
  returns: {
    label: "Returns",
    category: "Orders & Sales",
    collection: "returnrequests",
    fields: [
      "_id", "returnNumber", "orderId", "status", "resolution",
      "requestedRefundAmount", "approvedRefundAmount", "currency",
      "receivedAt", "inspectedAt", "completedAt", "rejectedAt",
      "cancelledAt", "createdAt", "updatedAt",
    ],
  },
  accountingRecords: {
    label: "Accounting Records",
    category: "Finance",
    collection: "accountingrecords",
    dateField: "occurredAt",
    fields: [
      "_id", "type", "name", "amount", "currency", "occurredAt",
      "category", "accountId", "reference", "status",
      "approvedAt", "rejectedAt", "createdAt", "updatedAt",
    ],
  },
  chartOfAccounts: {
    label: "Chart of Accounts",
    category: "Finance",
    collection: "chartaccounts",
    fields: [
      "_id", "code", "name", "type", "parentId", "description",
      "isCashAccount", "cashFlowCategory", "isSystem", "isActive",
      "createdAt", "updatedAt",
    ],
  },
  journalEntries: {
    label: "Journal Entries",
    category: "Finance",
    collection: "journalentries",
    dateField: "entryDate",
    fields: [
      "_id", "entryNumber", "entryDate", "description",
      "referenceType", "referenceId", "currency", "totalDebit",
      "totalCredit", "status", "postedAt", "createdAt", "updatedAt",
    ],
  },
  riderEarnings: {
    label: "Rider Earnings",
    category: "Finance",
    collection: "riderearnings",
    dateField: "earningDate",
    fields: [
      "_id", "riderId", "orderId", "type", "amount", "currency",
      "status", "earningDate", "approvedAt", "paidAt", "cancelledAt",
      "createdAt", "updatedAt",
    ],
  },

  // DELIVERY & SHIPPING
  deliveries: {
    label: "Deliveries",
    category: "Delivery & Shipping",
    collection: "deliveries",
    fields: [
      "_id", "deliveryNumber", "orderId", "shipmentId", "riderId",
      "status", "city", "deliveryFee", "currency", "assignedAt",
      "acceptedAt", "pickedUpAt", "deliveredAt", "cancelledAt",
      "attemptCount", "createdAt", "updatedAt",
    ],
  },
  deliveryFees: {
    label: "Delivery Fees",
    category: "Delivery & Shipping",
    collection: "deliveryfees",
    fields: [
      "_id", "name", "slug", "description", "country", "state", "city",
      "deliveryZoneId", "deliveryMethodId", "method", "baseFee",
      "perKgFee", "freeDeliveryThreshold", "minimumOrderAmount",
      "minimumWeightKg", "maximumWeightKg", "supportsCOD", "priority",
      "status", "createdAt", "updatedAt",
    ],
  },
  deliveryZones: {
    label: "Delivery Zones",
    category: "Delivery & Shipping",
    collection: "deliveryzones",
    fields: [
      "_id", "name", "slug", "description", "country", "state", "city",
      "postalCodes", "deliveryFee", "freeDeliveryThreshold",
      "minimumOrderAmount", "estimatedDeliveryMinDays",
      "estimatedDeliveryMaxDays", "supportsCOD", "priority",
      "status", "createdAt", "updatedAt",
    ],
  },
  shipping: {
    label: "Shipping Records",
    category: "Delivery & Shipping",
    collection: "shippings",
    fields: [
      "_id", "shipmentNumber", "trackingNumber", "orderId", "riderId",
      "provider", "status", "shippingFee", "currency",
      "estimatedDeliveryAt", "shippedAt", "deliveredAt", "cancelledAt",
      "createdAt", "updatedAt",
    ],
  },

  // MARKETING & CRM
  coupons: {
    label: "Coupons",
    category: "Marketing & CRM",
    collection: "coupons",
    fields: [
      "_id", "code", "description", "discountType", "discountValue",
      "minimumOrderAmount", "maximumDiscountAmount", "usageLimit",
      "usageLimitPerUser", "usageCount", "startsAt", "expiresAt",
      "status", "createdAt", "updatedAt",
    ],
  },
  promotions: {
    label: "Promotions",
    category: "Marketing & CRM",
    collection: "promotions",
    fields: [
      "_id", "title", "slug", "description", "type", "value", "currency",
      "maxDiscountAmount", "minOrderAmount", "startsAt", "endsAt",
      "status", "applicableProductIds", "applicableCategoryIds",
      "usageLimit", "usageCount", "perUserLimit", "isStackable",
      "createdAt", "updatedAt",
    ],
  },
  reviews: {
    label: "Reviews",
    category: "Marketing & CRM",
    collection: "reviews",
    fields: [
      "_id", "productId", "orderId", "rating", "title", "status",
      "verifiedPurchase", "helpfulCount", "createdAt", "updatedAt",
    ],
  },
  rewardPointAccounts: {
    label: "Reward Point Accounts",
    category: "Marketing & CRM",
    collection: "rewardpointaccounts",
    fields: [
      "_id", "userId", "balance", "lifetimeEarned",
      "lifetimeRedeemed", "createdAt", "updatedAt",
    ],
  },
  rewardPointTransactions: {
    label: "Reward Point Transactions",
    category: "Marketing & CRM",
    collection: "rewardpointtransactions",
    fields: [
      "_id", "userId", "type", "points", "balanceAfter",
      "referenceId", "createdAt", "updatedAt",
    ],
  },
  loyaltyProgram: {
    label: "Loyalty Program",
    category: "Marketing & CRM",
    collection: "loyaltyprograms",
    fields: [
      "_id", "key", "name", "description", "enabled",
      "pointsPerCurrencyUnit", "minimumOrderAmount",
      "pointsExpiryDays", "createdAt", "updatedAt",
    ],
  },

  // ADMINISTRATION & OPERATIONS
  activityLogs: {
    label: "Activity Logs",
    category: "Administration & Operations",
    collection: "activitylogs",
    fields: [
      "_id", "actorType", "actorRole", "activityType", "action",
      "resource", "resourceId", "method", "createdAt",
    ],
  },
  systemLogs: {
    label: "System Logs",
    category: "Administration & Operations",
    collection: "systemlogs",
    fields: [
      "_id", "level", "source", "errorCode", "method", "createdAt",
    ],
  },
  webhookEvents: {
    label: "Webhook Events",
    category: "Administration & Operations",
    collection: "webhook_events",
    fields: [
      "_id", "provider", "eventId", "eventType", "status",
      "transactionId", "failureCode", "processedAt", "createdAt", "updatedAt",
    ],
  },
  exportHistory: {
    label: "Export History",
    category: "Administration & Operations",
    collection: "exportjobs",
    fields: [
      "_id", "jobId", "dataset", "format", "status", "progress",
      "rowCount", "fileName", "fileSize", "attemptsMade",
      "createdAt", "startedAt", "completedAt", "expiresAt",
    ],
  },
};

const mimeTypes: Record<ExportFormat, string> = {
  csv: "text/csv",
  json: "application/json",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const safeValue = (value: unknown): unknown => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return JSON.stringify(value.map((item) => safeValue(item)));
  }

  if (typeof value === "object") {
    const candidate = value as { toHexString?: () => string };

    if (typeof candidate.toHexString === "function") {
      return candidate.toHexString();
    }

    return JSON.stringify(value) ?? "";
  }

  return value;
};

const getPathValue = (
  source: Record<string, unknown>,
  path: string,
): unknown => {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
};

const csvEscape = (value: unknown): string => {
  let text = String(safeValue(value));

  // Protect spreadsheet users from CSV formula injection.
  if (/^[\x00-\x20]*(?:=|\+|-|@)/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

const exportProvider: ExportProviderAdapter = {
  name: "noptrix-export-provider",
  formats: ["csv", "json", "xlsx"],

  async export<T = unknown>(
    context: ExportProviderContext<T>,
  ): Promise<Buffer> {
    const rows = context.data as unknown as Record<string, unknown>[];

    if (context.format === "json") {
      return Buffer.from(JSON.stringify(rows, null, 2), "utf8");
    }

    const columns = context.columns ?? [];

    if (context.format === "csv") {
      const header = columns.map((column) => csvEscape(column.header)).join(",");
      const body = rows.map((row) =>
        columns.map((column) => {
          const value = column.accessor
            ? column.accessor(row as T)
            : (row as Record<string, unknown>)[column.key];
          return csvEscape(value);
        }).join(","),
      );
      return Buffer.from([header, ...body].join("\r\n"), "utf8");
    }

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(context.sheetName || "Export");

    sheet.columns = columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: Math.min(Math.max(column.header.length + 4, 14), 36),
    }));

    for (const row of rows) {
      const output: Record<string, unknown> = {};
      for (const column of columns) {
        output[column.key] = column.accessor
          ? column.accessor(row as T)
          : (row as Record<string, unknown>)[column.key];
      }
      sheet.addRow(output);
    }

    sheet.getRow(1).font = { bold: true };
    const result = await workbook.xlsx.writeBuffer();
    return Buffer.from(result);
  },
};

let providerRegistered = false;

const ensureProvider = (): void => {
  if (providerRegistered) return;
  registerExportProvider(exportProvider);
  providerRegistered = true;
};

export const getExportDatasetCatalog = () =>
  Object.entries(EXPORT_DATASETS).map(([key, value]) => ({
    key,
    label: value.label,
    category: value.category,
    formats: ["csv", "xlsx", "json"],
  }));

export const createExportJob = async (input: {
  dataset: string;
  format: ExportFormat;
  requestedBy: string;
  from?: string;
  to?: string;
}) => {
  const definition = EXPORT_DATASETS[input.dataset];

  if (!definition) {
    throw new Error("This export dataset is not currently supported.");
  }

  if (!["csv", "xlsx", "json"].includes(input.format)) {
    throw new Error("Unsupported export format.");
  }

  const from = input.from ? new Date(input.from) : undefined;
  const to = input.to ? new Date(input.to) : undefined;

  if (
    (from && Number.isNaN(from.getTime())) ||
    (to && Number.isNaN(to.getTime())) ||
    (from && to && from > to)
  ) {
    throw new Error("Invalid export date range.");
  }

  const jobId = crypto.randomUUID();

  await ExportJob.create({
    jobId,
    dataset: input.dataset,
    format: input.format,
    status: "PENDING",
    progress: 0,
    requestedBy: input.requestedBy,
    filters: { from, to },
  });

  try {
    await getExportQueue().add(
      "export.generate",
      { exportJobId: jobId },
      { jobId },
    );
  } catch (error) {
    await ExportJob.updateOne(
      { jobId },
      {
        $set: {
          status: "FAILED",
          errorMessage: "Unable to enqueue export job.",
        },
      },
    );
    throw error;
  }

  return ExportJob.findOne({ jobId }).lean();
};

export const getExportJobs = async (query: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 25));
  const filter: Record<string, unknown> = {};

  if (query.search?.trim()) {
    const search = query.search
      .trim()
      .slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    filter.$or = [
      { dataset: { $regex: search, $options: "i" } },
      { fileName: { $regex: search, $options: "i" } },
      { jobId: { $regex: search, $options: "i" } },
      { status: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    ExportJob.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ExportJob.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => ({
      _id: item._id,
      jobId: item.jobId,
      dataset: item.dataset,
      format: item.format,
      status: item.status,
      progress: item.progress,
      requestedBy: item.requestedBy,
      rowCount: item.rowCount,
      fileName: item.fileName,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      errorMessage: item.errorMessage,
      attemptsMade: item.attemptsMade,
      createdAt: item.createdAt,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      expiresAt: item.expiresAt,
      downloadAvailable:
        item.status === "COMPLETED" &&
        !!item.cloudinaryPublicId &&
        (!item.expiresAt || item.expiresAt > new Date()),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getExportDownloadUrl = async (jobId: string) => {
  const job = await ExportJob.findOne({ jobId });

  if (!job || job.status !== "COMPLETED" || !job.cloudinaryPublicId) {
    throw new Error("Export file is not available.");
  }

  if (job.expiresAt && job.expiresAt <= new Date()) {
    throw new Error("Export file has expired.");
  }

  return createPrivateCloudinaryDownloadUrl(
    job.cloudinaryPublicId,
    job.cloudinaryFormat || job.format,
    "raw",
  );
};

export const retryExportJob = async (jobId: string) => {
  const record = await ExportJob.findOne({ jobId });

  if (!record) throw new Error("Export job not found.");
  if (record.status !== "FAILED") {
    throw new Error("Only failed export jobs can be retried.");
  }

  if (record.cloudinaryPublicId) {
    await deleteFromCloudinary(
      record.cloudinaryPublicId,
      "raw",
      "authenticated",
    );
  }

  record.status = "PENDING";
  record.progress = 0;
  record.errorMessage = undefined;
  record.attemptsMade = 0;
  record.startedAt = undefined;
  record.completedAt = undefined;
  record.expiresAt = undefined;
  record.rowCount = 0;
  record.fileName = undefined;
  record.mimeType = undefined;
  record.fileSize = undefined;
  record.checksum = undefined;
  record.cloudinaryPublicId = undefined;
  record.cloudinaryFormat = undefined;

  await record.save();

  try {
    await getExportQueue().add(
      "export.generate",
      { exportJobId: jobId },
      { jobId: `${jobId}-${Date.now()}` },
    );
  } catch (error) {
    record.status = "FAILED";
    record.errorMessage =
      error instanceof Error
        ? `Queue submission failed: ${error.message}`.slice(0, 1000)
        : "Queue submission failed.";
    await record.save();
    throw error;
  }

  return record.toObject();
};

export const processExportJob = async (jobId: string): Promise<void> => {
  const record = await ExportJob.findOne({ jobId });

  if (!record) throw new Error("Export job record not found.");

  const definition = EXPORT_DATASETS[record.dataset];

  if (!definition) throw new Error("Export dataset is no longer supported.");

  ensureProvider();

  record.status = "PROCESSING";
  record.progress = 5;
  record.startedAt = new Date();
  record.attemptsMade += 1;
  await record.save();

  const collection = mongoose.connection.collection(definition.collection);

  const mongoFilter: Record<string, unknown> = {
    ...(definition.staticFilter ?? {}),
  };

  const dateField = definition.dateField ?? "createdAt";

  if (record.filters?.from || record.filters?.to) {
    const range: Record<string, Date> = {};
    if (record.filters.from) range.$gte = record.filters.from;
    if (record.filters.to) range.$lte = record.filters.to;
    mongoFilter[dateField] = range;
  }

  const projection = Object.fromEntries(
    definition.fields.map((field) => [field, 1]),
  );

  const rows = await collection
    .find(mongoFilter, { projection })
    .sort({ [dateField]: -1 })
    .limit(MAX_EXPORT_ROWS)
    .toArray();

  record.progress = 35;
  await record.save();

  const columns = definition.fields.map((field) => ({
    key: field,
    header: field
      .split(".")
      .join(" ")
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]/g, " "),
    accessor: (row: Record<string, unknown>) =>
      safeValue(getPathValue(row, field)),
  }));

  const document = await generateExport({
    data: rows as Record<string, unknown>[],
    format: record.format,
    columns,
    fileName: `noptrix-${record.dataset}-${jobId}.${record.format}`,
    sheetName: definition.label.slice(0, 31),
    title: definition.label,
    metadata: {
      exportJobId: jobId,
      dataset: record.dataset,
      generatedAt: new Date().toISOString(),
    },
  });

  record.progress = 75;
  await record.save();

  const uploaded = await uploadBufferToCloudinary(
    {
      buffer: document.data,
      filename: document.fileName,
      mimeType: mimeTypes[record.format],
    },
    {
      folder: "noptrix/exports",
      resourceType: "raw",
      accessMode: "authenticated",
      useUniqueFilename: false,
      overwrite: true,
      publicId: `export-${jobId}`,
      tags: ["noptrix-export", record.dataset],
    },
  );

  record.status = "COMPLETED";
  record.progress = 100;
  record.rowCount = document.rowCount;
  record.fileName = document.fileName;
  record.mimeType = document.mimeType;
  record.fileSize = document.size;
  record.checksum = document.checksum;
  record.cloudinaryPublicId = uploaded.publicId;
  record.cloudinaryFormat = uploaded.format || record.format;
  record.completedAt = new Date();
  record.expiresAt = new Date(
    Date.now() + FILE_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  await record.save();
};
