import apiClient from "./client";

export type ExportFormat = "csv" | "xlsx" | "json";

export interface ExportDataset {
  key: string;
  label: string;
  formats: ExportFormat[];
}

export interface ExportJob {
  _id?: string;
  jobId: string;
  dataset: string;
  format: ExportFormat;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  progress: number;
  requestedBy: string;
  rowCount: number;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  errorMessage?: string;
  attemptsMade: number;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  downloadAvailable?: boolean;
}

export interface ExportJobsResponse {
  items: ExportJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const exportJobsApi = {
  async getDatasets(): Promise<ExportDataset[]> {
    const response = await apiClient.get("/export-jobs/datasets");
    return response.data.data ?? [];
  },

  async getJobs(params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<ExportJobsResponse> {
    const response = await apiClient.get("/export-jobs", { params });

    return {
      items: response.data.items ?? [],
      pagination: response.data.pagination ?? {
        page: 1,
        limit: 25,
        total: 0,
        totalPages: 0,
      },
    };
  },

  async create(input: {
    dataset: string;
    format: ExportFormat;
    from?: string;
    to?: string;
  }): Promise<ExportJob> {
    const response = await apiClient.post("/export-jobs", input);
    return response.data.data;
  },

  async retry(jobId: string): Promise<ExportJob> {
    const response = await apiClient.post(
      `/export-jobs/${encodeURIComponent(jobId)}/retry`,
    );
    return response.data.data;
  },

  async getDownloadUrl(jobId: string): Promise<string> {
    const response = await apiClient.get(
      `/export-jobs/${encodeURIComponent(jobId)}/download`,
    );
    return response.data.data.url;
  },
};
