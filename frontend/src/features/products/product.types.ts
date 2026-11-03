export type ProductType = "SIMPLE" | "VARIABLE" | "DIGITAL" | "SERVICE";

export type ProductStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type ProductVisibility = "VISIBLE" | "HIDDEN";

export type InventoryPolicy = "DENY" | "CONTINUE";

export interface ProductSEO {
  title?: string;
  description?: string;
  keywords?: string[];
  canonicalUrl?: string;
}

export interface ProductShipping {
  required: boolean;
  weight?: number;
  weightUnit?: "g" | "kg";
  length?: number;
  width?: number;
  height?: number;
  dimensionUnit?: "cm" | "m";
}

export interface ProductReference {
  _id: string;
  name: string;
  slug?: string;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  type: ProductType;
  status: ProductStatus;
  visibility?: ProductVisibility;
  publishAt?: string | null;
  publishedAt?: string;
  sku?: string;
  barcode?: string;
  sellerId?: string;
  categoryId: ProductReference | string;
  subcategoryId?: ProductReference | string;
  brandId?: ProductReference | string;
  collectionIds?: Array<ProductReference | string>;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  salePrice?: number;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  currency?: string;
  trackInventory?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
  inventoryPolicy?: InventoryPolicy;
  requiresShipping?: boolean;
  shipping?: ProductShipping;
  tags?: string[];
  attributes?: Record<string, unknown>;
  seo?: ProductSEO;
  featured?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string;
}

export interface ProductInput {
  name: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  type?: ProductType;
  status?: ProductStatus;
  visibility?: ProductVisibility;
  publishAt?: string | null;
  sku?: string;
  barcode?: string;
  sellerId?: string;
  categoryId: string;
  subcategoryId?: string;
  brandId?: string;
  collectionIds?: string[];
  tagIds?: string[];
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  salePrice?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  currency?: string;
  trackInventory?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
  inventoryPolicy?: InventoryPolicy;
  inventoryWarehouseId?: string;
  requiresShipping?: boolean;
  shipping?: ProductShipping;
  tags?: string[];
  attributes?: Record<string, unknown>;
  seo?: ProductSEO;
  featured?: boolean;
  sortOrder?: number;
}

export type ProductUpdateInput = Partial<
  Omit<ProductInput, "stockQuantity" | "inventoryWarehouseId">
>;

export interface ProductFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProductStatus;
  type?: ProductType;
  categoryId?: string;
  subcategoryId?: string;
  brandId?: string;
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
  inStock?: boolean;
  sortBy?: "createdAt" | "updatedAt" | "name" | "price" | "sortOrder";
  sortOrder?: "asc" | "desc";
}

export interface ProductPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ProductListResponse {
  items: Product[];
  pagination: ProductPagination;
}

export interface ProductOption {
  _id: string;
  name: string;
  slug?: string;
  categoryId?: string | ProductReference;
}
