export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PAID"
  | "VOID"
  | "OVERDUE";

export interface InvoiceLine {
  description: string;
  productId?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  total: number;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  orderId?: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  currency: string;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  status: InvoiceStatus;
  issuedAt?: string | null;
  dueAt?: string | null;
  paidAt?: string | null;
  voidedAt?: string | null;
  billingAddress?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvoiceStatus;
  customerId?: string;
}

export interface InvoicePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreateInvoiceInput {
  orderId?: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  currency: string;
  lines: Array<{
    description: string;
    productId?: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    taxAmount?: number;
  }>;
  discountAmount?: number;
  taxAmount?: number;
  shippingAmount?: number;
  dueAt?: string | null;
  billingAddress?: Record<string, unknown>;
  notes?: string;
}

export interface InvoiceListResponse {
  success: boolean;
  data: Invoice[];
  pagination: InvoicePagination;
}

export interface InvoiceDetailsResponse {
  success: boolean;
  data: Invoice;
}

export interface InvoiceMutationResponse {
  success: boolean;
  message: string;
  data: Invoice;
}
