export type ReceiptStatus = "ISSUED" | "VOID";

export interface ReceiptLineItem {
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptSnapshot {
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  items: ReceiptLineItem[];
}

export interface Receipt {
  _id: string;
  receiptNumber: string;
  orderId: string;
  userId: string;
  paymentId?: string | null;
  status: ReceiptStatus;
  snapshot: ReceiptSnapshot;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptListQuery {
  page?: number;
  limit?: number;
  status?: ReceiptStatus;
}

export interface ReceiptPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReceiptListResult {
  items: Receipt[];
  pagination: ReceiptPagination;
}

export interface ReceiptListResponse {
  success: boolean;
  data: ReceiptListResult | Receipt[];
  message?: string;
}

export interface ReceiptDetailsResponse {
  success: boolean;
  data: Receipt;
  message?: string;
}
