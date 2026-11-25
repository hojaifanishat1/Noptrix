export const MESSAGE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export const MESSAGE_STATUSES = [
  "SENT",
  "READ",
  "ARCHIVED",
  "DELETED",
] as const;

export type MessagePriority = (typeof MESSAGE_PRIORITIES)[number];
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export interface MessageAttachment {
  name: string;
  publicId: string;
  resourceType: "image" | "raw";
  format: string;
  mimeType: string;
  size: number;
  url?: string;
}

export interface InternalMessage {
  _id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  recipientId: string;
  recipientName: string;
  recipientRole?: string;
  threadId?: string;
  parentMessageId?: string;
  subject: string;
  body: string;
  priority: MessagePriority;
  status: MessageStatus;
  attachments?: MessageAttachment[];
  readAt?: string;
  unreadAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageListQuery {
  page?: number;
  limit?: number;
  status?: MessageStatus;
  priority?: MessagePriority;
  search?: string;
  unreadOnly?: boolean;
  fromDate?: string;
  toDate?: string;
  sort?: "newest" | "oldest";
  participantType?: "RIDER";
}

export interface MessageListResult {
  messages: InternalMessage[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreateInternalMessageInput {
  recipientId: string;
  subject: string;
  body: string;
  priority: MessagePriority;
  attachments?: MessageAttachment[];
}

export type MessageBulkAction = "read" | "unread" | "archive" | "delete";

export type MessageRecipientType =
  "OWNER" | "ADMIN" | "EMPLOYEE" | "SELLER" | "RIDER";

export interface MessageRecipient {
  userId: string;
  name: string;
  email?: string;
  accountType: MessageRecipientType;
  profileName?: string;
}

export interface MessageRecipientQuery {
  page?: number;
  limit?: number;
  search?: string;
  accountType?: MessageRecipientType;
}

export interface MessageRecipientListResult {
  recipients: MessageRecipient[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
