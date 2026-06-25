import type {
  ConversationTab,
  ConversationType,
} from "@/types/messages";

export const CONVERSATION_TYPE_LABELS: Record<ConversationType, string> = {
  direct: "1:1 Chat",
  group: "Group Chat",
  project: "Project Group",
};

export const CONVERSATION_TYPE_TONES: Record<
  ConversationType,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  direct: "info",
  group: "success",
  project: "warning",
};

export const CONVERSATION_TAB_LABELS: Record<ConversationTab, string> = {
  all: "All",
  unread: "Unread",
  groups: "Groups",
  archived: "Archived",
};

export const MESSAGE_REACTION_OPTIONS = ["Ack", "Done", "Check"] as const;
