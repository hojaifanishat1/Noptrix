import apiClient from "./client";
import type {
  InternalMessage,
  MessageListResult,
} from "@/features/communication/message.types";
import type { ApiResponse } from "@/types/api";

const BASE = "/communication/messages/rider";

function id(value: string) {
  if (!value.trim()) throw new Error("Message ID is required.");
  return encodeURIComponent(value);
}

export const riderMessagesApi = {
  async getInbox(): Promise<MessageListResult> {
    const response = await apiClient.get<ApiResponse<MessageListResult>>(
      `${BASE}/inbox`,
      { params: { page: 1, limit: 100, sort: "newest" } },
    );
    return response.data.data;
  },

  async getThread(messageId: string): Promise<InternalMessage[]> {
    const response = await apiClient.get<
      ApiResponse<{ messages: InternalMessage[] }>
    >(`${BASE}/${id(messageId)}/thread`);
    return response.data.data.messages;
  },

  async reply(
    messageId: string,
    body: string,
  ): Promise<InternalMessage> {
    const response = await apiClient.post<ApiResponse<InternalMessage>>(
      `${BASE}/${id(messageId)}/replies`,
      { body },
    );
    return response.data.data;
  },

  async getUnreadCount(): Promise<number> {
    const response = await apiClient.get<ApiResponse<{ count: number }>>(
      `${BASE}/unread-count`,
    );
    return response.data.data.count;
  },
};
