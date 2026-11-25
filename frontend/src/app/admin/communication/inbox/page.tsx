"use client";

import { RiderChatWorkspace } from "@/features/communication/rider-chat-workspace";

export default function CommunicationInboxPage() {
  return <RiderChatWorkspace mode="admin" participantTypeFilter="ADMIN_EMPLOYEE" />;
}
