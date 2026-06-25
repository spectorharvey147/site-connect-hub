import {
  Archive,
  Bell,
  BellOff,
  FileUp,
  Pin,
  PinOff,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ConversationList } from "@/components/messages/ConversationList";
import { ConversationTypeBadge } from "@/components/messages/ConversationTypeBadge";
import { MessageBubble } from "@/components/messages/MessageBubble";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import {
  getConversationTitle,
  messagingService,
} from "@/services/messagingService";
import type { AppUser } from "@/types/auth";
import type {
  Conversation,
  Message,
  MessageAttachment,
} from "@/types/messages";

export function ConversationPage() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [conversationSearch, setConversationSearch] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [sending, setSending] = useState(false);

  const refreshRealtime = useCallback(() => {
    if (user && conversationId) {
      void loadConversation(user, conversationId).then((result) => {
        setConversation(result.conversation);
        setConversations(result.conversations);
      });
    }
  }, [conversationId, user]);
  useRealtimeMessages(user, conversationId, refreshRealtime);
  const { typingUsers, signalTyping } = useTypingIndicator(
    conversationId,
    user?.id,
    user?.fullName,
  );

  useEffect(() => {
    if (!user || !conversationId) {
      return;
    }
    setLoading(true);
    void loadConversation(user, conversationId).then((result) => {
      setConversation(result.conversation);
      setConversations(result.conversations);
      setLoading(false);
    });
  }, [conversationId, user]);

  const currentParticipant = useMemo(
    () =>
      user && conversation
        ? conversation.participants.find((participant) => participant.userId === user.id)
        : undefined,
    [conversation, user],
  );

  const visibleMessages = useMemo(() => {
    if (!conversation) {
      return [];
    }
    if (!messageSearch.trim()) {
      return conversation.messages;
    }
    const query = messageSearch.trim().toLowerCase();
    return conversation.messages.filter((message) =>
      [message.senderName, message.body, message.repliedToPreview]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [conversation, messageSearch]);

  const visibleConversations = useMemo(() => {
    if (!user) {
      return [];
    }
    if (!conversationSearch.trim()) {
      return conversations;
    }
    const query = conversationSearch.trim().toLowerCase();
    return conversations.filter((item) =>
      [
        getConversationTitle(item, user),
        item.description,
        item.projectName,
        ...item.participants.map((participant) => participant.userName),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [conversationSearch, conversations, user]);

  if (!user) {
    return null;
  }

  if (loading) {
    return <LoadingState label="Loading conversation" />;
  }

  if (!conversation || !conversationId) {
    return (
      <EmptyState
        title="Conversation not found"
        description="This conversation does not exist or is not visible to your role."
      />
    );
  }

  const title = getConversationTitle(conversation, user);
  const muted = Boolean(currentParticipant?.mutedUntil);
  const pinned = Boolean(currentParticipant?.pinnedAt);

  async function refresh(currentUser: AppUser, currentConversationId: string) {
    const result = await loadConversation(currentUser, currentConversationId);
    setConversation(result.conversation);
    setConversations(result.conversations);
  }

  function addAttachments(files: FileList | null) {
    const currentUser = user;
    if (!files || !currentUser) {
      return;
    }
    setAttachments((current) => [
      ...current,
      ...Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        url: URL.createObjectURL(file),
        uploadedBy: currentUser.id,
        uploadedByName: currentUser.fullName,
        createdAt: new Date().toISOString(),
      })),
    ]);
  }

  async function sendMessage() {
    const currentUser = user;
    const currentConversationId = conversationId;
    if (!currentUser || !currentConversationId) {
      return;
    }
    setSending(true);
    try {
      await messagingService.sendMessage(
        {
          conversationId: currentConversationId,
          body: messageText,
          attachments,
          repliedToId: replyTo?.id,
        },
        currentUser,
      );
      setMessageText("");
      setAttachments([]);
      setReplyTo(null);
      await refresh(currentUser, currentConversationId);
      toast.success("Message sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  async function reactToMessage(messageId: string, label: string) {
    const currentUser = user;
    const currentConversationId = conversationId;
    if (!currentUser || !currentConversationId) {
      return;
    }
    try {
      await messagingService.toggleReaction(
        currentConversationId,
        messageId,
        label,
        currentUser,
      );
      await refresh(currentUser, currentConversationId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update reaction.");
    }
  }

  async function toggleMuted() {
    const currentUser = user;
    const currentConversationId = conversationId;
    if (!currentUser || !currentConversationId) {
      return;
    }
    try {
      await messagingService.setConversationMuted(
        currentConversationId,
        currentUser,
        !muted,
      );
      await refresh(currentUser, currentConversationId);
      toast.success(muted ? "Conversation unmuted." : "Conversation muted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update mute.");
    }
  }

  async function togglePinned() {
    const currentUser = user;
    const currentConversationId = conversationId;
    if (!currentUser || !currentConversationId) {
      return;
    }
    try {
      await messagingService.setConversationPinned(
        currentConversationId,
        currentUser,
        !pinned,
      );
      await refresh(currentUser, currentConversationId);
      toast.success(pinned ? "Conversation unpinned." : "Conversation pinned.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update pin.");
    }
  }

  async function archiveConversation() {
    const currentUser = user;
    const currentConversationId = conversationId;
    if (!currentUser || !currentConversationId) {
      return;
    }
    try {
      await messagingService.setConversationArchived(
        currentConversationId,
        currentUser,
        true,
      );
      toast.success("Conversation archived.");
      navigate("/messages");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to archive.");
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        description={conversation.description ?? conversation.projectName}
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Messages", to: "/messages" },
          { label: title },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Input
            label="Search conversations"
            value={conversationSearch}
            leftIcon={<Search className="h-4 w-4" />}
            onChange={(event) => setConversationSearch(event.target.value)}
          />
          <ConversationList
            conversations={visibleConversations}
            currentUser={user}
            activeId={conversation.id}
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{title}</CardTitle>
                  <ConversationTypeBadge type={conversation.type} />
                </div>
                <CardDescription>
                  {conversation.participants.length} members
                  {conversation.projectName ? ` · ${conversation.projectName}` : ""}
                </CardDescription>
              </div>
              {currentParticipant ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={
                      pinned ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )
                    }
                    onClick={() => void togglePinned()}
                  >
                    {pinned ? "Unpin" : "Pin"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={
                      muted ? (
                        <Bell className="h-4 w-4" />
                      ) : (
                        <BellOff className="h-4 w-4" />
                      )
                    }
                    onClick={() => void toggleMuted()}
                  >
                    {muted ? "Unmute" : "Mute"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Archive className="h-4 w-4" />}
                    onClick={() => void archiveConversation()}
                  >
                    Archive
                  </Button>
                </div>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <Input
              label="Search messages"
              value={messageSearch}
              leftIcon={<Search className="h-4 w-4" />}
              onChange={(event) => setMessageSearch(event.target.value)}
            />

            <div className="max-h-[560px] space-y-4 overflow-y-auto rounded-lg border border-surface-border bg-slate-50 p-4">
              {visibleMessages.length === 0 ? (
                <EmptyState
                  title="No messages found"
                  description="Matching messages will appear here."
                />
              ) : (
                visibleMessages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    currentUser={user}
                    onReply={setReplyTo}
                    onReact={(messageId, label) =>
                      void reactToMessage(messageId, label)
                    }
                  />
                ))
              )}
            </div>

            <div className="rounded-lg border border-surface-border p-4">
              {replyTo ? (
                <div className="mb-3 flex items-start justify-between gap-3 rounded-md border-l-4 border-brand-blue bg-brand-light p-3">
                  <div>
                    <p className="text-xs font-bold text-brand-blue">
                      Replying to {replyTo.senderName}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                      {replyTo.body}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setReplyTo(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}

              <Textarea
                label="Message"
                value={messageText}
                onChange={(event) => {
                  setMessageText(event.target.value);
                  signalTyping();
                }}
              />
              {typingUsers.length ? (
                <p className="mt-2 text-xs text-text-secondary">
                  {typingUsers.join(", ")} typing...
                </p>
              ) : null}

              {attachments.length > 0 ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between rounded-lg border border-surface-border p-3"
                    >
                      <span className="truncate text-sm font-semibold">
                        {attachment.fileName}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setAttachments((current) =>
                            current.filter((item) => item.id !== attachment.id),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-surface-border bg-white px-3 py-2 text-sm font-semibold text-text-primary hover:border-brand-blue">
                  <FileUp className="h-4 w-4 text-brand-blue" />
                  Attach
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(event) => addAttachments(event.target.files)}
                  />
                </label>
                <Button
                  type="button"
                  leftIcon={<Send className="h-4 w-4" />}
                  isLoading={sending}
                  onClick={() => void sendMessage()}
                >
                  Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

async function loadConversation(user: AppUser, conversationId: string) {
  const existing = await messagingService.getConversation(conversationId, user);
  const conversation = existing
    ? await messagingService.markConversationRead(conversationId, user)
    : null;
  const conversations = await messagingService.listConversations(user, {
    tab: "all",
  });
  return { conversation, conversations };
}
