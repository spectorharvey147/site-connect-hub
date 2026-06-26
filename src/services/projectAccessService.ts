import { COST_CODE_OPTIONS, PROJECT_OPTIONS } from "@/constants/claims";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type { ProjectCostCode, ProjectMaster } from "@/types/projects";

type Row = Record<string, unknown>;

function mapProject(row: Row): ProjectMaster {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id ?? ""),
    code: String(row.code),
    name: String(row.name),
    customerId: row.customer_id ? String(row.customer_id) : undefined,
    customerName: row.customer_name ? String(row.customer_name) : undefined,
    isCommonProject:
      row.is_common_project === true ||
      String(row.name).toLowerCase().includes("common project"),
    location: row.location ? String(row.location) : undefined,
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    geofenceRadius: Number(row.geofence_radius ?? 250),
    latitude: row.latitude == null ? undefined : Number(row.latitude),
    longitude: row.longitude == null ? undefined : Number(row.longitude),
    projectBudget: Number(row.project_budget ?? 0),
    status: row.status === "inactive" ? "inactive" : "active",
    assignedUserCount: 0,
    assignedDepartmentCount: 0,
    costCodeCount: 0,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export const projectAccessService = {
  async getSelectableProjectsForUser(
    actor: AppUser,
    requestedUserId = actor.id,
  ): Promise<ProjectMaster[]> {
    if (!isSupabaseConfigured || !supabase) {
      return PROJECT_OPTIONS.map((project) => ({
        id: project.id,
        organizationId: actor.organizationId ?? "",
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
      }));
    }

    const canSeeAll =
      requestedUserId === actor.id &&
      ["admin_hr", "super_admin", "accounts_officer"].includes(actor.role);

    let projectIds: string[] | undefined;
    if (!canSeeAll) {
      const { data: assignments, error: assignmentError } = await supabase
        .from("user_project_assignments")
        .select("project_id")
        .eq("user_id", requestedUserId)
        .eq("status", "active")
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().slice(0, 10)}`);
      if (assignmentError) {
        throw new Error(assignmentError.message);
      }
      projectIds = ((assignments as Row[] | null) ?? []).map((row) =>
        String(row.project_id),
      );
      if (!projectIds.length) {
        return [];
      }
    }

    let query = supabase
      .from("projects")
      .select("*")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name");
    if (actor.organizationId) {
      query = query.eq("organization_id", actor.organizationId);
    }
    if (projectIds) {
      query = query.in("id", projectIds);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return ((data as Row[] | null) ?? []).map(mapProject);
  },

  async getSelectableCostCodesForProject(
    projectId: string,
  ): Promise<ProjectCostCode[]> {
    if (!projectId) {
      return [];
    }
    if (!isSupabaseConfigured || !supabase) {
      return COST_CODE_OPTIONS.filter((costCode) => costCode.projectId === projectId).map(
        (costCode) => ({
          id: costCode.id,
          organizationId: "",
          projectId: costCode.projectId,
          code: costCode.code,
          name: costCode.name,
          expenseType: costCode.name as ProjectCostCode["expenseType"],
          codeType: "unique",
          customerIds: [],
          expenseCategoryIds: [],
          budgetAllocated: 0,
          status: "active",
        }),
      );
    }
    const { data, error } = await supabase
      .from("project_cost_codes")
      .select("*")
      .eq("project_id", projectId)
      .eq("status", "active")
      .order("code");
    if (error) {
      throw new Error(error.message);
    }
    return ((data as Row[] | null) ?? []).map((row) => ({
      id: String(row.id),
      organizationId: String(row.organization_id),
      projectId: String(row.project_id),
      commonCostCodeId: row.common_cost_code_id
        ? String(row.common_cost_code_id)
        : undefined,
      code: String(row.code),
      name: String(row.name),
      expenseType: row.expense_type as ProjectCostCode["expenseType"],
      codeType: row.code_type === "common" ? "common" : "unique",
      customerIds: stringArray(row.customer_ids),
      expenseCategoryIds: stringArray(row.expense_category_ids),
      description: row.description ? String(row.description) : undefined,
      budgetAllocated: Number(row.budget_allocated ?? 0),
      responsibleDepartmentId: row.responsible_department_id
        ? String(row.responsible_department_id)
        : undefined,
      status: "active",
    }));
  },
};
