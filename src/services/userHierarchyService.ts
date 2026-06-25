import { hierarchyDemoStore } from "@/services/hierarchyDemoStore";
import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { AppUser, Role, UserStatus } from "@/types/auth";
import type { ManagedUser } from "@/types/users";
import type {
  HierarchyUserInput,
  UserHierarchyNode,
  UserProjectAssignment,
} from "@/types/organization";

interface UserProfileRow {
  id: string;
  organization_id: string | null;
  employee_id: string | null;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role_id: Role;
  manager_id: string | null;
  reporting_manager_id: string | null;
  department: string | null;
  department_id: string | null;
  designation_id: string | null;
  hod_user_id: string | null;
  primary_project_id: string | null;
  employment_type: "permanent" | "contract" | "casual" | null;
  joining_date: string | null;
  avatar_url: string | null;
  profile_photo_url: string | null;
  status: UserStatus;
}

function assertCanManage(actor: AppUser) {
  if (!["admin_hr", "super_admin"].includes(actor.role)) {
    throw new Error("Only Admin / HR or Super Admin can manage user hierarchy.");
  }
}

function now() {
  return new Date().toISOString();
}

function fullName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function mapUser(row: UserProfileRow): ManagedUser {
  const employeeId = row.employee_code ?? row.employee_id ?? "";
  return {
    id: row.id,
    organizationId: row.organization_id ?? undefined,
    employeeId,
    employeeCode: row.employee_code ?? employeeId,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    fullName: row.full_name,
    email: row.email ?? "",
    phone: row.phone ?? undefined,
    role: row.role_id,
    managerId: row.reporting_manager_id ?? row.manager_id ?? undefined,
    reportingManagerId: row.reporting_manager_id ?? row.manager_id ?? undefined,
    department: row.department ?? undefined,
    departmentId: row.department_id ?? undefined,
    designationId: row.designation_id ?? undefined,
    hodUserId: row.hod_user_id ?? undefined,
    primaryProjectId: row.primary_project_id ?? undefined,
    employmentType: row.employment_type ?? undefined,
    joiningDate: row.joining_date ?? undefined,
    avatarUrl: row.profile_photo_url ?? row.avatar_url ?? undefined,
    status: row.status,
    projectIds: row.primary_project_id ? [row.primary_project_id] : [],
  };
}

function activeUser(userId?: string) {
  if (!userId) {
    return undefined;
  }
  return hierarchyDemoStore
    .getUsers()
    .find((user) => user.id === userId && user.status === "active");
}

function departmentName(departmentId?: string) {
  return hierarchyDemoStore
    .getDepartments()
    .find((department) => department.id === departmentId)?.departmentName;
}

function defaultHodForDepartment(departmentId: string) {
  return hierarchyDemoStore
    .getDepartments()
    .find((department) => department.id === departmentId)?.hodUserId;
}

function assertEmployeeCodeUnique(
  organizationId: string,
  employeeCode: string,
  userId?: string,
) {
  const duplicate = hierarchyDemoStore
    .getUsers()
    .some(
      (user) =>
        user.organizationId === organizationId &&
        (user.employeeCode ?? user.employeeId).toLowerCase() ===
          employeeCode.trim().toLowerCase() &&
        user.id !== userId,
    );
  if (duplicate) {
    throw new Error("Employee code must be unique per organization.");
  }
}

function assertSameOrganization(
  label: string,
  userId: string | undefined,
  organizationId: string,
) {
  if (!userId) {
    return;
  }
  const user = activeUser(userId);
  if (!user) {
    throw new Error(`${label} must be an active user.`);
  }
  if (user.organizationId !== organizationId) {
    throw new Error(`${label} must belong to the same organization.`);
  }
}

function assertHodMatchesDepartment(
  hodUserId: string | undefined,
  departmentId: string,
) {
  if (!hodUserId) {
    return;
  }
  const hod = activeUser(hodUserId);
  if (hod && hod.departmentId && hod.departmentId !== departmentId) {
    throw new Error("HOD should belong to the selected department.");
  }
}

function assertNoCircularManager(
  userId: string,
  managerId: string | undefined,
  users = hierarchyDemoStore.getUsers(),
) {
  if (!managerId) {
    return;
  }
  if (userId === managerId) {
    throw new Error("User cannot report to themselves.");
  }

  let currentManagerId: string | undefined = managerId;
  const visited = new Set<string>();
  while (currentManagerId) {
    if (currentManagerId === userId) {
      throw new Error("Circular reporting hierarchy is not allowed.");
    }
    if (visited.has(currentManagerId)) {
      throw new Error("Circular reporting hierarchy is not allowed.");
    }
    visited.add(currentManagerId);
    currentManagerId = users.find((user) => user.id === currentManagerId)
      ?.reportingManagerId;
  }
}

function validateHierarchyInput(input: HierarchyUserInput, userId?: string) {
  if (!input.organizationId) {
    throw new Error("Organization is required.");
  }
  if (!input.departmentId) {
    throw new Error("Department is required.");
  }
  if (!input.role) {
    throw new Error("Role is required.");
  }
  if (!input.employeeCode.trim()) {
    throw new Error("Employee code is required.");
  }
  if (!input.firstName.trim() || !input.lastName.trim()) {
    throw new Error("First and last name are required.");
  }
  if (!input.email.trim()) {
    throw new Error("Email is required.");
  }
  assertEmployeeCodeUnique(input.organizationId, input.employeeCode, userId);
  assertSameOrganization(
    "Reporting manager",
    input.reportingManagerId,
    input.organizationId,
  );
  assertSameOrganization("HOD", input.hodUserId, input.organizationId);
  assertHodMatchesDepartment(input.hodUserId, input.departmentId);
}

function toManagedUser(input: HierarchyUserInput, id = crypto.randomUUID()) {
  const hodUserId = input.hodUserId || defaultHodForDepartment(input.departmentId);
  const user: ManagedUser = {
    id,
    organizationId: input.organizationId,
    employeeId: input.employeeCode.trim(),
    employeeCode: input.employeeCode.trim(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    fullName: fullName(input.firstName, input.lastName),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || undefined,
    role: input.role,
    managerId: input.reportingManagerId || undefined,
    reportingManagerId: input.reportingManagerId || undefined,
    department: departmentName(input.departmentId),
    departmentId: input.departmentId,
    designationId: input.designationId || undefined,
    hodUserId,
    primaryProjectId: input.primaryProjectId || input.projectIds[0],
    employmentType: input.employmentType,
    joiningDate: input.joiningDate,
    status: input.status ?? "invited",
    projectIds: input.projectIds,
    invitedAt: now(),
  };
  return user;
}

function makeProjectAssignments(user: ManagedUser): UserProjectAssignment[] {
  return user.projectIds.map((projectId, index) => ({
    id: `${user.id}-${projectId}`,
    organizationId: user.organizationId ?? "",
    userId: user.id,
    projectId,
    departmentId: user.departmentId,
    assignmentType:
      projectId === user.primaryProjectId || index === 0 ? "primary" : "secondary",
    startDate: now().slice(0, 10),
    status: "active",
    createdAt: now(),
    updatedAt: now(),
  }));
}

function buildUserNode(user: AppUser, users: AppUser[]): UserHierarchyNode {
  const children = users
    .filter((candidate) => candidate.reportingManagerId === user.id)
    .map((candidate) => buildUserNode(candidate, users));
  return {
    id: user.id,
    label: user.fullName,
    subtitle: `${user.role.split("_").join(" ")}${
      user.employeeCode ? ` - ${user.employeeCode}` : ""
    }`,
    user,
    children,
  };
}

export const userHierarchyService = {
  async listUsers(organizationId?: string) {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from("user_profiles").select("*").order("full_name");
      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      return (data as UserProfileRow[]).map(mapUser);
    }

    return hierarchyDemoStore
      .getUsers()
      .filter((user) => !organizationId || user.organizationId === organizationId)
      .sort((left, right) => left.fullName.localeCompare(right.fullName));
  },

  async getUserById(userId: string) {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        throw new Error(error.message);
      }
      return data ? mapUser(data as UserProfileRow) : null;
    }

    return hierarchyDemoStore.getUsers().find((user) => user.id === userId) ?? null;
  },

  async createUserWithHierarchy(input: HierarchyUserInput, actor: AppUser) {
    assertCanManage(actor);

    if (isSupabaseConfigured && supabase) {
      if (
        !input.organizationId ||
        !input.employeeCode.trim() ||
        !input.firstName.trim() ||
        !input.lastName.trim() ||
        !input.email.trim() ||
        !input.departmentId
      ) {
        throw new Error("Complete all required user fields.");
      }
      const { data, error } = await supabase.functions.invoke("provision-user", {
        body: input,
      });
      if (error) {
        throw new Error(error.message);
      }
      if (data?.error) {
        throw new Error(String(data.error));
      }
      const created = await this.getUserById(String(data.id));
      if (!created) {
        throw new Error("User was provisioned but the profile could not be loaded.");
      }
      await recordAuditLog({
        userId: actor.id,
        action: "user.created_with_hierarchy",
        entityType: "user_profile",
        entityId: created.id,
        newValues: {
          employeeCode: created.employeeCode,
          departmentId: created.departmentId,
          reportingManagerId: created.reportingManagerId,
          hodUserId: created.hodUserId,
        },
      });
      return created;
    }

    validateHierarchyInput(input);
    assertNoCircularManager("new-user", input.reportingManagerId);
    const user = toManagedUser(input);
    const users = hierarchyDemoStore.getUsers();
    hierarchyDemoStore.setUsers([user, ...users]);
    hierarchyDemoStore.setProjectAssignments([
      ...makeProjectAssignments(user),
      ...hierarchyDemoStore.getProjectAssignments(),
    ]);
    await recordAuditLog({
      userId: actor.id,
      action: "user.created_with_hierarchy",
      entityType: "user_profile",
      entityId: user.id,
      newValues: {
        employeeCode: user.employeeCode,
        departmentId: user.departmentId,
        reportingManagerId: user.reportingManagerId,
        hodUserId: user.hodUserId,
      },
    });
    return user;
  },

  async updateUserDepartment(
    userId: string,
    departmentId: string,
    actor: AppUser,
    changeReason = "Department transfer",
  ) {
    assertCanManage(actor);
    if (isSupabaseConfigured && supabase) {
      const current = await this.getUserById(userId);
      if (!current) {
        throw new Error("User not found.");
      }
      const { error } = await supabase
        .from("user_profiles")
        .update({ department_id: departmentId, updated_by: actor.id })
        .eq("id", userId);
      if (error) {
        throw new Error(error.message);
      }
      const updated = await this.getUserById(userId);
      await recordAuditLog({
        userId: actor.id,
        action: "user.department_changed",
        entityType: "user_profile",
        entityId: userId,
        oldValues: { departmentId: current.departmentId },
        newValues: { departmentId, changeReason },
      });
      return updated ?? current;
    }
    const users = hierarchyDemoStore.getUsers();
    const current = users.find((user) => user.id === userId);
    if (!current) {
      throw new Error("User not found.");
    }
    const department = hierarchyDemoStore
      .getDepartments()
      .find((item) => item.id === departmentId);
    if (!department) {
      throw new Error("Department not found.");
    }
    const updated: ManagedUser = {
      ...current,
      departmentId,
      department: department.departmentName,
      hodUserId: department.hodUserId || current.hodUserId,
    };
    hierarchyDemoStore.setUsers(
      users.map((user) => (user.id === userId ? updated : user)),
    );
    await recordAuditLog({
      userId: actor.id,
      action: "user.department_changed",
      entityType: "user_profile",
      entityId: userId,
      oldValues: { departmentId: current.departmentId },
      newValues: { departmentId, changeReason },
    });
    return updated;
  },

  async updateReportingManager(
    userId: string,
    reportingManagerId: string | undefined,
    actor: AppUser,
    changeReason = "Reporting manager change",
  ) {
    assertCanManage(actor);
    if (userId === reportingManagerId) {
      throw new Error("User cannot report to themselves.");
    }
    if (isSupabaseConfigured && supabase) {
      const users = await this.listUsers(actor.organizationId);
      const current = users.find((user) => user.id === userId);
      if (!current) {
        throw new Error("User not found.");
      }
      const manager = reportingManagerId
        ? users.find((user) => user.id === reportingManagerId)
        : undefined;
      if (reportingManagerId && !manager) {
        throw new Error("Reporting manager must belong to the same organization.");
      }
      assertNoCircularManager(userId, reportingManagerId, users);
      const { error } = await supabase
        .from("user_profiles")
        .update({
          reporting_manager_id: reportingManagerId || null,
          manager_id: reportingManagerId || null,
          updated_by: actor.id,
        })
        .eq("id", userId);
      if (error) {
        throw new Error(error.message);
      }
      const updated = await this.getUserById(userId);
      await recordAuditLog({
        userId: actor.id,
        action: "user.reporting_manager_changed",
        entityType: "user_profile",
        entityId: userId,
        oldValues: { reportingManagerId: current.reportingManagerId },
        newValues: { reportingManagerId, changeReason },
      });
      return updated ?? current;
    }
    const users = hierarchyDemoStore.getUsers();
    const current = users.find((user) => user.id === userId);
    if (!current) {
      throw new Error("User not found.");
    }
    if (reportingManagerId) {
      assertSameOrganization(
        "Reporting manager",
        reportingManagerId,
        current.organizationId ?? "",
      );
    }
    assertNoCircularManager(userId, reportingManagerId, users);
    const updated: ManagedUser = {
      ...current,
      managerId: reportingManagerId,
      reportingManagerId,
    };
    hierarchyDemoStore.setUsers(
      users.map((user) => (user.id === userId ? updated : user)),
    );
    await recordAuditLog({
      userId: actor.id,
      action: "user.reporting_manager_changed",
      entityType: "user_profile",
      entityId: userId,
      oldValues: { reportingManagerId: current.reportingManagerId },
      newValues: { reportingManagerId, changeReason },
    });
    return updated;
  },

  async assignUserToProject(
    userId: string,
    projectId: string,
    actor: AppUser,
    assignmentType: UserProjectAssignment["assignmentType"] = "secondary",
  ) {
    assertCanManage(actor);
    const users = hierarchyDemoStore.getUsers();
    const current = users.find((user) => user.id === userId);
    if (!current) {
      throw new Error("User not found.");
    }
    const projectIds = Array.from(new Set([...current.projectIds, projectId]));
    const updated: ManagedUser = {
      ...current,
      projectIds,
      primaryProjectId:
        assignmentType === "primary" ? projectId : current.primaryProjectId,
    };
    hierarchyDemoStore.setUsers(
      users.map((user) => (user.id === userId ? updated : user)),
    );
    hierarchyDemoStore.setProjectAssignments([
      {
        id: `${userId}-${projectId}`,
        organizationId: current.organizationId ?? "",
        userId,
        projectId,
        departmentId: current.departmentId,
        assignmentType,
        startDate: now().slice(0, 10),
        status: "active",
        createdAt: now(),
        updatedAt: now(),
      },
      ...hierarchyDemoStore
        .getProjectAssignments()
        .filter(
          (assignment) =>
            !(assignment.userId === userId && assignment.projectId === projectId),
        ),
    ]);
    await recordAuditLog({
      userId: actor.id,
      action: "user.project_assigned",
      entityType: "user_project_assignment",
      entityId: `${userId}-${projectId}`,
      newValues: { userId, projectId, assignmentType },
    });
    return updated;
  },

  async getUserManagerChain(userId: string) {
    const users = await this.listUsers();
    const chain: AppUser[] = [];
    const visited = new Set<string>();
    let current = users.find((user) => user.id === userId);

    while (current?.reportingManagerId) {
      if (visited.has(current.reportingManagerId)) {
        break;
      }
      visited.add(current.reportingManagerId);
      const manager = users.find((user) => user.id === current?.reportingManagerId);
      if (!manager) {
        break;
      }
      chain.push(manager);
      current = manager;
    }

    return chain;
  },

  async getDirectReports(managerUserId: string) {
    const users = await this.listUsers();
    return users.filter((user) => user.reportingManagerId === managerUserId);
  },

  async getDepartmentHierarchy(
    departmentId: string,
  ): Promise<UserHierarchyNode | null> {
    const departments = hierarchyDemoStore.getDepartments();
    const department = departments.find((item) => item.id === departmentId);
    if (!department) {
      return null;
    }
    const users = await this.listUsers(department.organizationId);
    const departmentUsers = users.filter((user) => user.departmentId === departmentId);
    const topUsers = departmentUsers.filter(
      (user) =>
        !user.reportingManagerId ||
        !departmentUsers.some((candidate) => candidate.id === user.reportingManagerId),
    );

    return {
      id: department.id,
      label: department.departmentName,
      subtitle: department.departmentCode,
      children: topUsers.map((user) => buildUserNode(user, departmentUsers)),
    } satisfies UserHierarchyNode;
  },

  async getOrganizationHierarchy(
    organizationId?: string,
  ): Promise<UserHierarchyNode> {
    const organization = hierarchyDemoStore.getOrganization();
    const activeOrganizationId = organizationId ?? organization.id;
    const departments = hierarchyDemoStore
      .getDepartments()
      .filter(
        (department) =>
          department.organizationId === activeOrganizationId &&
          !department.parentDepartmentId,
      );

    const children = (
      await Promise.all(
        departments.map((department) => this.getDepartmentHierarchy(department.id)),
      )
    ).filter((node): node is UserHierarchyNode => node !== null);

    return {
      id: organization.id,
      label: organization.organizationName,
      subtitle: organization.organizationCode,
      children,
    } satisfies UserHierarchyNode;
  },

  resetDemoData() {
    hierarchyDemoStore.reset();
  },
};
