import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { PROJECT_OPTIONS } from "@/constants/claims";
import { messagingRepository } from "@/services/messagingRepository";
import { isSupabaseConfigured } from "@/services/supabaseClient";
import { userHierarchyService } from "@/services/userHierarchyService";
import type { AppUser } from "@/types/auth";
import type {
  Conversation,
  ConversationFilters,
  ConversationParticipant,
  Message,
  MessageAttachment,
  MessageDashboardSummary,
  NewConversationInput,
  SendMessageInput,
} from "@/types/messages";

const CONVERSATIONS_STORAGE_KEY = "site-connect:conversations";

let memoryConversations: Conversation[] | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function now() {
  return new Date().toISOString();
}

function getDemoUser(email: string) {
  const user = DEMO_USERS.find((item) => item.email === email);
  if (!user) {
    throw new Error(`Missing demo user: ${email}`);
  }
  return toAppUser(user);
}

function getUserById(userId: string) {
  return DEMO_USERS.map(toAppUser).find((user) => user.id === userId);
}

function getProjectName(projectId?: string) {
  if (isSupabaseConfigured) {
    throw new Error("Production project names must come from Supabase.");
  }
  return projectId
    ? PROJECT_OPTIONS.find((project) => project.id === projectId)?.name
    : undefined;
}

function participantFor(user: AppUser, createdAt: string): ConversationParticipant {
  return {
    userId: user.id,
    userName: user.fullName,
    userRole: user.role,
    joinedAt: createdAt,
  };
}

function readReceiptFor(user: AppUser, readAt: string) {
  return {
    userId: user.id,
    userName: user.fullName,
    readAt,
  };
}

function makeMessage({
  id,
  conversationId,
  sender,
  body,
  createdAt,
  attachments = [],
  readBy,
  repliedToId,
  repliedToPreview,
}: {
  id: string;
  conversationId: string;
  sender: AppUser;
  body: string;
  createdAt: string;
  attachments?: MessageAttachment[];
  readBy?: AppUser[];
  repliedToId?: string;
  repliedToPreview?: string;
}): Message {
  return {
    id,
    conversationId,
    senderId: sender.id,
    senderName: sender.fullName,
    body,
    messageType: attachments.some((attachment) =>
      attachment.fileType.startsWith("image/"),
    )
      ? "image"
      : attachments.length > 0
        ? "file"
        : "text",
    attachments,
    reactions: [],
    readBy: (readBy ?? [sender]).map((user) => readReceiptFor(user, createdAt)),
    repliedToId,
    repliedToPreview,
    createdAt,
    updatedAt: createdAt,
  };
}

function seedConversations(): Conversation[] {
  const manager = getDemoUser("manager@siteconnect.local");
  const siteUser = getDemoUser("site@siteconnect.local");
  const admin = getDemoUser("admin@siteconnect.local");
  const accounts = getDemoUser("accounts@siteconnect.local");
  const secondUser = getDemoUser("ishita@siteconnect.local");
  const devUser = getDemoUser("dev@siteconnect.local");

  const directCreatedAt = "2026-06-20T09:30:00.000Z";
  const directMessages = [
    makeMessage({
      id: "msg-demo-001",
      conversationId: "conv-demo-001",
      sender: manager,
      body: "Please share the pier shuttering photos before the evening review.",
      createdAt: "2026-06-20T09:35:00.000Z",
      readBy: [manager, siteUser],
    }),
    makeMessage({
      id: "msg-demo-002",
      conversationId: "conv-demo-001",
      sender: siteUser,
      body: "Photos are attached. Alignment is complete and concreting can start after checklist sign-off.",
      createdAt: "2026-06-20T10:05:00.000Z",
      attachments: [
        {
          id: "msg-attachment-demo-001",
          fileName: "pier-p12-photo.jpg",
          fileType: "image/jpeg",
          fileSize: 184320,
          url: "#",
          uploadedBy: siteUser.id,
          uploadedByName: siteUser.fullName,
          createdAt: "2026-06-20T10:05:00.000Z",
        },
      ],
      readBy: [siteUser],
    }),
  ];

  const groupCreatedAt = "2026-06-19T08:00:00.000Z";
  const groupMessages = [
    makeMessage({
      id: "msg-demo-003",
      conversationId: "conv-demo-002",
      sender: admin,
      body: "Safety toolbox minutes are attached for today's site briefing.",
      createdAt: "2026-06-19T08:15:00.000Z",
      attachments: [
        {
          id: "msg-attachment-demo-002",
          fileName: "toolbox-minutes.pdf",
          fileType: "application/pdf",
          fileSize: 362144,
          url: "#",
          uploadedBy: admin.id,
          uploadedByName: admin.fullName,
          createdAt: "2026-06-19T08:15:00.000Z",
        },
      ],
      readBy: [admin, manager, siteUser, devUser],
    }),
    makeMessage({
      id: "msg-demo-004",
      conversationId: "conv-demo-002",
      sender: manager,
      body: "Confirm barricade status after lunch and reply in this thread.",
      createdAt: "2026-06-20T11:10:00.000Z",
      readBy: [manager],
    }),
  ];

  const financeCreatedAt = "2026-06-18T14:00:00.000Z";
  const financeMessages = [
    makeMessage({
      id: "msg-demo-005",
      conversationId: "conv-demo-003",
      sender: accounts,
      body: "Voucher PV-2026-0001 is ready. Please confirm the bank reference once received.",
      createdAt: "2026-06-18T14:15:00.000Z",
      readBy: [accounts, siteUser],
    }),
    makeMessage({
      id: "msg-demo-006",
      conversationId: "conv-demo-003",
      sender: siteUser,
      body: "Received. I will update the claim ledger after the bank SMS arrives.",
      createdAt: "2026-06-18T15:05:00.000Z",
      readBy: [siteUser, accounts],
    }),
  ];

  return [
    {
      id: "conv-demo-001",
      type: "direct",
      title: "Kabir Manager / Rohan Site",
      createdBy: manager.id,
      createdByName: manager.fullName,
      participants: [
        participantFor(manager, directCreatedAt),
        participantFor(siteUser, directCreatedAt),
      ],
      messages: directMessages,
      lastMessageAt: directMessages.at(-1)?.createdAt ?? directCreatedAt,
      createdAt: directCreatedAt,
      updatedAt: directMessages.at(-1)?.createdAt ?? directCreatedAt,
    },
    {
      id: "conv-demo-002",
      type: "project",
      title: "Metro Package Team",
      description: "Project coordination, safety updates and daily execution notes.",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      createdBy: admin.id,
      createdByName: admin.fullName,
      participants: [
        participantFor(admin, groupCreatedAt),
        participantFor(manager, groupCreatedAt),
        participantFor(siteUser, groupCreatedAt),
        participantFor(devUser, groupCreatedAt),
      ],
      messages: groupMessages,
      lastMessageAt: groupMessages.at(-1)?.createdAt ?? groupCreatedAt,
      createdAt: groupCreatedAt,
      updatedAt: groupMessages.at(-1)?.createdAt ?? groupCreatedAt,
    },
    {
      id: "conv-demo-003",
      type: "direct",
      title: "Nisha Accounts / Rohan Site",
      createdBy: accounts.id,
      createdByName: accounts.fullName,
      participants: [
        participantFor(accounts, financeCreatedAt),
        participantFor(siteUser, financeCreatedAt),
      ],
      messages: financeMessages,
      lastMessageAt: financeMessages.at(-1)?.createdAt ?? financeCreatedAt,
      createdAt: financeCreatedAt,
      updatedAt: financeMessages.at(-1)?.createdAt ?? financeCreatedAt,
    },
    {
      id: "conv-demo-004",
      type: "group",
      title: "Tower Site Coordination",
      description: "Tower package planning and material follow-ups.",
      projectId: "project-tower",
      projectName: getProjectName("project-tower"),
      createdBy: manager.id,
      createdByName: manager.fullName,
      participants: [
        participantFor(manager, "2026-06-19T12:00:00.000Z"),
        participantFor(secondUser, "2026-06-19T12:00:00.000Z"),
      ],
      messages: [
        makeMessage({
          id: "msg-demo-007",
          conversationId: "conv-demo-004",
          sender: manager,
          body: "Please keep this group updated on shuttering material receipts.",
          createdAt: "2026-06-19T12:10:00.000Z",
          readBy: [manager],
        }),
      ],
      lastMessageAt: "2026-06-19T12:10:00.000Z",
      createdAt: "2026-06-19T12:00:00.000Z",
      updatedAt: "2026-06-19T12:10:00.000Z",
    },
  ];
}

function readConversations() {
  if (isSupabaseConfigured) {
    return memoryConversations ?? [];
  }
  if (!isBrowser()) {
    memoryConversations ??= seedConversations();
    return memoryConversations;
  }
  const stored = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
  if (!stored) {
    const seeded = seedConversations();
    window.localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(seeded));
    memoryConversations = seeded;
    return seeded;
  }
  try {
    const parsed = JSON.parse(stored) as Conversation[];
    memoryConversations = parsed;
    return parsed;
  } catch {
    const seeded = seedConversations();
    window.localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(seeded));
    memoryConversations = seeded;
    return seeded;
  }
}

function writeConversations(conversations: Conversation[]) {
  memoryConversations = conversations;
  if (isSupabaseConfigured) {
    return;
  }
  if (isBrowser()) {
    window.localStorage.setItem(
      CONVERSATIONS_STORAGE_KEY,
      JSON.stringify(conversations),
    );
  }
}

function participantForUser(conversation: Conversation, user: AppUser) {
  return conversation.participants.find((participant) => participant.userId === user.id);
}

function canViewConversation(user: AppUser, conversation: Conversation) {
  return (
    Boolean(participantForUser(conversation, user)) ||
    ["admin_hr", "super_admin"].includes(user.role)
  );
}

function isArchivedForUser(conversation: Conversation, user: AppUser) {
  return Boolean(participantForUser(conversation, user)?.archivedAt);
}

function applyFilters(
  conversations: Conversation[],
  user: AppUser,
  filters?: ConversationFilters,
) {
  return conversations.filter((conversation) => {
    const tab = filters?.tab ?? "all";
    if (tab !== "archived" && isArchivedForUser(conversation, user)) {
      return false;
    }
    if (tab === "archived" && !isArchivedForUser(conversation, user)) {
      return false;
    }
    if (tab === "unread" && getUnreadCount(conversation, user) === 0) {
      return false;
    }
    if (tab === "groups" && conversation.type === "direct") {
      return false;
    }
    if (filters?.search?.trim()) {
      const query = filters.search.trim().toLowerCase();
      const haystack = [
        getConversationTitle(conversation, user),
        conversation.description,
        conversation.projectName,
        ...conversation.participants.map((participant) => participant.userName),
        ...conversation.messages.map((message) => message.body),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    }
    return true;
  });
}

function sortConversations(conversations: Conversation[], user: AppUser) {
  return [...conversations].sort((left, right) => {
    const leftPin = participantForUser(left, user)?.pinnedAt;
    const rightPin = participantForUser(right, user)?.pinnedAt;
    if (leftPin && !rightPin) {
      return -1;
    }
    if (!leftPin && rightPin) {
      return 1;
    }
    return right.lastMessageAt.localeCompare(left.lastMessageAt);
  });
}

async function getUniqueParticipants(inputIds: string[], actor: AppUser) {
  if (isSupabaseConfigured) {
    const users = await userHierarchyService.listUsers(actor.organizationId);
    return Array.from(new Set([actor.id, ...inputIds]))
      .map((id) =>
        id === actor.id ? actor : users.find((user) => user.id === id),
      )
      .filter(Boolean) as AppUser[];
  }
  return Array.from(new Set([actor.id, ...inputIds]))
    .map(getUserById)
    .filter(Boolean) as AppUser[];
}

async function loadConversations(actor: AppUser) {
  if (isSupabaseConfigured) {
    memoryConversations = await messagingRepository.list(actor);
  }
  return readConversations();
}

async function persistConversation(actor: AppUser, conversation: Conversation) {
  void actor;
  writeConversations([
    conversation,
    ...readConversations().filter((item) => item.id !== conversation.id),
  ]);
  return conversation;
}

function getReplyPreview(conversation: Conversation, messageId?: string) {
  if (!messageId) {
    return undefined;
  }
  const message = conversation.messages.find((item) => item.id === messageId);
  if (!message) {
    return undefined;
  }
  return message.body.slice(0, 120);
}

function summarize(conversations: Conversation[], user: AppUser): MessageDashboardSummary {
  return {
    totalConversations: conversations.length,
    unreadConversations: conversations.filter(
      (conversation) => getUnreadCount(conversation, user) > 0,
    ).length,
    groupConversations: conversations.filter(
      (conversation) => conversation.type !== "direct",
    ).length,
    sharedAttachments: conversations.reduce(
      (total, conversation) =>
        total +
        conversation.messages.reduce(
          (messageTotal, message) => messageTotal + message.attachments.length,
          0,
        ),
      0,
    ),
  };
}

export function getConversationTitle(
  conversation: Conversation,
  user: AppUser,
) {
  if (conversation.type !== "direct") {
    return conversation.title;
  }
  return (
    conversation.participants.find((participant) => participant.userId !== user.id)
      ?.userName ?? conversation.title
  );
}

export function getLastMessagePreview(conversation: Conversation) {
  const message = conversation.messages.at(-1);
  if (!message) {
    return "No messages yet.";
  }
  if (message.deletedAt) {
    return "This message was deleted.";
  }
  if (message.body.trim()) {
    return message.body;
  }
  return `${message.attachments.length} attachment(s)`;
}

export function getUnreadCount(conversation: Conversation, user: AppUser) {
  return conversation.messages.filter(
    (message) =>
      message.senderId !== user.id &&
      !message.readBy.some((receipt) => receipt.userId === user.id),
  ).length;
}

export function getReadReceiptLabel(message: Message, currentUser: AppUser) {
  if (message.senderId !== currentUser.id) {
    return "";
  }
  const readByOthers = message.readBy.filter(
    (receipt) => receipt.userId !== currentUser.id,
  );
  return readByOthers.length > 0
    ? `Read by ${readByOthers.map((receipt) => receipt.userName).join(", ")}`
    : "Sent";
}

export const messagingService = {
  async listContacts(user: AppUser) {
    if (isSupabaseConfigured) {
      const users = await userHierarchyService.listUsers(user.organizationId);
      return users.filter((item) => item.id !== user.id && item.status === "active");
    }
    return DEMO_USERS.map(toAppUser).filter((item) => item.id !== user.id);
  },

  async listConversations(user: AppUser, filters?: ConversationFilters) {
    const visible = (await loadConversations(user)).filter((conversation) =>
      canViewConversation(user, conversation),
    );
    return sortConversations(applyFilters(visible, user, filters), user);
  },

  async getDashboard(user: AppUser) {
    const conversations = await this.listConversations(user);
    return {
      summary: summarize(conversations, user),
      recent: conversations.slice(0, 6),
    };
  },

  async getConversation(conversationId: string, user: AppUser) {
    const conversation = (await loadConversations(user)).find(
      (item) => item.id === conversationId,
    );
    return conversation && canViewConversation(user, conversation)
      ? conversation
      : null;
  },

  async createConversation(input: NewConversationInput, actor: AppUser) {
    if (!input.firstMessage.trim() && input.attachments.length === 0) {
      throw new Error("Enter a message or attach a file.");
    }
    if (input.type === "direct" && input.participantIds.length !== 1) {
      throw new Error("Choose one recipient for a 1:1 chat.");
    }
    if (input.type !== "direct" && input.participantIds.length === 0) {
      throw new Error("Choose at least one participant.");
    }
    if (isSupabaseConfigured) {
      return messagingRepository.create(input, actor, input.participantIds);
    }
    const participants = await getUniqueParticipants(input.participantIds, actor);
    if (participants.length < 2) {
      throw new Error("Choose at least one participant.");
    }

    const createdAt = now();
    const conversationId = crypto.randomUUID();
    const title =
      input.type === "direct"
        ? participants.find((participant) => participant.id !== actor.id)
            ?.fullName ?? "Direct Chat"
        : input.title?.trim() || getProjectName(input.projectId) || "Group Chat";
    const firstMessage = makeMessage({
      id: crypto.randomUUID(),
      conversationId,
      sender: actor,
      body: input.firstMessage.trim(),
      createdAt,
      attachments: input.attachments,
      readBy: [actor],
    });

    const conversation: Conversation = {
      id: conversationId,
      type: input.type,
      title,
      description: input.description?.trim() || undefined,
      projectId: input.projectId,
      projectName: getProjectName(input.projectId),
      createdBy: actor.id,
      createdByName: actor.fullName,
      participants: participants.map((participant) =>
        participantFor(participant, createdAt),
      ),
      messages: [firstMessage],
      lastMessageAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };
    await persistConversation(actor, conversation);
    return conversation;
  },

  async sendMessage(input: SendMessageInput, actor: AppUser) {
    if (isSupabaseConfigured) {
      return messagingRepository.send(input, actor);
    }
    const conversations = await loadConversations(actor);
    const conversation = conversations.find(
      (item) => item.id === input.conversationId,
    );
    if (!conversation || !canViewConversation(actor, conversation)) {
      throw new Error("Conversation not found.");
    }
    if (!input.body.trim() && input.attachments.length === 0) {
      throw new Error("Enter a message or attach a file.");
    }

    const createdAt = now();
    const message = makeMessage({
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      sender: actor,
      body: input.body.trim(),
      createdAt,
      attachments: input.attachments,
      readBy: [actor],
      repliedToId: input.repliedToId,
      repliedToPreview: getReplyPreview(conversation, input.repliedToId),
    });
    const updatedConversation: Conversation = {
      ...conversation,
      messages: [...conversation.messages, message],
      lastMessageAt: createdAt,
      updatedAt: createdAt,
    };
    await persistConversation(actor, updatedConversation);
    return message;
  },

  async markConversationRead(conversationId: string, actor: AppUser) {
    if (isSupabaseConfigured) {
      return messagingRepository.markRead(conversationId, actor);
    }
    const conversations = await loadConversations(actor);
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation || !canViewConversation(actor, conversation)) {
      throw new Error("Conversation not found.");
    }
    const readAt = now();
    const updatedConversation: Conversation = {
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.readBy.some((receipt) => receipt.userId === actor.id)
          ? message
          : {
              ...message,
              readBy: [...message.readBy, readReceiptFor(actor, readAt)],
              updatedAt: readAt,
            },
      ),
      updatedAt: readAt,
    };
    await persistConversation(actor, updatedConversation);
    return updatedConversation;
  },

  async toggleReaction(
    conversationId: string,
    messageId: string,
    label: string,
    actor: AppUser,
  ) {
    if (isSupabaseConfigured) {
      return messagingRepository.toggleReaction(
        conversationId,
        messageId,
        label,
        actor,
      );
    }
    const conversations = await loadConversations(actor);
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation || !canViewConversation(actor, conversation)) {
      throw new Error("Conversation not found.");
    }
    const updatedAt = now();
    const updatedConversation: Conversation = {
      ...conversation,
      messages: conversation.messages.map((message) => {
        if (message.id !== messageId) {
          return message;
        }
        const existing = message.reactions.find(
          (reaction) => reaction.label === label,
        );
        if (!existing) {
          return {
            ...message,
            reactions: [
              ...message.reactions,
              {
                label,
                userIds: [actor.id],
                userNames: [actor.fullName],
              },
            ],
            updatedAt,
          };
        }
        const hasReacted = existing.userIds.includes(actor.id);
        const nextReaction = {
          ...existing,
          userIds: hasReacted
            ? existing.userIds.filter((userId) => userId !== actor.id)
            : [...existing.userIds, actor.id],
          userNames: hasReacted
            ? existing.userNames.filter((userName) => userName !== actor.fullName)
            : [...existing.userNames, actor.fullName],
        };
        return {
          ...message,
          reactions: message.reactions
            .map((reaction) =>
              reaction.label === label ? nextReaction : reaction,
            )
            .filter((reaction) => reaction.userIds.length > 0),
          updatedAt,
        };
      }),
      updatedAt,
    };
    await persistConversation(actor, updatedConversation);
    return updatedConversation;
  },

  async setConversationArchived(
    conversationId: string,
    actor: AppUser,
    archived: boolean,
  ) {
    if (isSupabaseConfigured) {
      return messagingRepository.setMemberSetting(conversationId, actor, {
        archived_at: archived ? now() : null,
      });
    }
    return updateParticipantSetting(conversationId, actor, (participant) => ({
      ...participant,
      archivedAt: archived ? now() : undefined,
    }));
  },

  async setConversationMuted(
    conversationId: string,
    actor: AppUser,
    muted: boolean,
  ) {
    const mutedUntil = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    if (isSupabaseConfigured) {
      return messagingRepository.setMemberSetting(conversationId, actor, {
        muted_until: muted ? mutedUntil : null,
      });
    }
    return updateParticipantSetting(conversationId, actor, (participant) => ({
      ...participant,
      mutedUntil: muted ? mutedUntil : undefined,
    }));
  },

  async setConversationPinned(
    conversationId: string,
    actor: AppUser,
    pinned: boolean,
  ) {
    if (isSupabaseConfigured) {
      return messagingRepository.setMemberSetting(conversationId, actor, {
        pinned_at: pinned ? now() : null,
      });
    }
    return updateParticipantSetting(conversationId, actor, (participant) => ({
      ...participant,
      pinnedAt: pinned ? now() : undefined,
    }));
  },

  resetDemoData() {
    writeConversations(seedConversations());
  },

  subscribe(conversationId: string, onChange: () => void) {
    if (!isSupabaseConfigured) return () => undefined;
    return messagingRepository.subscribe(conversationId, onChange);
  },
};

async function updateParticipantSetting(
  conversationId: string,
  actor: AppUser,
  updater: (participant: ConversationParticipant) => ConversationParticipant,
) {
  const conversations = await loadConversations(actor);
  const conversation = conversations.find((item) => item.id === conversationId);
  const participant = conversation ? participantForUser(conversation, actor) : null;
  if (!conversation || !participant) {
    throw new Error("Conversation not found.");
  }
  const updatedAt = now();
  const updatedConversation: Conversation = {
    ...conversation,
    participants: conversation.participants.map((item) =>
      item.userId === actor.id ? updater(item) : item,
    ),
    updatedAt,
  };
  await persistConversation(actor, updatedConversation);
  return updatedConversation;
}

export type { MessageAttachment };
