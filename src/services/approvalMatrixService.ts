import { hierarchyDemoStore } from "@/services/hierarchyDemoStore";
import { delegationService } from "@/services/delegationService";
import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import { userHierarchyService } from "@/services/userHierarchyService";
import type { AppUser, Role } from "@/types/auth";
import type {
  ApprovalApproverRole,
  ApprovalLevelConfig,
  ApprovalMatrixInput,
  ApprovalMatrixRule,
  ApprovalPathInput,
  ApprovalPathResult,
  ApprovalPathStep,
  ApprovalWorkflowType,
} from "@/types/organization";

interface ApprovalMatrixRow {
  id: string;
  organization_id: string;
  workflow_type: ApprovalWorkflowType;
  department_id: string | null;
  project_id: string | null;
  expense_category_id: string | null;
  min_amount: number | null;
  max_amount: number | null;
  level_1_role: ApprovalApproverRole | null;
  level_1_user_id: string | null;
  level_2_role: ApprovalApproverRole | null;
  level_2_user_id: string | null;
  level_3_role: ApprovalApproverRole | null;
  level_3_user_id: string | null;
  level_4_role: ApprovalApproverRole | null;
  level_4_user_id: string | null;
  final_approval_role: ApprovalApproverRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const roleLabels: Record<ApprovalApproverRole, string> = {
  admin: "Admin Verification",
  manager: "Reporting Manager",
  hod: "Department HOD",
  super_admin: "Super Admin / Finance Head",
  accounts: "Accounts Processing",
  store_admin: "Store Admin",
  finance_head: "Finance Head",
};

function assertCanManage(actor: AppUser) {
  if (!["admin_hr", "super_admin"].includes(actor.role)) {
    throw new Error("Only authorized Admin or Super Admin can manage approval matrix.");
  }
}

function now() {
  return new Date().toISOString();
}

function normalizeAmount(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapLevels(row: ApprovalMatrixRow): ApprovalLevelConfig[] {
  return [
    { role: row.level_1_role, userId: row.level_1_user_id ?? undefined },
    { role: row.level_2_role, userId: row.level_2_user_id ?? undefined },
    { role: row.level_3_role, userId: row.level_3_user_id ?? undefined },
    { role: row.level_4_role, userId: row.level_4_user_id ?? undefined },
  ].flatMap((level) => (level.role ? [{ role: level.role, userId: level.userId }] : []));
}

function mapRule(row: ApprovalMatrixRow): ApprovalMatrixRule {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workflowType: row.workflow_type,
    departmentId: row.department_id ?? undefined,
    projectId: row.project_id ?? undefined,
    expenseCategoryId: row.expense_category_id ?? undefined,
    minAmount: row.min_amount ?? undefined,
    maxAmount: row.max_amount ?? undefined,
    levels: mapLevels(row),
    finalApprovalRole: row.final_approval_role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRuleRow(input: ApprovalMatrixInput): Partial<ApprovalMatrixRow> {
  return {
    organization_id: input.organizationId,
    workflow_type: input.workflowType,
    department_id: input.departmentId || null,
    project_id: input.projectId || null,
    expense_category_id: input.expenseCategoryId || null,
    min_amount: normalizeAmount(input.minAmount) ?? null,
    max_amount: normalizeAmount(input.maxAmount) ?? null,
    level_1_role: input.levels[0]?.role ?? null,
    level_1_user_id: input.levels[0]?.userId ?? null,
    level_2_role: input.levels[1]?.role ?? null,
    level_2_user_id: input.levels[1]?.userId ?? null,
    level_3_role: input.levels[2]?.role ?? null,
    level_3_user_id: input.levels[2]?.userId ?? null,
    level_4_role: input.levels[3]?.role ?? null,
    level_4_user_id: input.levels[3]?.userId ?? null,
    final_approval_role: input.finalApprovalRole,
    is_active: input.isActive ?? true,
  };
}

function validateRule(input: ApprovalMatrixInput) {
  if (!input.organizationId) {
    throw new Error("Organization is required.");
  }
  if (input.levels.length === 0) {
    throw new Error("At least one approval level is required.");
  }
  if (input.levels.length > 4) {
    throw new Error("Approval matrix supports up to four approval levels.");
  }
  if (
    input.minAmount !== undefined &&
    input.maxAmount !== undefined &&
    input.minAmount > input.maxAmount
  ) {
    throw new Error("Minimum amount cannot exceed maximum amount.");
  }
}

function rangesOverlap(
  leftMin: number | undefined,
  leftMax: number | undefined,
  rightMin: number | undefined,
  rightMax: number | undefined,
) {
  const minLeft = leftMin ?? Number.NEGATIVE_INFINITY;
  const maxLeft = leftMax ?? Number.POSITIVE_INFINITY;
  const minRight = rightMin ?? Number.NEGATIVE_INFINITY;
  const maxRight = rightMax ?? Number.POSITIVE_INFINITY;
  return minLeft <= maxRight && minRight <= maxLeft;
}

function assertNoOverlappingRule(input: ApprovalMatrixInput, ruleId?: string) {
  const overlapping = hierarchyDemoStore
    .getApprovalRules()
    .some(
      (rule) =>
        rule.id !== ruleId &&
        rule.isActive &&
        rule.organizationId === input.organizationId &&
        rule.workflowType === input.workflowType &&
        (rule.departmentId ?? "") === (input.departmentId ?? "") &&
        (rule.projectId ?? "") === (input.projectId ?? "") &&
        (rule.expenseCategoryId ?? "") === (input.expenseCategoryId ?? "") &&
        rangesOverlap(
          rule.minAmount,
          rule.maxAmount,
          input.minAmount,
          input.maxAmount,
        ),
    );
  if (overlapping) {
    throw new Error(
      "Approval matrix amount ranges cannot overlap for the same workflow scope.",
    );
  }
}

function isRuleMatch(rule: ApprovalMatrixRule, input: ApprovalPathInput) {
  const amount = input.amount ?? 0;
  return (
    rule.isActive &&
    rule.organizationId === input.organizationId &&
    rule.workflowType === input.workflowType &&
    (!rule.departmentId || rule.departmentId === input.departmentId) &&
    (!rule.projectId || rule.projectId === input.projectId) &&
    (!rule.expenseCategoryId ||
      rule.expenseCategoryId === input.expenseCategoryId) &&
    (rule.minAmount === undefined || amount >= rule.minAmount) &&
    (rule.maxAmount === undefined || amount <= rule.maxAmount)
  );
}

function specificity(rule: ApprovalMatrixRule) {
  return [
    rule.departmentId ? 4 : 0,
    rule.projectId ? 3 : 0,
    rule.expenseCategoryId ? 2 : 0,
    rule.minAmount !== undefined || rule.maxAmount !== undefined ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function defaultLevels(input: ApprovalPathInput): ApprovalLevelConfig[] {
  if (input.workflowType === "claim") {
    return [
      { role: "admin" },
      { role: "manager" },
      { role: "hod" },
      { role: "accounts" },
    ];
  }
  if (input.workflowType === "leave") {
    return (input.leaveDays ?? 0) > 3
      ? [{ role: "manager" }, { role: "hod" }]
      : [{ role: "manager" }];
  }
  if (input.workflowType === "material_request") {
    return [{ role: "manager" }, { role: "hod" }, { role: "store_admin" }];
  }
  if (input.workflowType === "vendor_bill") {
    return [{ role: "admin" }, { role: "finance_head" }, { role: "accounts" }];
  }
  if (input.workflowType === "dpr") {
    return [{ role: "manager" }, { role: "hod" }];
  }
  return [{ role: "manager" }];
}

function firstActiveUserByRole(users: AppUser[], roles: Role[]) {
  return users.find(
    (user) => roles.includes(user.role) && user.status === "active",
  );
}

function departmentHodId(departmentId?: string) {
  if (!departmentId) {
    return undefined;
  }
  return hierarchyDemoStore
    .getDepartments()
    .find((department) => department.id === departmentId)?.hodUserId;
}

async function resolveRoleUser(
  role: ApprovalApproverRole,
  requester: AppUser,
  users: AppUser[],
  explicitUserId?: string,
) {
  if (explicitUserId) {
    return users.find((user) => user.id === explicitUserId);
  }
  if (role === "manager") {
    return users.find(
      (user) => user.id === (requester.reportingManagerId ?? requester.managerId),
    );
  }
  if (role === "hod") {
    return users.find(
      (user) =>
        user.id ===
        (requester.hodUserId ?? departmentHodId(requester.departmentId)),
    );
  }
  if (role === "admin" || role === "store_admin") {
    return firstActiveUserByRole(users, ["admin_hr", "super_admin"]);
  }
  if (role === "super_admin" || role === "finance_head") {
    return firstActiveUserByRole(users, ["super_admin"]);
  }
  if (role === "accounts") {
    return firstActiveUserByRole(users, ["accounts_officer", "super_admin"]);
  }
  return undefined;
}

async function buildPath(
  input: ApprovalPathInput,
  levels: ApprovalLevelConfig[],
  requester: AppUser,
  source: ApprovalPathStep["source"],
) {
  const users = await userHierarchyService.listUsers(input.organizationId);
  const steps: ApprovalPathStep[] = [];

  for (const [index, level] of levels.entries()) {
    const approver = await resolveRoleUser(
      level.role,
      requester,
      users,
      level.userId,
    );
    const delegated = await delegationService.resolveDelegatedApprover(
      input.organizationId,
      approver?.id,
      input.workflowType,
    );
    const finalApprover = delegated?.user ?? approver;
    steps.push({
      id: `${input.workflowType}-${index + 1}-${level.role}`,
      sequence: index + 1,
      role: level.role,
      label: roleLabels[level.role],
      userId: finalApprover?.id,
      userName: finalApprover?.fullName,
      delegatedFromUserId: delegated?.delegation.fromUserId,
      delegatedFromUserName: delegated?.delegation.fromUserName,
      source,
    });
  }

  return steps;
}

export const approvalMatrixService = {
  async getApprovalRules(
    organizationId?: string,
    workflowType?: ApprovalWorkflowType,
  ) {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from("approval_matrices")
        .select("*")
        .order("workflow_type");
      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      if (workflowType) {
        query = query.eq("workflow_type", workflowType);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      return (data as ApprovalMatrixRow[]).map(mapRule);
    }

    return hierarchyDemoStore
      .getApprovalRules()
      .filter(
        (rule) =>
          (!organizationId || rule.organizationId === organizationId) &&
          (!workflowType || rule.workflowType === workflowType),
      );
  },

  async createApprovalRule(input: ApprovalMatrixInput, actor: AppUser) {
    assertCanManage(actor);
    validateRule(input);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("approval_matrices")
        .insert(toRuleRow(input))
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const rule = mapRule(data as ApprovalMatrixRow);
      await recordAuditLog({
        userId: actor.id,
        action: "approval_matrix.created",
        entityType: "approval_matrix",
        entityId: rule.id,
        newValues: { workflowType: rule.workflowType },
      });
      return rule;
    }

    assertNoOverlappingRule(input);
    const rule: ApprovalMatrixRule = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      workflowType: input.workflowType,
      departmentId: input.departmentId,
      projectId: input.projectId,
      expenseCategoryId: input.expenseCategoryId,
      minAmount: input.minAmount,
      maxAmount: input.maxAmount,
      levels: input.levels,
      finalApprovalRole: input.finalApprovalRole,
      isActive: input.isActive ?? true,
      createdAt: now(),
      updatedAt: now(),
    };
    hierarchyDemoStore.setApprovalRules([
      rule,
      ...hierarchyDemoStore.getApprovalRules(),
    ]);
    await recordAuditLog({
      userId: actor.id,
      action: "approval_matrix.created",
      entityType: "approval_matrix",
      entityId: rule.id,
      newValues: { workflowType: rule.workflowType },
    });
    return rule;
  },

  async updateApprovalRule(
    ruleId: string,
    input: ApprovalMatrixInput,
    actor: AppUser,
  ) {
    assertCanManage(actor);
    validateRule(input);

    if (isSupabaseConfigured && supabase) {
      const { data: currentData } = await supabase
        .from("approval_matrices")
        .select("*")
        .eq("id", ruleId)
        .maybeSingle();
      const { data, error } = await supabase
        .from("approval_matrices")
        .update(toRuleRow(input))
        .eq("id", ruleId)
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const rule = mapRule(data as ApprovalMatrixRow);
      await recordAuditLog({
        userId: actor.id,
        action: "approval_matrix.updated",
        entityType: "approval_matrix",
        entityId: rule.id,
        oldValues: currentData
          ? (currentData as Record<string, unknown>)
          : undefined,
        newValues: { workflowType: rule.workflowType },
      });
      return rule;
    }

    assertNoOverlappingRule(input, ruleId);
    const rules = hierarchyDemoStore.getApprovalRules();
    const current = rules.find((rule) => rule.id === ruleId);
    if (!current) {
      throw new Error("Approval rule not found.");
    }
    const updated: ApprovalMatrixRule = {
      ...current,
      ...input,
      isActive: input.isActive ?? current.isActive,
      updatedAt: now(),
    };
    hierarchyDemoStore.setApprovalRules(
      rules.map((rule) => (rule.id === ruleId ? updated : rule)),
    );
    await recordAuditLog({
      userId: actor.id,
      action: "approval_matrix.updated",
      entityType: "approval_matrix",
      entityId: updated.id,
      oldValues: { levels: current.levels },
      newValues: { levels: updated.levels },
    });
    return updated;
  },

  async deactivateApprovalRule(ruleId: string, actor: AppUser) {
    const rules = hierarchyDemoStore.getApprovalRules();
    const rule = rules.find((item) => item.id === ruleId);
    if (!rule) {
      throw new Error("Approval rule not found.");
    }
    return this.updateApprovalRule(
      ruleId,
      { ...rule, isActive: false },
      actor,
    );
  },

  async resolveApprovalPath(
    input: ApprovalPathInput,
  ): Promise<ApprovalPathResult> {
    const requester = await userHierarchyService.getUserById(input.requesterUserId);
    if (!requester) {
      throw new Error("Requester profile not found.");
    }

    const resolvedInput: ApprovalPathInput = {
      ...input,
      departmentId: input.departmentId ?? requester.departmentId,
      projectId: input.projectId ?? requester.primaryProjectId,
    };
    const rules = await this.getApprovalRules(
      resolvedInput.organizationId,
      resolvedInput.workflowType,
    );
    const matchedRule = rules
      .filter((rule) => isRuleMatch(rule, resolvedInput))
      .sort((left, right) => specificity(right) - specificity(left))[0];
    const configuredLevels = matchedRule?.levels ?? defaultLevels(resolvedInput);
    const levels =
      resolvedInput.workflowType === "claim" && matchedRule
        ? [
            ...configuredLevels.filter(
              (level) =>
                level.role !== "accounts" &&
                !(
                  matchedRule.finalApprovalRole === "hod" &&
                  level.role === "super_admin"
                ),
            ),
            ...(configuredLevels.some(
              (level) => level.role === matchedRule.finalApprovalRole,
            )
              ? []
              : [{ role: matchedRule.finalApprovalRole }]),
            ...(configuredLevels.some((level) => level.role === "accounts")
              ? [{ role: "accounts" as const }]
              : [{ role: "accounts" as const }]),
          ]
        : configuredLevels;
    const steps = await buildPath(
      resolvedInput,
      levels,
      requester,
      matchedRule ? "matrix" : "default",
    );

    return {
      workflowType: resolvedInput.workflowType,
      organizationId: resolvedInput.organizationId,
      requester,
      matchedRuleId: matchedRule?.id,
      steps,
    };
  },

  async previewApprovalPath(input: ApprovalPathInput) {
    return this.resolveApprovalPath(input);
  },

  resetDemoData() {
    hierarchyDemoStore.reset();
  },
};
