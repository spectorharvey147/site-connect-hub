import { hierarchyDemoStore } from "@/services/hierarchyDemoStore";
import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import { userHierarchyService } from "@/services/userHierarchyService";
import type { AppUser } from "@/types/auth";
import type {
  ManagedUser,
  UserInviteInput,
  UserManagementSummary,
  UserUpdateInput,
} from "@/types/users";

function assertCanManage(actor: AppUser) {
  if (!["admin_hr", "super_admin"].includes(actor.role)) {
    throw new Error("You do not have permission to manage users.");
  }
}

function summarize(users: ManagedUser[]): UserManagementSummary {
  return {
    totalUsers: users.length,
    activeUsers: users.filter((user) => user.status === "active").length,
    invitedUsers: users.filter((user) => user.status === "invited").length,
    lockedUsers: users.filter((user) => user.status === "locked").length,
    adminUsers: users.filter((user) =>
      ["admin_hr", "super_admin", "accounts_officer", "hod"].includes(user.role),
    ).length,
  };
}

function splitName(input: UserInviteInput) {
  const firstNameValue = input.firstName?.trim() ?? "";
  const lastNameValue = input.lastName?.trim() ?? "";
  if (firstNameValue || lastNameValue) {
    return {
      firstName: firstNameValue,
      lastName: lastNameValue || "-",
    };
  }
  const [firstName, ...rest] = input.fullName.trim().split(" ");
  return {
    firstName: firstName || input.email.split("@")[0],
    lastName: rest.join(" ") || "-",
  };
}

function nullableUuid(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanUuidList(values: string[] | undefined) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

export const usersService = {
  async listUsers(actor: AppUser) {
    assertCanManage(actor);
    return userHierarchyService.listUsers(actor.organizationId);
  },

  async getDashboard(actor: AppUser) {
    const users = await this.listUsers(actor);
    return {
      summary: summarize(users),
      users,
    };
  },

  async getUserById(userId: string, actor: AppUser) {
    assertCanManage(actor);
    return userHierarchyService.getUserById(userId);
  },

  async inviteUser(input: UserInviteInput, actor: AppUser) {
    assertCanManage(actor);
    if (!input.email.trim()) {
      throw new Error("Enter user email.");
    }
    const { firstName, lastName } = splitName(input);
    const projectIds = cleanUuidList(input.projectIds);
    const user = await userHierarchyService.createUserWithHierarchy(
      {
        organizationId: input.organizationId || actor.organizationId || "",
        employeeCode: input.employeeCode,
        firstName,
        lastName,
        email: input.email,
        phone: input.phone,
        role: input.role,
        departmentId: nullableUuid(input.departmentId) ?? "",
        designationId: nullableUuid(input.designationId) ?? undefined,
        reportingManagerId:
          nullableUuid(input.reportingManagerId) ??
          nullableUuid(input.managerId) ??
          undefined,
        hodUserId: nullableUuid(input.hodUserId) ?? undefined,
        primaryProjectId: nullableUuid(input.primaryProjectId) ?? projectIds[0],
        projectIds,
        employmentType: input.employmentType,
        joiningDate: input.joiningDate,
        status: "invited",
        password: input.password,
      },
      actor,
    );
    return user;
  },

  async updateUser(userId: string, input: UserUpdateInput, actor: AppUser) {
    assertCanManage(actor);
    const target = await userHierarchyService.getUserById(userId);
    if (!target) {
      throw new Error("User not found.");
    }
    if (target.role === "super_admin" && actor.role !== "super_admin") {
      throw new Error("Only Super Admin can update another Super Admin.");
    }

    const normalized = {
      ...input,
      departmentId: nullableUuid(input.departmentId) ?? undefined,
      designationId: nullableUuid(input.designationId) ?? undefined,
      reportingManagerId:
        nullableUuid(input.reportingManagerId) ??
        nullableUuid(input.managerId) ??
        undefined,
      hodUserId: nullableUuid(input.hodUserId) ?? undefined,
      primaryProjectId: nullableUuid(input.primaryProjectId) ?? undefined,
      projectIds: cleanUuidList(input.projectIds),
    };

    if (input.reportingManagerId !== undefined || input.managerId !== undefined) {
      await userHierarchyService.updateReportingManager(
        userId,
        normalized.reportingManagerId,
        actor,
      );
    }
    if (normalized.departmentId && normalized.departmentId !== target.departmentId) {
      await userHierarchyService.updateUserDepartment(
        userId,
        normalized.departmentId,
        actor,
      );
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("user_profiles")
        .update({
          role_id: input.role,
          status: input.status,
          designation_id: normalized.designationId,
          hod_user_id: normalized.hodUserId,
          primary_project_id: normalized.primaryProjectId,
          employment_type: input.employmentType,
          updated_by: actor.id,
        })
        .eq("id", userId)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      await recordAuditLog({
        userId: actor.id,
        action: "users.updated",
        entityType: "user_profile",
        entityId: userId,
        oldValues: {
          role: target.role,
          status: target.status,
          projectIds: target.projectIds,
        },
        newValues: input as Record<string, unknown>,
      });
      return data ? ((await userHierarchyService.getUserById(userId)) ?? target) : target;
    }

    const users = hierarchyDemoStore.getUsers();
    const current = users.find((user) => user.id === userId);
    if (!current) {
      throw new Error("User not found.");
    }
    const updated: ManagedUser = {
      ...current,
      role: input.role ?? current.role,
      status: input.status ?? current.status,
      projectIds: normalized.projectIds ?? current.projectIds,
      department: input.department ?? current.department,
      departmentId: normalized.departmentId ?? current.departmentId,
      designationId: normalized.designationId ?? current.designationId,
      managerId: normalized.reportingManagerId ?? current.managerId,
      reportingManagerId:
        normalized.reportingManagerId ?? current.reportingManagerId,
      hodUserId: normalized.hodUserId ?? current.hodUserId,
      primaryProjectId: normalized.primaryProjectId ?? current.primaryProjectId,
      employmentType: input.employmentType ?? current.employmentType,
    };
    hierarchyDemoStore.setUsers(
      users.map((user) => (user.id === userId ? updated : user)),
    );
    await recordAuditLog({
      userId: actor.id,
      action: "users.updated",
      entityType: "user_profile",
      entityId: userId,
      oldValues: {
        role: current.role,
        status: current.status,
        projectIds: current.projectIds,
      },
      newValues: input as Record<string, unknown>,
    });
    return updated;
  },

  resetDemoData() {
    hierarchyDemoStore.reset();
  },
};
