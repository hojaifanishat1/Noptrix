
export const SELLER_OPPORTUNITY_STATUSES = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  PAUSED: "PAUSED",
  CLOSED: "CLOSED",
} as const;

export type SellerOpportunityStatus =
  (typeof SELLER_OPPORTUNITY_STATUSES)[keyof typeof SELLER_OPPORTUNITY_STATUSES];

export const SELLER_OPPORTUNITY_VISIBILITIES = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
} as const;

export type SellerOpportunityVisibility =
  (typeof SELLER_OPPORTUNITY_VISIBILITIES)[keyof typeof SELLER_OPPORTUNITY_VISIBILITIES];

export const SELLER_OPPORTUNITY_FIELD_TYPES = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "EMAIL",
  "PHONE",
  "URL",
  "DATE",
  "SELECT",
  "MULTI_SELECT",
  "CHECKBOX",
] as const;

export type SellerOpportunityFieldType =
  (typeof SELLER_OPPORTUNITY_FIELD_TYPES)[number];

export interface SellerOpportunityFormField {
  key: string;
  label: string;
  type: SellerOpportunityFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  maxLength?: number;
}

export interface SellerOpportunityDocumentRequirement {
  key: string;
  label: string;
  required: boolean;
  acceptedMimeTypes: string[];
  maxSizeMB: number;
}

export interface SellerOpportunity {
  _id: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  category: string;
  targetSellerCount: number;
  eligibility: string[];
  requiredDocuments: SellerOpportunityDocumentRequirement[];
  applicationForm: SellerOpportunityFormField[];
  applicationDeadline?: string;
  visibility: SellerOpportunityVisibility;
  status: SellerOpportunityStatus;
  publishedAt?: string;
  closedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SellerOpportunityPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SellerOpportunityListResult {
  opportunities: SellerOpportunity[];
  pagination: SellerOpportunityPagination;
}

export interface SellerOpportunityQuery {
  page?: number;
  limit?: number;
  status?: SellerOpportunityStatus;
  visibility?: SellerOpportunityVisibility;
  category?: string;
  search?: string;
}

export interface CreateSellerOpportunityInput {
  title: string;
  slug?: string;
  summary: string;
  description: string;
  category: string;
  targetSellerCount: number;
  eligibility: string[];
  requiredDocuments: SellerOpportunityDocumentRequirement[];
  applicationForm: SellerOpportunityFormField[];
  applicationDeadline?: string;
  visibility: SellerOpportunityVisibility;
}

export type UpdateSellerOpportunityInput =
  Partial<CreateSellerOpportunityInput>;
