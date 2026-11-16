
import apiClient from "./client";
import type { ApiResponse } from "@/types/api";

export type OnboardingDocumentType =
  | "NATIONAL_ID"
  | "DRIVING_LICENSE"
  | "VEHICLE_REGISTRATION"
  | "VEHICLE_INSURANCE";

export type OnboardingDocumentStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface OnboardingDocument {
  id?: string;
  _id?: string;
  documentType: OnboardingDocumentType;
  status: OnboardingDocumentStatus;
  rejectionReason?: string;
  reviewedAt?: string;
  createdAt?: string;
  downloadUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
}

interface DocumentsResponse {
  documents: OnboardingDocument[];
}

export const onboardingApi = {
  async getRiderDocuments(): Promise<OnboardingDocument[]> {
    const response = await apiClient.get<
      ApiResponse<DocumentsResponse>
    >("/onboarding/rider/documents");

    return response.data.data.documents;
  },

  async uploadRiderDocument(
    documentType: OnboardingDocumentType,
    file: File,
  ): Promise<void> {
    const formData = new FormData();

    formData.append("documentType", documentType);
    formData.append("document", file);

    await apiClient.post(
      "/onboarding/rider/documents",
      formData,
    );
  },

  async getOwnerDocuments(
    subjectId: string,
  ): Promise<OnboardingDocument[]> {
    const response = await apiClient.get<
      ApiResponse<DocumentsResponse>
    >("/onboarding/owner/documents", {
      params: {
        subjectType: "RIDER",
        subjectId,
      },
    });

    return response.data.data.documents;
  },

  async reviewDocument(
    documentId: string,
    status: "APPROVED" | "REJECTED",
    rejectionReason?: string,
  ): Promise<OnboardingDocument> {
    const response = await apiClient.patch<
      ApiResponse<{ document: OnboardingDocument }>
    >(
      `/onboarding/owner/documents/${documentId}/review`,
      {
        status,
        ...(rejectionReason
          ? { rejectionReason }
          : {}),
      },
    );

    return response.data.data.document;
  },
};

export function getOnboardingDocumentId(
  document: OnboardingDocument,
): string {
  return document.id ?? document._id ?? "";
}
