import apiClient from "./client";
import type { ApiResponse } from "@/types/api";

import type {
  ProductVariant,
  VariantInput,
  VariantListParams,
  VariantListResult,
  ProductListResult,
  VariableProduct,
} from "@/features/product-variants/variant.types";

export const productVariantsAdminApi = {
  async getProduct(productId: string): Promise<VariableProduct> {
    const response = await apiClient.get<ApiResponse<VariableProduct>>(
      `/products/${productId}`,
    );

    return response.data.data;
  },

  async getVariableProducts(): Promise<ProductListResult> {
    const response = await apiClient.get<ApiResponse<ProductListResult>>(
      "/products",
      {
        params: {
          type: "VARIABLE",
          limit: 100,
          page: 1,
          sortBy: "name",
          sortOrder: "asc",
        },
      },
    );

    return response.data.data;
  },

  async getAll(
    productId: string,
    params?: VariantListParams,
  ): Promise<VariantListResult> {
    const response = await apiClient.get<ApiResponse<VariantListResult>>(
      `/product-variants/${productId}`,
      { params },
    );

    return response.data.data;
  },

  async getById(
    productId: string,
    variantId: string,
  ): Promise<ProductVariant> {
    const response = await apiClient.get<ApiResponse<ProductVariant>>(
      `/product-variants/${productId}/${variantId}`,
    );

    return response.data.data;
  },

  async create(
    productId: string,
    input: VariantInput,
  ): Promise<ProductVariant> {
    const response = await apiClient.post<ApiResponse<ProductVariant>>(
      `/product-variants/${productId}`,
      input,
    );

    return response.data.data;
  },

  async update(
    productId: string,
    variantId: string,
    input: Partial<VariantInput>,
  ): Promise<ProductVariant> {
    const response = await apiClient.patch<ApiResponse<ProductVariant>>(
      `/product-variants/${productId}/${variantId}`,
      input,
    );

    return response.data.data;
  },

  async deactivate(
    productId: string,
    variantId: string,
  ): Promise<void> {
    await apiClient.delete(
      `/product-variants/${productId}/${variantId}`,
    );
  },
};
