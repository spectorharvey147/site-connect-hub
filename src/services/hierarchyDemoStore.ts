import {
  DEMO_APPROVAL_RULES,
  DEMO_DELEGATIONS,
  DEMO_DEPARTMENTS,
  DEMO_DESIGNATIONS,
  DEMO_ORGANIZATION,
} from "@/constants/organization";
import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import type { ManagedUser } from "@/types/users";
import type {
  ApprovalDelegation,
  ApprovalMatrixRule,
  Department,
  Designation,
  Organization,
  UserProjectAssignment,
} from "@/types/organization";

let organization = clone(DEMO_ORGANIZATION);
let departments = clone(DEMO_DEPARTMENTS);
let designations = clone(DEMO_DESIGNATIONS);
let approvalRules = clone(DEMO_APPROVAL_RULES);
let delegations = clone(DEMO_DELEGATIONS);
let users: ManagedUser[] = DEMO_USERS.map((user, index) => ({
  ...toAppUser(user),
  invitedAt: "2026-06-01T09:00:00.000Z",
  lastLoginAt:
    index < 5
      ? `2026-06-${String(20 - index).padStart(2, "0")}T09:30:00.000Z`
      : undefined,
}));
let projectAssignments: UserProjectAssignment[] = users.flatMap((user) =>
  user.projectIds.map((projectId, index) => ({
    id: `${user.id}-${projectId}`,
    organizationId: user.organizationId ?? organization.id,
    userId: user.id,
    projectId,
    departmentId: user.departmentId,
    assignmentType:
      projectId === user.primaryProjectId || index === 0 ? "primary" : "secondary",
    startDate: "2026-06-01",
    status: "active",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  })),
);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const hierarchyDemoStore = {
  getOrganization() {
    return clone(organization);
  },

  setOrganization(next: Organization) {
    organization = clone(next);
  },

  getDepartments() {
    return clone(departments);
  },

  setDepartments(next: Department[]) {
    departments = clone(next);
  },

  getDesignations() {
    return clone(designations);
  },

  setDesignations(next: Designation[]) {
    designations = clone(next);
  },

  getApprovalRules() {
    return clone(approvalRules);
  },

  setApprovalRules(next: ApprovalMatrixRule[]) {
    approvalRules = clone(next);
  },

  getDelegations() {
    return clone(delegations);
  },

  setDelegations(next: ApprovalDelegation[]) {
    delegations = clone(next);
  },

  getUsers() {
    return clone(users);
  },

  setUsers(next: ManagedUser[]) {
    users = clone(next);
  },

  getProjectAssignments() {
    return clone(projectAssignments);
  },

  setProjectAssignments(next: UserProjectAssignment[]) {
    projectAssignments = clone(next);
  },

  reset() {
    organization = clone(DEMO_ORGANIZATION);
    departments = clone(DEMO_DEPARTMENTS);
    designations = clone(DEMO_DESIGNATIONS);
    approvalRules = clone(DEMO_APPROVAL_RULES);
    delegations = clone(DEMO_DELEGATIONS);
    users = DEMO_USERS.map((user, index) => ({
      ...toAppUser(user),
      invitedAt: "2026-06-01T09:00:00.000Z",
      lastLoginAt:
        index < 5
          ? `2026-06-${String(20 - index).padStart(2, "0")}T09:30:00.000Z`
          : undefined,
    }));
    projectAssignments = users.flatMap((user) =>
      user.projectIds.map((projectId, index) => ({
        id: `${user.id}-${projectId}`,
        organizationId: user.organizationId ?? organization.id,
        userId: user.id,
        projectId,
        departmentId: user.departmentId,
        assignmentType:
          projectId === user.primaryProjectId || index === 0
            ? "primary"
            : "secondary",
        startDate: "2026-06-01",
        status: "active",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      })),
    );
  },
};
