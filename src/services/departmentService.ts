import { hierarchyDemoStore } from "@/services/hierarchyDemoStore";
import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type { Department, DepartmentInput } from "@/types/organization";

interface DepartmentRow {
  id: string;
  organization_id: string;
  parent_department_id: string | null;
  department_code: string;
  department_name: string;
  description: string | null;
  hod_user_id: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

function assertCanManage(actor: AppUser) {
  if (!["admin_hr", "super_admin"].includes(actor.role)) {
    throw new Error("Only Admin / HR or Super Admin can manage departments.");
  }
}

function now() {
  return new Date().toISOString();
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function validateDepartment(input: DepartmentInput) {
  if (!input.organizationId) {
    throw new Error("Organization is required.");
  }
  if (!input.departmentName.trim()) {
    throw new Error("Department name is required.");
  }
  if (!input.departmentCode.trim()) {
    throw new Error("Department code is required.");
  }
}

function hodName(hodUserId?: string) {
  return hierarchyDemoStore
    .getUsers()
    .find((user) => user.id === hodUserId)?.fullName;
}

function userCount(departmentId: string) {
  return hierarchyDemoStore
    .getUsers()
    .filter((user) => user.departmentId === departmentId).length;
}

function mapDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    organizationId: row.organization_id,
    parentDepartmentId: row.parent_department_id ?? undefined,
    departmentCode: row.department_code,
    departmentName: row.department_name,
    description: row.description ?? undefined,
    hodUserId: row.hod_user_id ?? undefined,
    hodUserName: undefined,
    userCount: 0,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? undefined,
    updatedBy: row.updated_by ?? undefined,
  };
}

function toDepartmentRow(
  input: DepartmentInput,
  actor: AppUser,
): Partial<DepartmentRow> {
  return {
    organization_id: input.organizationId,
    parent_department_id: input.parentDepartmentId || null,
    department_code: normalizeCode(input.departmentCode),
    department_name: input.departmentName.trim(),
    description: input.description?.trim() || null,
    hod_user_id: input.hodUserId || null,
    status: input.status ?? "active",
    created_by: actor.id,
    updated_by: actor.id,
  };
}

function assertUniqueDepartmentCode(input: DepartmentInput, departmentId?: string) {
  const duplicate = hierarchyDemoStore
    .getDepartments()
    .some(
      (department) =>
        department.organizationId === input.organizationId &&
        department.departmentCode === normalizeCode(input.departmentCode) &&
        department.id !== departmentId,
    );
  if (duplicate) {
    throw new Error("Department code must be unique per organization.");
  }
}

function assertActiveHod(hodUserId?: string) {
  if (!hodUserId) {
    return;
  }
  const hod = hierarchyDemoStore.getUsers().find((user) => user.id === hodUserId);
  if (!hod || hod.status !== "active") {
    throw new Error("HOD must be an active user.");
  }
}

export const departmentService = {
  async getDepartments(organizationId?: string) {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from("departments").select("*").order("department_name");
      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      return (data as DepartmentRow[]).map(mapDepartment);
    }

    return hierarchyDemoStore
      .getDepartments()
      .filter(
        (department) =>
          !organizationId || department.organizationId === organizationId,
      )
      .map((department) => ({
        ...department,
        hodUserName: hodName(department.hodUserId),
        userCount: userCount(department.id),
      }))
      .sort((left, right) =>
        left.departmentName.localeCompare(right.departmentName),
      );
  },

  async getDepartmentById(departmentId: string) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("id", departmentId)
        .maybeSingle();
      if (error) {
        throw new Error(error.message);
      }
      return data ? mapDepartment(data as DepartmentRow) : null;
    }

    return (
      hierarchyDemoStore
        .getDepartments()
        .find((department) => department.id === departmentId) ?? null
    );
  },

  async createDepartment(input: DepartmentInput, actor: AppUser) {
    assertCanManage(actor);
    validateDepartment(input);
    assertActiveHod(input.hodUserId);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("departments")
        .insert(toDepartmentRow(input, actor))
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const department = mapDepartment(data as DepartmentRow);
      await recordAuditLog({
        userId: actor.id,
        action: "department.created",
        entityType: "department",
        entityId: department.id,
        newValues: { departmentCode: department.departmentCode },
      });
      return department;
    }

    assertUniqueDepartmentCode(input);
    const department: Department = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      parentDepartmentId: input.parentDepartmentId || undefined,
      departmentCode: normalizeCode(input.departmentCode),
      departmentName: input.departmentName.trim(),
      description: input.description?.trim() || undefined,
      hodUserId: input.hodUserId || undefined,
      hodUserName: hodName(input.hodUserId),
      userCount: 0,
      status: input.status ?? "active",
      createdAt: now(),
      updatedAt: now(),
      createdBy: actor.id,
      updatedBy: actor.id,
    };
    hierarchyDemoStore.setDepartments([
      department,
      ...hierarchyDemoStore.getDepartments(),
    ]);
    await recordAuditLog({
      userId: actor.id,
      action: "department.created",
      entityType: "department",
      entityId: department.id,
      newValues: { departmentCode: department.departmentCode },
    });
    return department;
  },

  async updateDepartment(
    departmentId: string,
    input: DepartmentInput,
    actor: AppUser,
  ) {
    assertCanManage(actor);
    validateDepartment(input);
    assertActiveHod(input.hodUserId);

    if (isSupabaseConfigured && supabase) {
      const { data: currentData } = await supabase
        .from("departments")
        .select("*")
        .eq("id", departmentId)
        .maybeSingle();
      const { data, error } = await supabase
        .from("departments")
        .update(toDepartmentRow(input, actor))
        .eq("id", departmentId)
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const department = mapDepartment(data as DepartmentRow);
      await recordAuditLog({
        userId: actor.id,
        action: "department.updated",
        entityType: "department",
        entityId: department.id,
        oldValues: currentData
          ? (currentData as Record<string, unknown>)
          : undefined,
        newValues: { departmentCode: department.departmentCode },
      });
      return department;
    }

    const departments = hierarchyDemoStore.getDepartments();
    const current = departments.find((department) => department.id === departmentId);
    if (!current) {
      throw new Error("Department not found.");
    }
    assertUniqueDepartmentCode(input, departmentId);
    const updated: Department = {
      ...current,
      parentDepartmentId: input.parentDepartmentId || undefined,
      departmentCode: normalizeCode(input.departmentCode),
      departmentName: input.departmentName.trim(),
      description: input.description?.trim() || undefined,
      hodUserId: input.hodUserId || undefined,
      hodUserName: hodName(input.hodUserId),
      status: input.status ?? current.status,
      updatedAt: now(),
      updatedBy: actor.id,
    };
    hierarchyDemoStore.setDepartments(
      departments.map((department) =>
        department.id === departmentId ? updated : department,
      ),
    );
    await recordAuditLog({
      userId: actor.id,
      action: "department.updated",
      entityType: "department",
      entityId: updated.id,
      oldValues: { hodUserId: current.hodUserId },
      newValues: { hodUserId: updated.hodUserId },
    });
    return updated;
  },

  async assignDepartmentHod(
    departmentId: string,
    hodUserId: string,
    actor: AppUser,
  ) {
    const department = await this.getDepartmentById(departmentId);
    if (!department) {
      throw new Error("Department not found.");
    }
    return this.updateDepartment(
      departmentId,
      {
        organizationId: department.organizationId,
        parentDepartmentId: department.parentDepartmentId,
        departmentCode: department.departmentCode,
        departmentName: department.departmentName,
        description: department.description,
        hodUserId,
        status: department.status,
      },
      actor,
    );
  },

  async deactivateDepartment(departmentId: string, actor: AppUser) {
    const department = await this.getDepartmentById(departmentId);
    if (!department) {
      throw new Error("Department not found.");
    }
    return this.updateDepartment(
      departmentId,
      {
        organizationId: department.organizationId,
        parentDepartmentId: department.parentDepartmentId,
        departmentCode: department.departmentCode,
        departmentName: department.departmentName,
        description: department.description,
        hodUserId: department.hodUserId,
        status: "inactive",
      },
      actor,
    );
  },

  async getDepartmentUsers(departmentId: string) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("department_id", departmentId)
        .eq("status", "active")
        .order("full_name");
      if (error) {
        throw new Error(error.message);
      }
      return data as Record<string, unknown>[];
    }

    return hierarchyDemoStore
      .getUsers()
      .filter((user) => user.departmentId === departmentId);
  },

  resetDemoData() {
    hierarchyDemoStore.reset();
  },
};
