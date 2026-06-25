import { supabase } from "@/services/supabaseClient";

const LOCAL_AUDIT_KEY = "site-connect:audit-logs";

export interface AuditEvent {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

export interface StoredAuditEvent extends AuditEvent {
  id: string;
  createdAt: string;
}

function getLocalAuditEvents() {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(LOCAL_AUDIT_KEY);
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as StoredAuditEvent[];
  } catch {
    return [];
  }
}

export async function recordAuditLog(event: AuditEvent) {
  if (supabase) {
    await supabase.from("audit_logs").insert({
      user_id: event.userId,
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId,
      old_values: event.oldValues,
      new_values: event.newValues,
    });
    return;
  }

  if (typeof window === "undefined") {
    return;
  }

  const auditEvents = getLocalAuditEvents();
  const nextEvent: StoredAuditEvent = {
    ...event,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  window.localStorage.setItem(
    LOCAL_AUDIT_KEY,
    JSON.stringify([nextEvent, ...auditEvents].slice(0, 100)),
  );
}

export function readLocalAuditLogs() {
  return getLocalAuditEvents();
}
