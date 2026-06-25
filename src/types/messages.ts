import type { Role } from "@/types/auth";

export type ConversationType = "direct" | "group" | "project";
export type ConversationTab = "all" | "unread" | "groups" | "archived";
export type MessageType = "text" | "image" | "file";

export interface MessageAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: string;
}

export interface MessageReadReceipt {
  userId: string;
  userName: string;
  readAt: string;
}

export interface MessageReaction {
  label: string;
  userIds: string[];
  userNames: string[];
}

export interface ConversationParticipant {
  userId: string;
  userName: string;
  userRole: Role;
  joinedAt: string;
  mutedUntil?: string;
  archivedAt?: string;
  pinnedAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  messageType: MessageType;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  readBy: MessageReadReceipt[];
  repliedToId?: string;
  repliedToPreview?: string;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  createdBy: string;
  createdByName: string;
  participants: ConversationParticipant[];
  messages: Message[];
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationFilters {
  search?: string;
  tab?: ConversationTab;
}

export interface NewConversationInput {
  type: ConversationType;
  title?: string;
  description?: string;
  participantIds: string[];
  projectId?: string;
  firstMessage: string;
  attachments: MessageAttachment[];
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
  attachments: MessageAttachment[];
  repliedToId?: string;
}

export interface MessageDashboardSummary {
  totalConversations: number;
  unreadConversations: number;
  groupConversations: number;
  sharedAttachments: number;
}
