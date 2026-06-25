import {
  profileNameMap,
  projectNameMap,
  requireSupabase,
  type DataRow,
} from "@/services/normalizedDataUtils";
import type { AppUser } from "@/types/auth";
import type {
  Conversation,
  MessageAttachment,
  NewConversationInput,
  SendMessageInput,
} from "@/types/messages";

export const messagingRepository = {
  async list(actor: AppUser) {
    const client = requireSupabase();
    const { data: memberships, error: memberError } = await client
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", actor.id);
    if (memberError) throw new Error(memberError.message);
    const ids = ((memberships as DataRow[] | null) ?? []).map((row) => String(row.conversation_id));
    if (!ids.length) return [];
    const { data, error } = await client
      .from("conversations")
      .select("*,conversation_members(*),messages(*,message_attachments(*),message_read_receipts(*),message_reactions(*))")
      .in("id", ids)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const userIds = rows.flatMap((row) => [
      String(row.created_by),
      ...((row.conversation_members as DataRow[] | null) ?? []).map((item) => String(item.user_id)),
      ...((row.messages as DataRow[] | null) ?? []).flatMap((message) => [
        String(message.sender_id),
        ...((message.message_read_receipts as DataRow[] | null) ?? []).map((item) => String(item.user_id)),
        ...((message.message_reactions as DataRow[] | null) ?? []).map((item) => String(item.user_id)),
      ]),
    ]);
    const [profiles, projects] = await Promise.all([
      profileNameMap(userIds),
      projectNameMap(rows.map((row) => String(row.project_id ?? ""))),
    ]);
    return rows.map((row): Conversation => {
      const members = (row.conversation_members as DataRow[] | null) ?? [];
      const messages = ((row.messages as DataRow[] | null) ?? []).sort((a, b) =>
        String(a.sent_at).localeCompare(String(b.sent_at)),
      );
      return {
        id: String(row.id),
        type: row.type as Conversation["type"],
        title: String(row.name),
        description: row.description ? String(row.description) : undefined,
        projectId: row.project_id ? String(row.project_id) : undefined,
        projectName: row.project_id ? projects.get(String(row.project_id)) : undefined,
        createdBy: String(row.created_by),
        createdByName: profiles.get(String(row.created_by)) ?? "User",
        participants: members.map((item) => ({
          userId: String(item.user_id),
          userName: profiles.get(String(item.user_id)) ?? "User",
          userRole: actor.role,
          joinedAt: String(item.joined_at),
          mutedUntil: item.muted_until ? String(item.muted_until) : undefined,
          archivedAt: item.archived_at ? String(item.archived_at) : undefined,
          pinnedAt: item.pinned_at ? String(item.pinned_at) : undefined,
        })),
        messages: messages.map((message) => ({
          id: String(message.id),
          conversationId: String(message.conversation_id),
          senderId: String(message.sender_id),
          senderName: profiles.get(String(message.sender_id)) ?? "User",
          body: String(message.content ?? ""),
          messageType: message.message_type as Conversation["messages"][number]["messageType"],
          attachments: ((message.message_attachments as DataRow[] | null) ?? []).map((item) => ({
            id: String(item.id),
            fileName: String(item.file_name),
            fileType: String(item.file_type ?? ""),
            fileSize: Number(item.file_size ?? 0),
            url: String(item.file_url),
            uploadedBy: String(item.uploaded_by ?? message.sender_id),
            uploadedByName: profiles.get(String(item.uploaded_by ?? message.sender_id)) ?? "User",
            createdAt: String(item.created_at),
          })),
          reactions: Array.from(
            ((message.message_reactions as DataRow[] | null) ?? []).reduce(
              (map, item) => {
                const label = String(item.reaction);
                const current = map.get(label) ?? { label, userIds: [], userNames: [] };
                current.userIds.push(String(item.user_id));
                current.userNames.push(profiles.get(String(item.user_id)) ?? "User");
                map.set(label, current);
                return map;
              },
              new Map<string, { label: string; userIds: string[]; userNames: string[] }>(),
            ).values(),
          ),
          readBy: ((message.message_read_receipts as DataRow[] | null) ?? []).map((item) => ({
            userId: String(item.user_id),
            userName: profiles.get(String(item.user_id)) ?? "User",
            readAt: String(item.read_at),
          })),
          repliedToId: message.replied_to_id ? String(message.replied_to_id) : undefined,
          editedAt: message.edited_at ? String(message.edited_at) : undefined,
          deletedAt: message.deleted_at ? String(message.deleted_at) : undefined,
          createdAt: String(message.sent_at),
          updatedAt: String(message.updated_at),
        })),
        lastMessageAt: messages.length
          ? String(messages[messages.length - 1].sent_at)
          : String(row.created_at),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      };
    });
  },

  async create(input: NewConversationInput, actor: AppUser, participantIds: string[]) {
    const client = requireSupabase();
    const { data, error } = await client.from("conversations").insert({
      type: input.type,
      name: input.title?.trim() || (input.type === "direct" ? "Direct Chat" : "Group Chat"),
      description: input.description?.trim() || null,
      project_id: input.projectId ?? null,
      created_by: actor.id,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const conversationId = String(data.id);
    const members = [...new Set([actor.id, ...participantIds])];
    const { error: memberError } = await client.from("conversation_members").insert(
      members.map((userId) => ({
        conversation_id: conversationId,
        user_id: userId,
        member_role: userId === actor.id ? "owner" : "member",
      })),
    );
    if (memberError) {
      await client.from("conversations").delete().eq("id", conversationId);
      throw new Error(memberError.message);
    }
    await this.send(
      {
        conversationId,
        body: input.firstMessage,
        attachments: input.attachments,
      },
      actor,
    );
    return (await this.list(actor)).find((row) => row.id === conversationId)!;
  },

  async send(input: SendMessageInput, actor: AppUser) {
    const client = requireSupabase();
    const messageType = input.attachments.length
      ? input.attachments.some((item) => item.fileType.startsWith("image/"))
        ? "image"
        : "file"
      : "text";
    const { data, error } = await client.from("messages").insert({
      conversation_id: input.conversationId,
      sender_id: actor.id,
      content: input.body.trim(),
      message_type: messageType,
      replied_to_id: input.repliedToId ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const messageId = String(data.id);
    if (input.attachments.length) {
      const { error: attachmentError } = await client.from("message_attachments").insert(
        input.attachments.map((item: MessageAttachment) => ({
          id: item.id || crypto.randomUUID(),
          message_id: messageId,
          file_url: item.url,
          file_name: item.fileName,
          file_type: item.fileType,
          file_size: item.fileSize,
          uploaded_by: actor.id,
        })),
      );
      if (attachmentError) throw new Error(attachmentError.message);
    }
    await client.from("message_read_receipts").upsert({
      message_id: messageId,
      user_id: actor.id,
      read_at: new Date().toISOString(),
    });
    await client.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", input.conversationId);
    const conversation = (await this.list(actor)).find((row) => row.id === input.conversationId);
    const message = conversation?.messages.find((row) => row.id === messageId);
    if (!message) throw new Error("Message was saved but could not be reloaded.");
    return message;
  },

  async markRead(conversationId: string, actor: AppUser) {
    const client = requireSupabase();
    const { data, error } = await client.from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .neq("sender_id", actor.id);
    if (error) throw new Error(error.message);
    const ids = ((data as DataRow[] | null) ?? []).map((row) => String(row.id));
    if (ids.length) {
      const { error: receiptError } = await client.from("message_read_receipts").upsert(
        ids.map((messageId) => ({
          message_id: messageId,
          user_id: actor.id,
          read_at: new Date().toISOString(),
        })),
        { onConflict: "message_id,user_id" },
      );
      if (receiptError) throw new Error(receiptError.message);
    }
    return (await this.list(actor)).find((row) => row.id === conversationId)!;
  },

  async toggleReaction(conversationId: string, messageId: string, label: string, actor: AppUser) {
    const client = requireSupabase();
    const { data } = await client.from("message_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("user_id", actor.id)
      .eq("reaction", label)
      .maybeSingle();
    if (data?.id) {
      await client.from("message_reactions").delete().eq("id", data.id);
    } else {
      const { error } = await client.from("message_reactions").insert({
        message_id: messageId,
        user_id: actor.id,
        reaction: label,
      });
      if (error) throw new Error(error.message);
    }
    return (await this.list(actor)).find((row) => row.id === conversationId)!;
  },

  async setMemberSetting(
    conversationId: string,
    actor: AppUser,
    patch: { archived_at?: string | null; muted_until?: string | null; pinned_at?: string | null },
  ) {
    const client = requireSupabase();
    const { error } = await client.from("conversation_members").update(patch)
      .eq("conversation_id", conversationId)
      .eq("user_id", actor.id);
    if (error) throw new Error(error.message);
    return (await this.list(actor)).find((row) => row.id === conversationId)!;
  },

  subscribe(conversationId: string, onChange: () => void) {
    const client = requireSupabase();
    const channel = client.channel(`messages:${conversationId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, onChange)
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  },
};
