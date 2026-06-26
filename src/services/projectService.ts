import { PROJECT_OPTIONS } from "@/constants/claims";
import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type {
  CommonCostCode,
  CommonCostCodeInput,
  Customer,
  ProjectCostCode,
  ProjectCostCodeInput,
  ProjectDepartmentAssignment,
  ProjectInput,
  ProjectMaster,
  ProjectUserAssignment,
} from "@/types/projects";

type Row = Record<string, unknown>;

function client() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

function assertCanManage(actor: AppUser) {
  if (!["admin_hr", "super_admin"].includes(actor.role)) {
    throw new Error("Only Admin / HR or Super Admin can manage projects.");
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return Number(value ?? 0);
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function projectCounts(projectId: string) {
  const [users, departments, costCodes] = await Promise.all([
    client()
      .from("user_project_assignments")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "active"),
    client()
      .from("department_project_assignments")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "active"),
    client()
      .from("project_cost_codes")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "active"),
  ]);
  return {
    assignedUserCount: users.count ?? 0,
    assignedDepartmentCount: departments.count ?? 0,
    costCodeCount: costCodes.count ?? 0,
  };
}

async function mapProject(row: Row): Promise<ProjectMaster> {
  const [manager, department, counts] = await Promise.all([
    row.project_manager_id
      ? client()
          .from("user_profiles")
          .select("full_name")
          .eq("id", String(row.project_manager_id))
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    row.primary_department_id
      ? client()
          .from("departments")
          .select("department_name")
          .eq("id", String(row.primary_department_id))
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    projectCounts(String(row.id)),
  ]);
  if (manager.error) {
    throw new Error(manager.error.message);
  }
  if (department.error) {
    throw new Error(department.error.message);
  }
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    code: String(row.code),
    name: String(row.name),
    customerId: text(row.customer_id),
    customerName: text(row.customer_name),
    location: text(row.location),
    address: text(row.address),
    city: text(row.city),
    state: text(row.state),
    pincode: text(row.pincode),
    latitude: row.latitude == null ? undefined : numberValue(row.latitude),
    longitude: row.longitude == null ? undefined : numberValue(row.longitude),
    geofenceRadius: numberValue(row.geofence_radius),
    startDate: text(row.start_date),
    endDate: text(row.end_date),
    projectBudget: numberValue(row.project_budget),
    projectManagerId: text(row.project_manager_id),
    projectManagerName: text((manager.data as Row | null)?.full_name),
    primaryDepartmentId: text(row.primary_department_id),
    primaryDepartmentName: text(
      (department.data as Row | null)?.department_name,
    ),
    description: text(row.description),
    status: row.status === "inactive" ? "inactive" : "active",
    ...counts,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function validateProject(input: ProjectInput) {
  if (!input.organizationId || !input.code.trim() || !input.name.trim()) {
    throw new Error("Organization, project code and project name are required.");
  }
  if (input.projectBudget < 0 || input.geofenceRadius < 0) {
    throw new Error("Budget and geofence radius cannot be negative.");
  }
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    throw new Error("Project end date must be after start date.");
  }
}

function projectPayload(input: ProjectInput, actor: AppUser) {
  return {
    organization_id: input.organizationId,
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    customer_id: input.customerId || null,
    customer_name: input.customerName?.trim() || null,
    location: input.location?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    pincode: input.pincode?.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    geofence_radius: input.geofenceRadius,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    project_budget: input.projectBudget,
    project_manager_id: input.projectManagerId || null,
    primary_department_id: input.primaryDepartmentId || null,
    description: input.description?.trim() || null,
    status: input.status,
    updated_by: actor.id,
  };
}

export const projectService = {
  async getProjects(organizationId?: string) {
    if (!isSupabaseConfigured || !supabase) {
      return PROJECT_OPTIONS.map(
        (project): ProjectMaster => ({
          id: project.id,
          organizationId: organizationId ?? "",
          code: project.code,
          name: project.name,
          location: project.location,
          geofenceRadius: 250,
          projectBudget: 0,
          status: "active",
          assignedUserCount: 0,
          assignedDepartmentCount: 0,
          costCodeCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );
    }
    let query = client()
      .from("projects")
      .select("*")
      .is("deleted_at", null)
      .order("name");
    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return Promise.all(((data as Row[] | null) ?? []).map(mapProject));
  },

  async getProjectById(projectId: string) {
    const { data, error } = await client()
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? mapProject(data as Row) : null;
  },

  async createProject(input: ProjectInput, actor: AppUser) {
    assertCanManage(actor);
    validateProject(input);
    const { data, error } = await client()
      .from("projects")
      .insert({ ...projectPayload(input, actor), created_by: actor.id })
      .select("*")
      .single();
    if (error) {
      throw new Error(error.message);
    }
    const project = await mapProject(data as Row);
    await recordAuditLog({
      userId: actor.id,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      newValues: input as unknown as Record<string, unknown>,
    });
    return project;
  },

  async updateProject(projectId: string, input: ProjectInput, actor: AppUser) {
    assertCanManage(actor);
    validateProject(input);
    const current = await this.getProjectById(projectId);
    if (!current) {
      throw new Error("Project not found.");
    }
    const { data, error } = await client()
      .from("projects")
      .update(projectPayload(input, actor))
      .eq("id", projectId)
      .select("*")
      .single();
    if (error) {
      throw new Error(error.message);
    }
    await recordAuditLog({
      userId: actor.id,
      action: "project.updated",
      entityType: "project",
      entityId: projectId,
      oldValues: current as unknown as Record<string, unknown>,
      newValues: input as unknown as Record<string, unknown>,
    });
    return mapProject(data as Row);
  },

  async getCustomers(organizationId: string): Promise<Customer[]> {
    const { data, error } = await client()
      .from("customers")
      .select("*")
      .eq("organization_id", organizationId)
      .order("customer_name");
    if (error) {
      throw new Error(error.message);
    }
    return ((data as Row[] | null) ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      customerCode: String(row.customer_code),
      customerName: String(row.customer_name),
      contactPerson: text(row.contact_person),
      email: text(row.email),
      phone: text(row.phone),
      billingAddress: text(row.billing_address),
      shippingAddress: text(row.shipping_address),
      city: text(row.city),
      state: text(row.state),
      gstNumber: text(row.gst_number),
      paymentTerms: text(row.payment_terms),
      status: row.status === "inactive" ? "inactive" : "active",
      remarks: text(row.remarks),
    }));
  },

  async getProjectCostCodes(projectId: string): Promise<ProjectCostCode[]> {
    const { data, error } = await client()
      .from("project_cost_codes")
      .select("*")
      .eq("project_id", projectId)
      .order("code");
    if (error) {
      throw new Error(error.message);
    }
    const rows = (data as Row[] | null) ?? [];
    const departmentIds = Array.from(
      new Set(rows.map((row) => text(row.responsible_department_id)).filter(Boolean)),
    ) as string[];
    const departments = departmentIds.length
      ? await client()
          .from("departments")
          .select("id, department_name")
          .in("id", departmentIds)
      : { data: [], error: null };
    if (departments.error) {
      throw new Error(departments.error.message);
    }
    const names = new Map(
      ((departments.data as Row[] | null) ?? []).map((row) => [
        String(row.id),
        String(row.department_name),
      ]),
    );
    return rows.map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      projectId: String(row.project_id),
      commonCostCodeId: text(row.common_cost_code_id),
      code: String(row.code),
      name: String(row.name),
      expenseType: row.expense_type as ProjectCostCode["expenseType"],
      customerIds: stringArray(row.customer_ids),
      expenseCategoryIds: stringArray(row.expense_category_ids),
      description: text(row.description),
      budgetAllocated: numberValue(row.budget_allocated),
      responsibleDepartmentId: text(row.responsible_department_id),
      responsibleDepartmentName: row.responsible_department_id
        ? names.get(String(row.responsible_department_id))
        : undefined,
      status: row.status === "inactive" ? "inactive" : "active",
    }));
  },

  async saveCostCode(
    input: ProjectCostCodeInput,
    actor: AppUser,
    costCodeId?: string,
  ) {
    assertCanManage(actor);
    if (!input.projectId || !input.code.trim() || !input.name.trim()) {
      throw new Error("Project, cost code and cost code name are required.");
    }
    if (input.budgetAllocated < 0) {
      throw new Error("Cost code budget cannot be negative.");
    }
    const payload = {
      organization_id: input.organizationId,
      project_id: input.projectId,
      common_cost_code_id: input.commonCostCodeId || null,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      expense_type: input.expenseType,
      customer_ids: input.customerIds ?? [],
      expense_category_ids: input.expenseCategoryIds ?? [],
      description: input.description?.trim() || null,
      budget_allocated: input.budgetAllocated,
      responsible_department_id: input.responsibleDepartmentId || null,
      status: input.status,
      updated_by: actor.id,
    };
    const mutation = costCodeId
      ? client()
          .from("project_cost_codes")
          .update(payload)
          .eq("id", costCodeId)
      : client()
          .from("project_cost_codes")
          .insert({ ...payload, created_by: actor.id });
    const { error } = await mutation;
    if (error) {
      throw new Error(error.message);
    }
    await recordAuditLog({
      userId: actor.id,
      action: costCodeId ? "cost_code.updated" : "cost_code.created",
      entityType: "project_cost_code",
      entityId: costCodeId,
      newValues: input as unknown as Record<string, unknown>,
    });
  },

  async getCommonCostCodes(organizationId: string): Promise<CommonCostCode[]> {
    if (!isSupabaseConfigured || !supabase) {
      return [];
    }
    const { data, error } = await client()
      .from("common_cost_codes")
      .select("*")
      .eq("organization_id", organizationId)
      .order("code");
    if (error) {
      throw new Error(error.message);
    }
    return ((data as Row[] | null) ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      code: String(row.code),
      name: String(row.name),
      expenseType: row.expense_type as CommonCostCode["expenseType"],
      customerIds: stringArray(row.customer_ids),
      expenseCategoryIds: stringArray(row.expense_category_ids),
      description: text(row.description),
      status: row.status === "inactive" ? "inactive" : "active",
    }));
  },

  async saveCommonCostCode(
    input: CommonCostCodeInput,
    actor: AppUser,
    commonCostCodeId?: string,
  ) {
    assertCanManage(actor);
    if (!input.organizationId || !input.code.trim() || !input.name.trim()) {
      throw new Error("Organization, common cost code and name are required.");
    }
    const payload = {
      organization_id: input.organizationId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      expense_type: input.expenseType,
      customer_ids: input.customerIds ?? [],
      expense_category_ids: input.expenseCategoryIds ?? [],
      description: input.description?.trim() || null,
      status: input.status,
      updated_by: actor.id,
    };
    const mutation = commonCostCodeId
      ? client().from("common_cost_codes").update(payload).eq("id", commonCostCodeId)
      : client().from("common_cost_codes").insert({ ...payload, created_by: actor.id });
    const { error } = await mutation;
    if (error) {
      throw new Error(error.message);
    }
    await recordAuditLog({
      userId: actor.id,
      action: commonCostCodeId ? "common_cost_code.updated" : "common_cost_code.created",
      entityType: "common_cost_code",
      entityId: commonCostCodeId,
      newValues: input as unknown as Record<string, unknown>,
    });
  },

  async getProjectUsers(projectId: string): Promise<ProjectUserAssignment[]> {
    const { data, error } = await client()
      .from("user_project_assignments")
      .select("*")
      .eq("project_id", projectId)
      .order("start_date", { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    const rows = (data as Row[] | null) ?? [];
    const [users, departments] = await Promise.all([
      client()
        .from("user_profiles")
        .select("id, full_name, employee_code")
        .in("id", rows.map((row) => String(row.user_id))),
      client()
        .from("departments")
        .select("id, department_name")
        .in(
          "id",
          rows
            .map((row) => text(row.department_id))
            .filter((id): id is string => Boolean(id)),
        ),
    ]);
    if (users.error || departments.error) {
      throw new Error(users.error?.message ?? departments.error?.message);
    }
    const userMap = new Map(
      ((users.data as Row[] | null) ?? []).map((row) => [String(row.id), row]),
    );
    const departmentMap = new Map(
      ((departments.data as Row[] | null) ?? []).map((row) => [
        String(row.id),
        String(row.department_name),
      ]),
    );
    return rows.map((row) => {
      const profile = userMap.get(String(row.user_id));
      return {
        id: String(row.id),
        organizationId: String(row.organization_id),
        userId: String(row.user_id),
        userName: String(profile?.full_name ?? "User"),
        employeeCode: String(profile?.employee_code ?? ""),
        projectId: String(row.project_id),
        departmentId: text(row.department_id),
        departmentName: row.department_id
          ? departmentMap.get(String(row.department_id))
          : undefined,
        assignmentType:
          row.assignment_type as ProjectUserAssignment["assignmentType"],
        startDate: String(row.start_date),
        endDate: text(row.end_date),
        status: row.status === "inactive" ? "inactive" : "active",
      };
    });
  },

  async getUserProjects(userId: string): Promise<ProjectUserAssignment[]> {
    const { data, error } = await client()
      .from("user_project_assignments")
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    const rows = (data as Row[] | null) ?? [];
    const user = await client()
      .from("user_profiles")
      .select("full_name, employee_code")
      .eq("id", userId)
      .maybeSingle();
    if (user.error) {
      throw new Error(user.error.message);
    }
    return rows.map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      userId,
      userName: String((user.data as Row | null)?.full_name ?? "User"),
      employeeCode: String((user.data as Row | null)?.employee_code ?? ""),
      projectId: String(row.project_id),
      departmentId: text(row.department_id),
      assignmentType:
        row.assignment_type as ProjectUserAssignment["assignmentType"],
      startDate: String(row.start_date),
      endDate: text(row.end_date),
      status: row.status === "inactive" ? "inactive" : "active",
    }));
  },

  async assignUser(
    input: Omit<ProjectUserAssignment, "id" | "userName" | "employeeCode" | "departmentName">,
    actor: AppUser,
  ) {
    assertCanManage(actor);
    if (input.endDate && input.endDate < input.startDate) {
      throw new Error("Assignment end date must be after start date.");
    }
    if (input.assignmentType === "primary") {
      await client()
        .from("user_project_assignments")
        .update({ status: "inactive", updated_by: actor.id })
        .eq("user_id", input.userId)
        .eq("assignment_type", "primary")
        .eq("status", "active");
    }
    const { error } = await client().from("user_project_assignments").insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      project_id: input.projectId,
      department_id: input.departmentId || null,
      assignment_type: input.assignmentType,
      start_date: input.startDate,
      end_date: input.endDate || null,
      status: input.status,
      created_by: actor.id,
      updated_by: actor.id,
    });
    if (error) {
      throw new Error(error.message);
    }
    if (input.assignmentType === "primary") {
      await client()
        .from("user_profiles")
        .update({ primary_project_id: input.projectId, updated_by: actor.id })
        .eq("id", input.userId);
    }
    await recordAuditLog({
      userId: actor.id,
      action: "project.user_assigned",
      entityType: "user_project_assignment",
      newValues: input as unknown as Record<string, unknown>,
    });
  },

  async getProjectDepartments(
    projectId: string,
  ): Promise<ProjectDepartmentAssignment[]> {
    const { data, error } = await client()
      .from("department_project_assignments")
      .select("*")
      .eq("project_id", projectId)
      .order("start_date", { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    const rows = (data as Row[] | null) ?? [];
    const departments = await client()
      .from("departments")
      .select("id, department_name")
      .in("id", rows.map((row) => String(row.department_id)));
    if (departments.error) {
      throw new Error(departments.error.message);
    }
    const names = new Map(
      ((departments.data as Row[] | null) ?? []).map((row) => [
        String(row.id),
        String(row.department_name),
      ]),
    );
    return rows.map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      departmentId: String(row.department_id),
      departmentName: names.get(String(row.department_id)) ?? "Department",
      projectId: String(row.project_id),
      assignmentType:
        row.assignment_type as ProjectDepartmentAssignment["assignmentType"],
      startDate: String(row.start_date),
      endDate: text(row.end_date),
      status: row.status === "inactive" ? "inactive" : "active",
    }));
  },

  async assignDepartment(
    input: Omit<ProjectDepartmentAssignment, "id" | "departmentName">,
    actor: AppUser,
  ) {
    assertCanManage(actor);
    if (input.endDate && input.endDate < input.startDate) {
      throw new Error("Assignment end date must be after start date.");
    }
    if (input.assignmentType === "primary") {
      await client()
        .from("department_project_assignments")
        .update({ status: "inactive", updated_by: actor.id })
        .eq("project_id", input.projectId)
        .eq("assignment_type", "primary")
        .eq("status", "active");
    }
    const { error } = await client()
      .from("department_project_assignments")
      .insert({
        organization_id: input.organizationId,
        department_id: input.departmentId,
        project_id: input.projectId,
        assignment_type: input.assignmentType,
        start_date: input.startDate,
        end_date: input.endDate || null,
        status: input.status,
        created_by: actor.id,
        updated_by: actor.id,
      });
    if (error) {
      throw new Error(error.message);
    }
    if (input.assignmentType === "primary") {
      await client()
        .from("projects")
        .update({ primary_department_id: input.departmentId, updated_by: actor.id })
        .eq("id", input.projectId);
    }
    await recordAuditLog({
      userId: actor.id,
      action: "project.department_assigned",
      entityType: "department_project_assignment",
      newValues: input as unknown as Record<string, unknown>,
    });
  },
};
