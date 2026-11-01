import apiClient from "./client";
import type { ApiResponse } from "@/types/api";

import type {
  ImageUpdateInput,
  ImageUploadInput,
  ProductImage,
  ProductImageListResult,
  ProductListResult,
  VariableProduct,
} from "@/features/product-images/image.types";

export const productImagesAdminApi = {
  async getProduct(productId: string): Promise<VariableProduct> {
    const response = await apiClient.get<ApiResponse<VariableProduct>>(
      `/products/${productId}`,
    );

    return response.data.data;
  },

  async getProducts(): Promise<ProductListResult> {
    const response = await apiClient.get<ApiResponse<ProductListResult>>(
      "/products",
      {
        params: {
          page: 1,
          limit: 100,
          sortBy: "name",
          sortOrder: "asc",
        },
      },
    );

    return response.data.data;
  },

  async getAll(
    productId: string,
    page = 1,
    limit = 20,
  ): Promise<ProductImageListResult> {
    const response = await apiClient.get<
      ApiResponse<ProductImageListResult>
    >(`/product-images/${productId}`, {
      params: { page, limit },
    });

    return response.data.data;
  },

  async getById(
    productId: string,
    imageId: string,
  ): Promise<ProductImage> {
    const response = await apiClient.get<ApiResponse<ProductImage>>(
      `/product-images/${productId}/${imageId}`,
    );

    return response.data.data;
  },

  async upload(
    productId: string,
    input: ImageUploadInput,
  ): Promise<ProductImage[]> {
    const formData = new FormData();

    input.files.forEach((file) => {
      formData.append("images", file);
    });

    if (input.alt !== undefined) {
      formData.append("alt", input.alt);
    }

    if (input.primaryIndex !== undefined) {
      formData.append("primaryIndex", String(input.primaryIndex));
    }

    const response = await apiClient.post<ApiResponse<ProductImage[]>>(
      `/product-images/${productId}`,
      formData,
    );

    return response.data.data;
  },

  async update(
    productId: string,
    imageId: string,
    input: ImageUpdateInput,
  ): Promise<ProductImage> {
    const response = await apiClient.patch<ApiResponse<ProductImage>>(
      `/product-images/${productId}/${imageId}`,
      input,
    );

    return response.data.data;
  },

  async delete(
    productId: string,
    imageId: string,
  ): Promise<{
    id: string;
    deleted: boolean;
    nextPrimaryImageId: string | null;
    storageCleanupPending: boolean;
  }> {
    const response = await apiClient.delete<
      ApiResponse<{
        id: string;
        deleted: boolean;
        nextPrimaryImageId: string | null;
        storageCleanupPending: boolean;
      }>
    >(`/product-images/${productId}/${imageId}`);

    return response.data.data;
  },
};
