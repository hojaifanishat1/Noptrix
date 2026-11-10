import apiClient from "@/services/api/client";

import type {
  CreateInvoiceInput,
  InvoiceListQuery,
  InvoiceListResponse,
  InvoiceDetailsResponse,
  InvoiceMutationResponse,
} from "@/features/invoices/invoice.types";

const BASE_URL = "/invoices";

export const invoicesApi = {
  async getInvoices(params: InvoiceListQuery = {}) {
    const response = await apiClient.get<InvoiceListResponse>(
      BASE_URL,
      { params },
    );
    return response.data;
  },

  async getInvoice(invoiceId: string) {
    const response = await apiClient.get<InvoiceDetailsResponse>(
      `${BASE_URL}/${invoiceId}`,
    );
    return response.data;
  },

  async createInvoice(input: CreateInvoiceInput) {
    const response = await apiClient.post<InvoiceMutationResponse>(
      BASE_URL,
      input,
    );
    return response.data;
  },

  async updateStatus(
    invoiceId: string,
    status: "ISSUED" | "VOID",
  ) {
    const response = await apiClient.patch<InvoiceMutationResponse>(
      `${BASE_URL}/${invoiceId}/status`,
      { status },
    );
    return response.data;
  },
};
