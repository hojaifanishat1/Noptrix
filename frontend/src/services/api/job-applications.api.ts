import apiClient from "./client";

import type {
    ApiResponse,
} from "@/types/api";

import type {
    CreateJobApplicationInput,
    JobApplication,
    JobApplicationList,
    JobApplicationListParams,
    RecruitmentReportsSummary,
    UpdateJobApplicationInput,
    VacancyApplicationSummary,
} from "@/features/job-applications/job-application.types";


export const jobApplicationsApi = {
    async create(
        input: CreateJobApplicationInput,
    ): Promise<JobApplication> {
        const response =
            await apiClient.post<
                ApiResponse<JobApplication>
            >(
                "/job-applications",
                input,
            );

        return response.data.data;
    },


    async getMyApplications(
        params?: JobApplicationListParams,
    ): Promise<JobApplicationList> {
        const response =
            await apiClient.get<
                ApiResponse<JobApplicationList>
            >(
                "/job-applications/me",
                {
                    params,
                },
            );

        return response.data.data;
    },


    async getMyApplication(
        applicationId: string,
    ): Promise<JobApplication> {
        const response =
            await apiClient.get<
                ApiResponse<JobApplication>
            >(
                `/job-applications/me/${applicationId}`,
            );

        return response.data.data;
    },


    async withdrawMyApplication(
        applicationId: string,
    ): Promise<JobApplication> {
        const response =
            await apiClient.post<
                ApiResponse<JobApplication>
            >(
                `/job-applications/me/${applicationId}/withdraw`,
            );

        return response.data.data;
    },


    async getAll(
        params?: JobApplicationListParams,
    ): Promise<JobApplicationList> {
        const response =
            await apiClient.get<
                ApiResponse<JobApplicationList>
            >(
                "/job-applications",
                {
                    params,
                },
            );

        return response.data.data;
    },


    async getById(
        applicationId: string,
    ): Promise<JobApplication> {
        const response =
            await apiClient.get<
                ApiResponse<JobApplication>
            >(
                `/job-applications/${applicationId}`,
            );

        return response.data.data;
    },


    async updateStatus(
        applicationId: string,
        input: UpdateJobApplicationInput,
    ): Promise<JobApplication> {
        const response =
            await apiClient.patch<
                ApiResponse<JobApplication>
            >(
                `/job-applications/${applicationId}/status`,
                input,
            );

        return response.data.data;
    },

    async requestRiderConversion(applicationId: string): Promise<JobApplication> {
        const response = await apiClient.post<ApiResponse<JobApplication>>(
            `/job-applications/${applicationId}/rider-conversion-request`,
        );

        return response.data.data;
    },


    async getVacancySummary(
        vacancyId: string,
    ): Promise<VacancyApplicationSummary> {
        const response =
            await apiClient.get<
                ApiResponse<VacancyApplicationSummary>
            >(
                `/job-applications/vacancy/${vacancyId}/summary`,
            );

        return response.data.data;
    },


    async getRecruitmentReports(
        params?: { from?: string; to?: string },
    ): Promise<RecruitmentReportsSummary> {
        const response =
            await apiClient.get<
                ApiResponse<RecruitmentReportsSummary>
            >(
                "/job-applications/reports/summary",
                { params },
            );

        return response.data.data;
    },
};
