import { Download, FileText, Reply, SmilePlus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { MESSAGE_REACTION_OPTIONS } from "@/constants/messages";
import { getReadReceiptLabel } from "@/services/messagingService";
import type { AppUser } from "@/types/auth";
import type { Message } from "@/types/messages";
import { cn } from "@/utils/cn";

export function MessageBubble({
  message,
  currentUser,
  onReply,
  onReact,
}: {
  message: Message;
  currentUser: AppUser;
  onReply: (message: Message) => void;
  onReact: (messageId: string, label: string) => void;
}) {
  const ownMessage = message.senderId === currentUser.id;
  const readLabel = getReadReceiptLabel(message, currentUser);

  return (
    <div className={cn("flex", ownMessage ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[760px] rounded-lg border p-3 shadow-sm",
          ownMessage
            ? "border-blue-200 bg-brand-light"
            : "border-surface-border bg-white",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-text-primary">{message.senderName}</p>
          <p className="text-xs text-text-secondary">{formatTime(message.createdAt)}</p>
        </div>

        {message.repliedToPreview ? (
          <div className="mt-3 rounded-md border-l-4 border-brand-blue bg-white/70 p-3 text-xs text-text-secondary">
            {message.repliedToPreview}
          </div>
        ) : null}

        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-primary">
          {message.deletedAt ? "This message was deleted." : message.body}
        </p>

        {message.attachments.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="overflow-hidden rounded-lg border border-surface-border bg-white"
              >
                {attachment.fileType.startsWith("image/") && attachment.url !== "#" ? (
                  <img
                    src={attachment.url}
                    alt={attachment.fileName}
                    className="h-32 w-full object-cover"
                  />
                ) : null}
                <div className="flex items-center justify-between gap-3 p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-brand-blue" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-text-primary">
                        {attachment.fileName}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {Math.round(attachment.fileSize / 1024)} KB
                      </p>
                    </div>
                  </div>
                  <a href={attachment.url} download={attachment.fileName}>
                    <Button type="button" variant="ghost" size="icon" title="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {message.reactions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.label}
                type="button"
                className="rounded-full border border-surface-border bg-white px-2.5 py-1 text-xs font-semibold text-text-secondary hover:border-brand-blue hover:text-brand-blue"
                title={reaction.userNames.join(", ")}
                onClick={() => onReact(message.id, reaction.label)}
              >
                {reaction.label} {reaction.userIds.length}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Reply className="h-4 w-4" />}
              onClick={() => onReply(message)}
            >
              Reply
            </Button>
            {MESSAGE_REACTION_OPTIONS.map((label) => (
              <Button
                key={label}
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<SmilePlus className="h-4 w-4" />}
                onClick={() => onReact(message.id, label)}
              >
                {label}
              </Button>
            ))}
          </div>
          {readLabel ? (
            <p className="text-xs font-semibold text-text-secondary">{readLabel}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
