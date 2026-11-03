export const VARIANT_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type VariantStatus = (typeof VARIANT_STATUSES)[number];

export interface ProductOption {
  [key: string]: string;
}

export interface ProductVariant {
  _id: string;
  productId: string;
  title: string;
  sku?: string;
  barcode?: string;
  options: ProductOption;
  price?: number;
  compareAtPrice?: number;
  costPrice?: number;
  trackInventory: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  status: VariantStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface VariantInput {
  title: string;
  sku?: string;
  barcode?: string;
  options: ProductOption;
  price?: number;
  compareAtPrice?: number;
  costPrice?: number;
  trackInventory?: boolean;
  lowStockThreshold?: number;
  status?: VariantStatus;
  sortOrder?: number;
}

export interface VariantListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: VariantStatus;
  sortBy?: "title" | "price" | "stockQuantity" | "sortOrder" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface VariantPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface VariantListResult {
  items: ProductVariant[];
  pagination: VariantPagination;
}

export interface VariableProduct {
  _id: string;
  name: string;
  slug: string;
  sku?: string;
  type: "VARIABLE";
  status: string;
}

export interface ProductListResult {
  items: VariableProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
