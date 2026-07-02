import { recordAuditLog } from "@/services/auditService";
import { supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type { WorkType, WorkTypeInput } from "@/types/workTypes";

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function canManage(actor: AppUser) {
  if (!["admin_hr", "super_admin"].includes(actor.role)) throw new Error("Only administrators can manage work types.");
}

export const workTypeService = {
  async list(organizationId: string): Promise<WorkType[]> {
    const { data, error } = await client().from("work_types").select("*").eq("organization_id", organizationId).order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({ id: row.id, organizationId: row.organization_id, code: row.code, name: row.name, description: row.description ?? undefined, status: row.status }));
  },
  async save(input: WorkTypeInput, actor: AppUser, id?: string) {
    canManage(actor);
    if (!input.code.trim() || !input.name.trim()) throw new Error("Work type code and name are required.");
    const payload = { organization_id: input.organizationId, code: input.code.trim().toUpperCase(), name: input.name.trim(), description: input.description?.trim() || null, status: input.status, updated_by: actor.id };
    const mutation = id ? client().from("work_types").update(payload).eq("id", id) : client().from("work_types").insert({ ...payload, created_by: actor.id });
    const { error } = await mutation;
    if (error) throw new Error(error.message);
    await recordAuditLog({ userId: actor.id, action: id ? "work_type.updated" : "work_type.created", entityType: "work_type", entityId: id, newValues: input as unknown as Record<string, unknown> });
  },
  async remove(id: string, actor: AppUser) {
    canManage(actor);
    const { error } = await client().from("work_types").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await recordAuditLog({ userId: actor.id, action: "work_type.deleted", entityType: "work_type", entityId: id });
  },
};
