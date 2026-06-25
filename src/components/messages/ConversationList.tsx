import { Archive, BellOff, Pin, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";

import { ConversationTypeBadge } from "@/components/messages/ConversationTypeBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  getConversationTitle,
  getLastMessagePreview,
  getUnreadCount,
} from "@/services/messagingService";
import type { AppUser } from "@/types/auth";
import type { Conversation } from "@/types/messages";
import { cn } from "@/utils/cn";

export function ConversationList({
  conversations,
  currentUser,
  activeId,
}: {
  conversations: Conversation[];
  currentUser: AppUser;
  activeId?: string;
}) {
  if (conversations.length === 0) {
    return (
      <EmptyState
        title="No conversations found"
        description="Matching conversations will appear here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
      {conversations.map((conversation) => {
        const participant = conversation.participants.find(
          (item) => item.userId === currentUser.id,
        );
        const unreadCount = getUnreadCount(conversation, currentUser);
        const active = activeId === conversation.id;

        return (
          <Link
            key={conversation.id}
            to={`/messages/${conversation.id}`}
            className={cn(
              "block border-b border-surface-border p-4 transition last:border-0 hover:bg-brand-light/40",
              active ? "bg-brand-light" : null,
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-bold text-text-primary">
                    {getConversationTitle(conversation, currentUser)}
                  </h3>
                  <ConversationTypeBadge type={conversation.type} />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                  {getLastMessagePreview(conversation)}
                </p>
              </div>
              {unreadCount > 0 ? (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-blue px-2 text-xs font-bold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              <span className="inline-flex items-center gap-1">
                <UsersRound className="h-3.5 w-3.5" />
                {conversation.participants.length}
              </span>
              {participant?.pinnedAt ? (
                <span className="inline-flex items-center gap-1 text-brand-blue">
                  <Pin className="h-3.5 w-3.5" />
                  Pinned
                </span>
              ) : null}
              {participant?.mutedUntil ? (
                <span className="inline-flex items-center gap-1">
                  <BellOff className="h-3.5 w-3.5" />
                  Muted
                </span>
              ) : null}
              {participant?.archivedAt ? (
                <span className="inline-flex items-center gap-1">
                  <Archive className="h-3.5 w-3.5" />
                  Archived
                </span>
              ) : null}
              <span>{formatTime(conversation.lastMessageAt)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
