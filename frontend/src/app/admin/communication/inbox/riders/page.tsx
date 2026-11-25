"use client";

import { MessageMailbox } from "@/features/communication/message-mailbox";

export default function RiderMessagesPage() {
  return <MessageMailbox recipientTypeFilter="RIDER" />;
}
