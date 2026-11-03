export type SupplierStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface SupplierAddress {
  street?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface SupplierContactPerson {
  name?: string;
  email?: string;
  phone?: string;
  designation?: string;
}

export interface Supplier {
  _id: string;
  name: string;
  code: string;
  slug: string;
  email?: string;
  phone: string;
  alternatePhone?: string;
  website?: string;
  taxId?: string;
  registrationNumber?: string;
  address: SupplierAddress;
  contactPerson?: SupplierContactPerson;
  paymentTermsDays: number;
  creditLimit: number;
  currency: "BDT";
  status: SupplierStatus;
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInput {
  name: string;
  code?: string;
  email?: string;
  phone: string;
  alternatePhone?: string;
  website?: string;
  taxId?: string;
  registrationNumber?: string;
  address: SupplierAddress;
  contactPerson?: SupplierContactPerson;
  paymentTermsDays?: number;
  creditLimit?: number;
  currency: "BDT";
  notes?: string;
  tags?: string[];
}

export type SupplierUpdateInput = Partial<Omit<SupplierInput, "code">>;

export interface SupplierFilters {
  search?: string;
  status?: SupplierStatus | "";
  city?: string;
  country?: string;
  tags?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "code" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface SupplierPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SupplierListResult {
  items: Supplier[];
  pagination: SupplierPagination;
}

export interface SupplierSummary {
  total?: number;
  active?: number;
  inactive?: number;
  suspended?: number;
}
