import apiClient from "./client";

export const integrationsApi = {
  async getAll(filters: { page?: number; limit?: number } = {}) {
    const response = await apiClient.get("/integrations", { params: filters });
    if (response.data?.success === false) {
      throw new Error(response.data.message || "Unable to load integrations.");
    }
    return {
      items: response.data?.data ?? [],
      pagination: response.data?.pagination,
    };
  },
};

export default integrationsApi;
