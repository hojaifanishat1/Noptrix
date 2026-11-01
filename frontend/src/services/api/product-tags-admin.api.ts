import apiClient from "./client";
import type { ApiResponse } from "@/types/api";

import type {
  ProductTag,
  ProductTagAssignment,
  ProductTagInput,
  ProductTagListResult,
  ProductTagProductListResult,
  ProductTagProduct,
  ProductTagQuery,
  ProductTagUpdateInput,
} from "@/features/product-tags/tag.types";

export const productTagsAdminApi = {
  async getProduct(productId: string): Promise<ProductTagProduct> {
    const response = await apiClient.get<ApiResponse<ProductTagProduct>>(
      `/products/${productId}`,
    );

    return response.data.data;
  },

  async getAll(
    params: ProductTagQuery = {},
  ): Promise<ProductTagListResult> {
    const response = await apiClient.get<ApiResponse<ProductTagListResult>>(
      "/product-tags",
      { params },
    );

    return response.data.data;
  },

  async getById(id: string): Promise<ProductTag> {
    const result = await this.getAll({ page: 1, limit: 100 });
    const tag = result.items.find((item) => item._id === id);

    if (!tag) throw new Error("Product tag not found.");

    return tag;
  },

  async create(input: ProductTagInput): Promise<ProductTag> {
    const response = await apiClient.post<ApiResponse<ProductTag>>(
      "/product-tags",
      input,
    );

    return response.data.data;
  },

  async update(
    id: string,
    input: ProductTagUpdateInput,
  ): Promise<ProductTag> {
    const response = await apiClient.patch<ApiResponse<ProductTag>>(
      `/product-tags/${id}`,
      input,
    );

    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/product-tags/${id}`);
  },

  async assign(productId: string, tagId: string): Promise<ProductTagAssignment> {
    const response = await apiClient.post<ApiResponse<ProductTagAssignment>>(
      "/product-tags/assign",
      { productId, tagId },
    );

    return response.data.data;
  },

  async getProductTags(
    productId: string,
  ): Promise<ProductTagAssignment[]> {
    const response = await apiClient.get<
      ApiResponse<ProductTagAssignment[]>
    >(`/product-tags/product/${productId}`);

    return response.data.data;
  },

  async unassign(productId: string, tagId: string): Promise<void> {
    await apiClient.delete(
      `/product-tags/product/${productId}/tag/${tagId}`,
    );
  },

  async getProducts(): Promise<ProductTagProductListResult> {
    const response = await apiClient.get<
      ApiResponse<ProductTagProductListResult>
    >("/products", {
      params: {
        page: 1,
        limit: 100,
        sortBy: "name",
        sortOrder: "asc",
      },
    });

    return response.data.data;
  },
};
