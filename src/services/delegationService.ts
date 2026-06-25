import { hierarchyDemoStore } from "@/services/hierarchyDemoStore";
import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import { userHierarchyService } from "@/services/userHierarchyService";
import type { AppUser } from "@/types/auth";
import type {
  ApprovalDelegation,
  ApprovalDelegationInput,
  ApprovalWorkflowType,
} from "@/types/organization";

interface DelegationRow {
  id: string;
  organization_id: string;
  from_user_id: string;
  delegated_to_user_id: string;
  workflow_type: ApprovalWorkflowType | null;
  start_date: string;
  end_date: string;
  reason: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

function assertCanManage(actor: AppUser) {
  if (!["admin_hr", "super_admin"].includes(actor.role)) {
    throw new Error("Only Admin / HR or Super Admin can manage delegations.");
  }
}

function now() {
  return new Date().toISOString();
}

function validateDelegation(input: ApprovalDelegationInput) {
  if (!input.organizationId) {
    throw new Error("Organization is required.");
  }
  if (!input.fromUserId || !input.delegatedToUserId) {
    throw new Error("Delegation requires both users.");
  }
  if (input.fromUserId === input.delegatedToUserId) {
    throw new Error("Delegated approver cannot be same as original approver.");
  }
  if (!input.startDate || !input.endDate || input.startDate > input.endDate) {
    throw new Error("Delegation date range must be valid.");
  }
  if (!input.reason.trim()) {
    throw new Error("Delegation reason is required.");
  }
  const users = hierarchyDemoStore.getUsers();
  const fromUser = users.find((user) => user.id === input.fromUserId);
  const delegatedUser = users.find((user) => user.id === input.delegatedToUserId);
  if (!fromUser || fromUser.status !== "active") {
    throw new Error("Original approver must be active.");
  }
  if (!delegatedUser || delegatedUser.status !== "active") {
    throw new Error("Delegated approver must be active.");
  }
}

function userName(userId: string) {
  return hierarchyDemoStore.getUsers().find((user) => user.id === userId)?.fullName;
}

function mapDelegation(row: DelegationRow): ApprovalDelegation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    fromUserId: row.from_user_id,
    fromUserName: undefined,
    delegatedToUserId: row.delegated_to_user_id,
    delegatedToUserName: undefined,
    workflowType: row.workflow_type ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDelegationRow(input: ApprovalDelegationInput): Partial<DelegationRow> {
  return {
    organization_id: input.organizationId,
    from_user_id: input.fromUserId,
    delegated_to_user_id: input.delegatedToUserId,
    workflow_type: input.workflowType ?? null,
    start_date: input.startDate,
    end_date: input.endDate,
    reason: input.reason.trim(),
    status: input.status ?? "active",
  };
}

export const delegationService = {
  async createDelegation(input: ApprovalDelegationInput, actor: AppUser) {
    assertCanManage(actor);
    validateDelegation(input);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("approval_delegations")
        .insert(toDelegationRow(input))
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const delegation = mapDelegation(data as DelegationRow);
      await recordAuditLog({
        userId: actor.id,
        action: "approval_delegation.created",
        entityType: "approval_delegation",
        entityId: delegation.id,
        newValues: {
          fromUserId: delegation.fromUserId,
          delegatedToUserId: delegation.delegatedToUserId,
        },
      });
      return delegation;
    }

    const delegation: ApprovalDelegation = {
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      fromUserId: input.fromUserId,
      fromUserName: userName(input.fromUserId),
      delegatedToUserId: input.delegatedToUserId,
      delegatedToUserName: userName(input.delegatedToUserId),
      workflowType: input.workflowType,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason.trim(),
      status: input.status ?? "active",
      createdAt: now(),
      updatedAt: now(),
    };
    hierarchyDemoStore.setDelegations([
      delegation,
      ...hierarchyDemoStore.getDelegations(),
    ]);
    await recordAuditLog({
      userId: actor.id,
      action: "approval_delegation.created",
      entityType: "approval_delegation",
      entityId: delegation.id,
      newValues: {
        fromUserId: delegation.fromUserId,
        delegatedToUserId: delegation.delegatedToUserId,
      },
    });
    return delegation;
  },

  async getActiveDelegations(
    organizationId: string,
    workflowType?: ApprovalWorkflowType,
    date = new Date().toISOString().slice(0, 10),
  ) {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from("approval_delegations")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .lte("start_date", date)
        .gte("end_date", date);
      if (workflowType) {
        query = query.or(`workflow_type.eq.${workflowType},workflow_type.is.null`);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      return (data as DelegationRow[]).map(mapDelegation);
    }

    return hierarchyDemoStore
      .getDelegations()
      .filter(
        (delegation) =>
          delegation.organizationId === organizationId &&
          delegation.status === "active" &&
          delegation.startDate <= date &&
          delegation.endDate >= date &&
          (!workflowType || !delegation.workflowType || delegation.workflowType === workflowType),
      )
      .map((delegation) => ({
        ...delegation,
        fromUserName: userName(delegation.fromUserId),
        delegatedToUserName: userName(delegation.delegatedToUserId),
      }));
  },

  async resolveDelegatedApprover(
    organizationId: string,
    approverUserId: string | undefined,
    workflowType?: ApprovalWorkflowType,
  ) {
    if (!approverUserId) {
      return null;
    }
    const delegations = await this.getActiveDelegations(
      organizationId,
      workflowType,
    );
    const delegation = delegations.find(
      (item) => item.fromUserId === approverUserId,
    );
    if (!delegation) {
      return null;
    }
    const delegatedUser = await userHierarchyService.getUserById(
      delegation.delegatedToUserId,
    );
    if (!delegatedUser || delegatedUser.status !== "active") {
      return null;
    }
    return {
      delegation,
      user: delegatedUser,
    };
  },

  async deactivateDelegation(delegationId: string, actor: AppUser) {
    assertCanManage(actor);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from("approval_delegations")
        .update({ status: "inactive" })
        .eq("id", delegationId)
        .select("*")
        .single();
      if (error) {
        throw new Error(error.message);
      }
      const delegation = mapDelegation(data as DelegationRow);
      await recordAuditLog({
        userId: actor.id,
        action: "approval_delegation.deactivated",
        entityType: "approval_delegation",
        entityId: delegation.id,
        newValues: { status: "inactive" },
      });
      return delegation;
    }

    const delegations = hierarchyDemoStore.getDelegations();
    const current = delegations.find((item) => item.id === delegationId);
    if (!current) {
      throw new Error("Delegation not found.");
    }
    const updated: ApprovalDelegation = {
      ...current,
      status: "inactive",
      updatedAt: now(),
    };
    hierarchyDemoStore.setDelegations(
      delegations.map((item) => (item.id === delegationId ? updated : item)),
    );
    await recordAuditLog({
      userId: actor.id,
      action: "approval_delegation.deactivated",
      entityType: "approval_delegation",
      entityId: updated.id,
      newValues: { status: "inactive" },
    });
    return updated;
  },

  resetDemoData() {
    hierarchyDemoStore.reset();
  },
};
