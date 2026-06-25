import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import {
  getUnreadCount,
  messagingService,
} from "@/services/messagingService";
import type { AppUser } from "@/types/auth";

function userByEmail(email: string): AppUser {
  const user = DEMO_USERS.find((item) => item.email === email);
  if (!user) {
    throw new Error(`Missing demo user ${email}`);
  }
  return toAppUser(user);
}

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };

  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
  });
}

describe("messagingService workflow", () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    messagingService.resetDemoData();
  });

  it("marks unread conversations as read", async () => {
    const manager = userByEmail("manager@siteconnect.local");
    const unread = await messagingService.listConversations(manager, {
      tab: "unread",
    });

    expect(unread.map((conversation) => conversation.id)).toContain(
      "conv-demo-001",
    );

    const conversation = await messagingService.markConversationRead(
      "conv-demo-001",
      manager,
    );

    expect(getUnreadCount(conversation, manager)).toBe(0);
  });

  it("sends a message and makes it unread for the recipient", async () => {
    const manager = userByEmail("manager@siteconnect.local");
    const siteUser = userByEmail("site@siteconnect.local");

    await messagingService.markConversationRead("conv-demo-001", siteUser);
    await messagingService.sendMessage(
      {
        conversationId: "conv-demo-001",
        body: "Please confirm when the checklist is signed.",
        attachments: [],
      },
      manager,
    );

    const conversation = await messagingService.getConversation(
      "conv-demo-001",
      siteUser,
    );

    expect(conversation).not.toBeNull();
    expect(conversation ? getUnreadCount(conversation, siteUser) : 0).toBe(1);
  });

  it("creates group conversations and toggles reactions", async () => {
    const manager = userByEmail("manager@siteconnect.local");
    const siteUser = userByEmail("site@siteconnect.local");
    const devUser = userByEmail("dev@siteconnect.local");

    await expect(
      messagingService.createConversation(
        {
          type: "direct",
          participantIds: [siteUser.id, devUser.id],
          firstMessage: "Invalid direct chat.",
          attachments: [],
        },
        manager,
      ),
    ).rejects.toThrow("Choose one recipient for a 1:1 chat.");

    const conversation = await messagingService.createConversation(
      {
        type: "group",
        title: "Pour Planning",
        description: "Concrete pour coordination.",
        participantIds: [siteUser.id, devUser.id],
        firstMessage: "Keep pour readiness updates in this group.",
        attachments: [],
      },
      manager,
    );

    const reacted = await messagingService.toggleReaction(
      conversation.id,
      conversation.messages[0].id,
      "Ack",
      siteUser,
    );

    expect(reacted.messages[0].reactions[0]?.label).toBe("Ack");
    expect(reacted.messages[0].reactions[0]?.userIds).toContain(siteUser.id);
  });
});
