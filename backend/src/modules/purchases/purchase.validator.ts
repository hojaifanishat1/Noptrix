import { z } from "zod";
import { PURCHASE_PAYMENT_STATUSES, PURCHASE_STATUSES } from "./purchase.types";

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid MongoDB ObjectId.");

const moneySchema = z.number().finite().min(0).max(1_000_000_000);

const quantitySchema = z.number().int().positive().max(1_000_000);

const purchaseItemSchema = z
  .object({
    productId: objectIdSchema.optional(),
    productName: z.string().trim().min(2).max(250).optional(),
    sku: z.string().trim().min(1).max(100).optional(),
    variantId: objectIdSchema.optional(),
    quantity: quantitySchema,
    unitCost: moneySchema,
    discountAmount: moneySchema.optional().default(0),
    taxRate: z.number().finite().min(0).max(100).optional().default(0),
  })
  .strict()
  .refine(
    (item) => Boolean(item.productId) !== Boolean(item.productName?.trim()),
    {
      message: "Select a catalog product or enter a new product name.",
      path: ["productId"],
    },
  )
  .refine((item) => !item.variantId || Boolean(item.productId), {
    message: "A variant must belong to a catalog product.",
    path: ["variantId"],
  });

const purchaseFields = {
  supplierId: objectIdSchema,
  warehouseId: objectIdSchema,
  items: z.array(purchaseItemSchema).min(1).max(500),
  discountAmount: moneySchema.optional().default(0),
  shippingCost: moneySchema.optional().default(0),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .optional(),
  expectedDeliveryDate: z.coerce.date().optional(),
  notes: z.string().trim().max(5000).optional(),
  referenceNumber: z.string().trim().max(100).optional(),
};

export const createPurchaseSchema = z.object(purchaseFields).strict();

export const updatePurchaseSchema = z
  .object({
    supplierId: purchaseFields.supplierId.optional(),
    warehouseId: purchaseFields.warehouseId.optional(),
    items: purchaseFields.items.optional(),
    discountAmount: moneySchema.optional(),
    shippingCost: moneySchema.optional(),
    currency: purchaseFields.currency,
    expectedDeliveryDate: purchaseFields.expectedDeliveryDate,
    notes: purchaseFields.notes,
    referenceNumber: purchaseFields.referenceNumber,
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field must be provided.",
  });

export const purchaseIdSchema = z.object({
  id: objectIdSchema,
});

export const purchaseItemProductParamsSchema = z.object({
  id: objectIdSchema,
  itemId: objectIdSchema,
});

export const linkPurchaseItemProductSchema = z
  .object({
    productId: objectIdSchema,
    variantId: objectIdSchema.optional(),
  })
  .strict();

export const purchaseQuerySchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    supplierId: objectIdSchema.optional(),
    warehouseId: objectIdSchema.optional(),
    status: z.enum(PURCHASE_STATUSES).optional(),
    paymentStatus: z.enum(PURCHASE_PAYMENT_STATUSES).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z
      .enum(["purchaseNumber", "createdAt", "grandTotal", "status"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()
  .refine(
    (data) =>
      !data.startDate || !data.endDate || data.startDate <= data.endDate,
    {
      message: "startDate must be before or equal to endDate.",
      path: ["startDate"],
    },
  );

export const receivePurchaseSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: objectIdSchema,
            variantId: objectIdSchema.optional(),
            quantity: quantitySchema,
          })
          .strict(),
      )
      .min(1)
      .max(500),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

export const recordPurchasePaymentSchema = z
  .object({
    amount: z.number().finite().positive().max(1_000_000_000),
    method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"]),
    referenceNumber: z.string().trim().max(100).optional(),
    paidAt: z.coerce.date().optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

export const approvePurchaseSchema = z
  .object({
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

export const orderPurchaseSchema = z
  .object({
    expectedDeliveryDate: z.coerce.date().optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

export const cancelPurchaseSchema = z
  .object({
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();

export type CreatePurchaseBody = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseBody = z.infer<typeof updatePurchaseSchema>;
export type PurchaseQuery = z.infer<typeof purchaseQuerySchema>;
export type ReceivePurchaseBody = z.infer<typeof receivePurchaseSchema>;
export type RecordPurchasePaymentBody = z.infer<
  typeof recordPurchasePaymentSchema
>;
export type ApprovePurchaseBody = z.infer<typeof approvePurchaseSchema>;
export type OrderPurchaseBody = z.infer<typeof orderPurchaseSchema>;
export type CancelPurchaseBody = z.infer<typeof cancelPurchaseSchema>;

export const purchaseNumberSchema = z.object({
  purchaseNumber: z
    .string()
    .trim()
    .min(1, "Purchase number is required.")
    .max(64, "Purchase number is too long."),
});
