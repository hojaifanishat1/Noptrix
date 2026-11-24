import apiClient from "@/services/api/client";

export type PaymentMethodId = "cod" | "online";

export interface AdminPaymentMethod {
  methodId: PaymentMethodId;
  name: string;
  enabled: boolean;
  displayOrder: number;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export const paymentMethodsAdminApi = {
  async list(includeDisabled = true): Promise<AdminPaymentMethod[]> {
    const response = await apiClient.get("/payment-methods/admin", {
      params: { includeDisabled },
    });

    return response.data?.data?.methods ?? [];
  },

  async update(
    methodId: PaymentMethodId,
    input: {
      enabled: boolean;
      displayOrder?: number;
      description?: string;
    },
  ): Promise<AdminPaymentMethod> {
    const response = await apiClient.patch(
      `/payment-methods/admin/${methodId}`,
      input,
    );

    return response.data?.data?.method;
  },
};
