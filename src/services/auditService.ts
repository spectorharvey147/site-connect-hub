import { supabase } from "@/services/supabaseClient";
/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase joined audit rows are normalized here. */

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
export interface ClaimAuditEvent extends StoredAuditEvent { actorName?:string;actorRole?:string;remarks?:string;amountBefore?:number;amountAfter?:number;source?:"web"|"email_link"|"edge_function";ipAddress?:string }

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
export async function listClaimAuditLogs(claimId:string):Promise<ClaimAuditEvent[]>{if(!supabase)return readLocalAuditLogs().filter(row=>row.entityId===claimId);const{data,error}=await supabase.from("audit_logs").select("*,actor:user_profiles!audit_logs_actor_user_id_fkey(full_name,role_id)").eq("entity_type","claim").eq("entity_id",claimId).order("created_at",{ascending:true});if(error)throw new Error(error.message);return(data??[]).map((row:any)=>({id:row.id,userId:row.user_id??row.actor_user_id,action:row.action,entityType:row.entity_type,entityId:row.entity_id,oldValues:row.old_values??undefined,newValues:row.new_values??undefined,createdAt:row.created_at,actorName:row.actor?.full_name??undefined,actorRole:row.actor_role??row.actor?.role_id??undefined,remarks:row.remarks??undefined,amountBefore:row.amount_before==null?undefined:Number(row.amount_before),amountAfter:row.amount_after==null?undefined:Number(row.amount_after),source:row.source??"web",ipAddress:row.ip_address??undefined}));}
