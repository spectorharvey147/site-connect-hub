import { hierarchyDemoStore } from "@/services/hierarchyDemoStore";
import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type { Designation, DesignationInput } from "@/types/organization";

interface DesignationRow {
  id: string;
  organization_id: string;
  department_id: string | null;
  designation_code: string;
  designation_name: string;
  level_rank: number;
  description: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

function assertCanManage(actor: AppUser) {
  if (!["admin_hr", "super_admin"].includes(actor.role)) {
    throw new Error("Only Admin / HR or Super Admin can manage designations.");
  }
}

function now() {
  return new Date().toISOString();
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function validateDesignation(input: DesignationInput) {
  if (!input.organizationId) {
    throw new Error("Organization is required.");
  }
  if (!input.designationName.trim()) {
    throw new Error("Designation name is required.");
  }
  if (!input.designationCode.trim()) {
    throw new Error("Designation code is required.");
  }
  if (!Number.isFinite(input.levelRank) || input.levelRank < 0) {
    throw new Error("Hierarchy rank must be a positive number.");
  }
}

function mapDesignation(row: DesignationRow): Designation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    departmentId: row.department_id ?? undefined,
    designationCode: row.designation_code,
    designationName: row.designation_name,
    levelRank: row.level_rank,
    description: row.description ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDesignationRow(input: DesignationInput): Partial<DesignationRow> {
  return {
    organization_id: input.organizationId,
    department_id: input.departmentId || null,
    designation_code: normalizeCode(input.designationCode),
    designation_name: input.designationName.trim(),
    level_rank: input.levelRank,
    description: input.description?.trim() || null,
    status: input.status ?? "active",
  };
}

function assertUniqueDesignationCode(input: DesignationInput, designationId?: string) {
  const duplicate = hierarchyDemoStore
    .getDesignations()
    .some(
      (designation) =>
        designation.organizationId === input.organizationId &&
        designation.designationCode === normalizeCode(input.designationCode) &&
        designation.id !== designationId,
    );
  if (duplicate) {
    throw new Error("Designation code must be unique per organization.");
  }
}

export const designationService = {
  async getDesignations(organizationId?: string, departmentId?: string) {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from("designations")
        .select("*")
        .order("level_rank", { ascending: false });
      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      if (departmentId) {
        query = query.or(`department_id.eq.${departmentId},department_id.is.null`);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      return (data as DesignationRow[]).map(mapDesignation);
    }

    return hierarchyDemoStore
      .getDesignations()
      .filter(
        (designation) =>
          (!organizationId || designation.organizationId === organizationId) &&
          (!departmentId ||
            !designation.departmentId ||
            designation.departmentId === departmentId),
      )
      .sort((left, right) => right.levelRank - left.levelRank);
  },

  async createDesignation(input: DesignationInput, actor: AppUser) {
    assertCanManage(actor);
    validateDesignation(input);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("designations")
        .insert(toDesignationRow(input))
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const designation = mapDesignation(data as DesignationRow);
      await recordAuditLog({
        userId: actor.id,
        action: "designation.created",
        entityType: "designation",
        entityId: designation.id,
        newValues: { designationCode: designation.designationCode },
      });
      return designation;
    }

    assertUniqueDesignationCode(input);
    const designation: Designation = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      departmentId: input.departmentId || undefined,
      designationCode: normalizeCode(input.designationCode),
      designationName: input.designationName.trim(),
      levelRank: input.levelRank,
      description: input.description?.trim() || undefined,
      status: input.status ?? "active",
      createdAt: now(),
      updatedAt: now(),
    };
    hierarchyDemoStore.setDesignations([
      designation,
      ...hierarchyDemoStore.getDesignations(),
    ]);
    await recordAuditLog({
      userId: actor.id,
      action: "designation.created",
      entityType: "designation",
      entityId: designation.id,
      newValues: { designationCode: designation.designationCode },
    });
    return designation;
  },

  async updateDesignation(
    designationId: string,
    input: DesignationInput,
    actor: AppUser,
  ) {
    assertCanManage(actor);
    validateDesignation(input);

    if (isSupabaseConfigured && supabase) {
      const { data: currentData } = await supabase
        .from("designations")
        .select("*")
        .eq("id", designationId)
        .maybeSingle();
      const { data, error } = await supabase
        .from("designations")
        .update(toDesignationRow(input))
        .eq("id", designationId)
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const designation = mapDesignation(data as DesignationRow);
      await recordAuditLog({
        userId: actor.id,
        action: "designation.updated",
        entityType: "designation",
        entityId: designation.id,
        oldValues: currentData
          ? (currentData as Record<string, unknown>)
          : undefined,
        newValues: { designationCode: designation.designationCode },
      });
      return designation;
    }

    const designations = hierarchyDemoStore.getDesignations();
    const current = designations.find(
      (designation) => designation.id === designationId,
    );
    if (!current) {
      throw new Error("Designation not found.");
    }
    assertUniqueDesignationCode(input, designationId);
    const updated: Designation = {
      ...current,
      departmentId: input.departmentId || undefined,
      designationCode: normalizeCode(input.designationCode),
      designationName: input.designationName.trim(),
      levelRank: input.levelRank,
      description: input.description?.trim() || undefined,
      status: input.status ?? current.status,
      updatedAt: now(),
    };
    hierarchyDemoStore.setDesignations(
      designations.map((designation) =>
        designation.id === designationId ? updated : designation,
      ),
    );
    await recordAuditLog({
      userId: actor.id,
      action: "designation.updated",
      entityType: "designation",
      entityId: updated.id,
      oldValues: { levelRank: current.levelRank },
      newValues: { levelRank: updated.levelRank },
    });
    return updated;
  },

  async deactivateDesignation(designationId: string, actor: AppUser) {
    const designation = hierarchyDemoStore
      .getDesignations()
      .find((item) => item.id === designationId);
    if (!designation) {
      throw new Error("Designation not found.");
    }
    return this.updateDesignation(
      designationId,
      {
        organizationId: designation.organizationId,
        departmentId: designation.departmentId,
        designationCode: designation.designationCode,
        designationName: designation.designationName,
        levelRank: designation.levelRank,
        description: designation.description,
        status: "inactive",
      },
      actor,
    );
  },

  resetDemoData() {
    hierarchyDemoStore.reset();
  },
};
