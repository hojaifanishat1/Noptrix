import type { ApiResponse } from "@/types/api";
import apiClient from "@/services/api/client";

import type {
  DeliveryListResult,
  DeliveryRecord,
} from "@/features/delivery/delivery.types";

import type { DeliveryZone } from "@/features/delivery-zones/delivery-zone.types";
import type { DeliveryFeeRule } from "@/features/delivery-fees/delivery-fee.types";
import type {
  ShippingRecord,
  TrackingResult,
} from "@/features/shipping/shipping.types";

export interface ActiveRiderOption {
  _id: string;
  riderCode: string;
  name: string;
  phone?: string;
  vehicleType?: string;
  status: string;
}

export interface DeliveryAreaRecord {
  _id: string;
  zoneId: string | { _id: string; name?: string };
  name: string;
  slug: string;
  description?: string;
  city: string;
  state?: string;
  postalCodes: string[];
  center?: { latitude: number; longitude: number };
  boundary?: { type: "Polygon"; coordinates: number[][][] };
  status: "ACTIVE" | "INACTIVE";
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryMethodRecord {
  _id: string;
  code: string;
  name: string;
  description?: string;
  estimatedMinMinutes: number;
  estimatedMaxMinutes: number;
  maximumDistanceKm?: number;
  requiresLiveRider: boolean;
  requiresAreaCoverage: boolean;
  status: "ACTIVE" | "INACTIVE";
  priority: number;
}

export interface AreaFeeOverrideRecord {
  _id: string;
  areaId: string | { _id: string; name?: string };
  methodId?: string | { _id: string; name?: string };
  fee: number;
  freeDeliveryThreshold?: number;
  minimumOrderAmount: number;
  currency: string;
  status: "ACTIVE" | "INACTIVE";
  priority: number;
  validFrom?: string;
  validUntil?: string;
}

export interface DeliveryEligibilityInput {
  country: string;
  city: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  orderAmount: number;
  paymentMethod: "cod" | "online";
  methodCode?: string;
}

interface ListResponse<T> {
  success?: boolean;
  data?: T[] | {
    items?: T[];
    pagination?: DeliveryListResult<T>["pagination"];
  };
  pagination?: DeliveryListResult<T>["pagination"];
  meta?: DeliveryListResult<T>["pagination"];
}

const emptyPagination = (page: number, limit: number) => ({
  page,
  limit,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
});

async function listResource<T>(
  path: string,
  params: Record<string, unknown>,
): Promise<DeliveryListResult<T>> {
  const response = await apiClient.get<ListResponse<T>>(path, { params });
  const payload = response.data.data;

  const items = Array.isArray(payload)
    ? payload
    : payload?.items ?? [];

  const pagination =
    response.data.pagination ??
    response.data.meta ??
    (!Array.isArray(payload) ? payload?.pagination : undefined);

  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 20);

  return {
    items,
    pagination: pagination ?? {
      ...emptyPagination(page, limit),
      total: items.length,
      totalPages: items.length ? 1 : 0,
    },
  };
}

async function getOne<T>(path: string): Promise<T> {
  const response = await apiClient.get<ApiResponse<T>>(path);
  return response.data.data;
}

async function createOne<T>(
  path: string,
  input: Record<string, unknown>,
): Promise<T> {
  const response = await apiClient.post<ApiResponse<T>>(path, input);
  return response.data.data;
}

async function updateOne<T>(
  path: string,
  input: Record<string, unknown>,
): Promise<T> {
  const response = await apiClient.patch<ApiResponse<T>>(path, input);
  return response.data.data;
}

async function removeOne(path: string): Promise<void> {
  await apiClient.delete(path);
}

async function setStatus<T>(
  path: string,
  status: string,
): Promise<T> {
  return updateOne<T>(path, { status });
}

export const deliveryAdminApi = {
  riders: {
    async getActive(search = ""): Promise<ActiveRiderOption[]> {
      const response = await apiClient.get<
        ApiResponse<{ riders: ActiveRiderOption[] }>
      >("/riders", {
        params: {
          status: "ACTIVE",
          page: 1,
          limit: 100,
          search: search.trim() || undefined,
        },
      });

      return response.data.data.riders ?? [];
    },
  },

  deliveries: {
    list: (params: Record<string, unknown>) =>
      listResource<DeliveryRecord>("/delivery", params),
    get: (id: string) => getOne<DeliveryRecord>(`/delivery/${id}`),
    create: (input: Record<string, unknown>) =>
      createOne<DeliveryRecord>("/delivery", input),
    assignRider: (id: string, riderId: string) =>
      updateOne<DeliveryRecord>(`/delivery/${id}/assign-rider`, { riderId }),
    updateStatus: (id: string, input: Record<string, unknown>) =>
      updateOne<DeliveryRecord>(`/delivery/${id}/status`, input),
    cancel: (id: string, reason: string) =>
      updateOne<DeliveryRecord>(`/delivery/${id}/cancel`, { reason }),
  },

  zones: {
    list: (params: Record<string, unknown>) =>
      listResource<DeliveryZone>("/delivery-zones", params),
    get: (id: string) => getOne<DeliveryZone>(`/delivery-zones/${id}`),
    create: (input: Record<string, unknown>) =>
      createOne<DeliveryZone>("/delivery-zones", input),
    update: (id: string, input: Record<string, unknown>) =>
      updateOne<DeliveryZone>(`/delivery-zones/${id}`, input),
    setStatus: (id: string, status: "active" | "inactive") =>
      setStatus<DeliveryZone>(`/delivery-zones/${id}/status`, status),
    remove: (id: string) => removeOne(`/delivery-zones/${id}`),
    check: async (params: Record<string, unknown>) => {
      const response = await apiClient.get<ApiResponse<unknown>>(
        "/delivery-zones/check",
        { params },
      );
      return response.data.data;
    },
  },

  fees: {
    list: (params: Record<string, unknown>) =>
      listResource<DeliveryFeeRule>("/delivery-fees", params),
    get: (id: string) => getOne<DeliveryFeeRule>(`/delivery-fees/${id}`),
    create: (input: Record<string, unknown>) =>
      createOne<DeliveryFeeRule>("/delivery-fees", input),
    update: (id: string, input: Record<string, unknown>) =>
      updateOne<DeliveryFeeRule>(`/delivery-fees/${id}`, input),
    setStatus: (id: string, status: "active" | "inactive") =>
      setStatus<DeliveryFeeRule>(`/delivery-fees/${id}/status`, status),
    remove: (id: string) => removeOne(`/delivery-fees/${id}`),
    calculate: async (input: Record<string, unknown>) => {
      const response = await apiClient.post<ApiResponse<unknown>>(
        "/delivery-fees/calculate",
        input,
      );
      return response.data.data;
    },
  },

  areas: {
    list: (params: Record<string, unknown>) =>
      listResource<DeliveryAreaRecord>("/delivery-areas", params),
    get: (id: string) =>
      getOne<DeliveryAreaRecord>(`/delivery-areas/${id}`),
    create: (input: Record<string, unknown>) =>
      createOne<DeliveryAreaRecord>("/delivery-areas", input),
    update: (id: string, input: Record<string, unknown>) =>
      updateOne<DeliveryAreaRecord>(`/delivery-areas/${id}`, input),
    setStatus: (id: string, status: "ACTIVE" | "INACTIVE") =>
      setStatus<DeliveryAreaRecord>(`/delivery-areas/${id}/status`, status),
    remove: (id: string) => removeOne(`/delivery-areas/${id}`),
    checkEligibility: async (input: DeliveryEligibilityInput) => {
      const response = await apiClient.post<ApiResponse<unknown>>(
        "/delivery-areas/check-eligibility",
        input,
      );
      return response.data.data;
    },
  },

  methods: {
    list: (params: Record<string, unknown>) =>
      listResource<DeliveryMethodRecord>("/delivery-methods", params),
    get: (id: string) =>
      getOne<DeliveryMethodRecord>(`/delivery-methods/${id}`),
    create: (input: Record<string, unknown>) =>
      createOne<DeliveryMethodRecord>("/delivery-methods", input),
    update: (id: string, input: Record<string, unknown>) =>
      updateOne<DeliveryMethodRecord>(`/delivery-methods/${id}`, input),
    setStatus: (id: string, status: "ACTIVE" | "INACTIVE") =>
      setStatus<DeliveryMethodRecord>(`/delivery-methods/${id}/status`, status),
    remove: (id: string) => removeOne(`/delivery-methods/${id}`),
  },

  areaFeeOverrides: {
    list: (params: Record<string, unknown>) =>
      listResource<AreaFeeOverrideRecord>("/area-fee-overrides", params),
    get: (id: string) =>
      getOne<AreaFeeOverrideRecord>(`/area-fee-overrides/${id}`),
    create: (input: Record<string, unknown>) =>
      createOne<AreaFeeOverrideRecord>("/area-fee-overrides", input),
    update: (id: string, input: Record<string, unknown>) =>
      updateOne<AreaFeeOverrideRecord>(`/area-fee-overrides/${id}`, input),
    setStatus: (id: string, status: "ACTIVE" | "INACTIVE") =>
      setStatus<AreaFeeOverrideRecord>(
        `/area-fee-overrides/${id}/status`,
        status,
      ),
    remove: (id: string) => removeOne(`/area-fee-overrides/${id}`),
  },

  shipping: {
    list: (params: Record<string, unknown>) =>
      listResource<ShippingRecord>("/shipping", params),
    get: (id: string) => getOne<ShippingRecord>(`/shipping/${id}`),
    create: (input: Record<string, unknown>) =>
      createOne<ShippingRecord>("/shipping", input),
    assignRider: (id: string, riderId: string) =>
      updateOne<ShippingRecord>(`/shipping/${id}/assign-rider`, { riderId }),
    updateStatus: (id: string, input: Record<string, unknown>) =>
      updateOne<ShippingRecord>(`/shipping/${id}/status`, input),
    cancel: (id: string, reason: string) =>
      updateOne<ShippingRecord>(`/shipping/${id}/cancel`, { reason }),
    track: (trackingNumber: string) =>
      getOne<TrackingResult>(
        `/shipping/track/${encodeURIComponent(trackingNumber)}`,
      ),
  },
};
