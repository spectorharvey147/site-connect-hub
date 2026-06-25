import { supabase } from "@/services/supabaseClient";
import { recordAuditLog } from "@/services/auditService";
import type { AppUser } from "@/types/auth";
import type { AppNotification } from "@/types/notifications";
import type { NotificationType } from "@/types/notifications";

type Row = Record<string, unknown>;

function mapNotification(row: Row): AppNotification {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: normalizeType(String(row.type)),
    title: String(row.title),
    message: row.message ? String(row.message) : undefined,
    relatedId: row.related_id ? String(row.related_id) : undefined,
    relatedType: row.related_type ? String(row.related_type) : undefined,
    readAt: row.read_at ? String(row.read_at) : undefined,
    createdAt: String(row.created_at),
  };
}

function normalizeType(value: string): NotificationType {
  if (value.startsWith("claim")) return "claim";
  if (value.startsWith("leave")) return "leave";
  if (value.startsWith("task")) return "task";
  if (value.startsWith("message")) return "message";
  if (value.startsWith("payment") || value.includes("voucher")) return "payment";
  if (value.startsWith("vendor")) return "vendor";
  if (value.startsWith("material")) return "material";
  return "system";
}

export const notificationService = {
  async send(input: {
    userId: string;
    type: string;
    title: string;
    message?: string;
    relatedId?: string;
    relatedType?: string;
  }) {
    if (!supabase) return;
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: input,
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(String(data.error));
  },

  async listNotifications(): Promise<AppNotification[]> {
    if (!supabase) {
      return [];
    }
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      throw new Error(error.message);
    }
    return ((data as Row[] | null) ?? []).map(mapNotification);
  },

  async markRead(notificationId: string, actor?: AppUser) {
    if (!supabase) {
      return;
    }
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);
    if (error) {
      throw new Error(error.message);
    }
    if (actor) {
      await recordAuditLog({
        userId: actor.id,
        action: "notification.read",
        entityType: "notification",
        entityId: notificationId,
      });
    }
  },

  async markAllRead(actor?: AppUser) {
    if (!supabase) {
      return;
    }
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (error) {
      throw new Error(error.message);
    }
    if (actor) {
      await recordAuditLog({
        userId: actor.id,
        action: "notification.all_read",
        entityType: "notification",
      });
    }
  },

  subscribe(userId: string, onChange: () => void) {
    const client = supabase;
    if (!client) {
      return () => undefined;
    }
    const channel = client
      .channel(`notifications:${userId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        onChange,
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  },
};
