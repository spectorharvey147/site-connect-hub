import type { ModuleDefinition } from "@/types/modules";
import type { Role } from "@/types/auth";

export interface RoleOption {
  id: Role;
  label: string;
  shortLabel: string;
  description: string;
  rank: number;
}

export const ROLE_OPTIONS: RoleOption[] = [
  {
    id: "site_staff",
    label: "Site Staff / User",
    shortLabel: "User",
    description: "Submit attendance, claims, leave, DPRs and daily updates.",
    rank: 10,
  },
  {
    id: "manager",
    label: "Manager",
    shortLabel: "Manager",
    description: "Approve team claims and leaves, assign work, review progress.",
    rank: 30,
  },
  {
    id: "hod",
    label: "HOD / Department Head",
    shortLabel: "HOD",
    description: "Approve department workflows and review department performance.",
    rank: 35,
  },
  {
    id: "admin_hr",
    label: "Admin / HR",
    shortLabel: "Admin",
    description: "Verify claims, manage users, master data and audit records.",
    rank: 40,
  },
  {
    id: "accounts_officer",
    label: "Accounts Officer",
    shortLabel: "Accounts",
    description: "Generate vouchers, process payments and maintain ledgers.",
    rank: 50,
  },
  {
    id: "super_admin",
    label: "Super Admin / Finance Head",
    shortLabel: "Super Admin",
    description: "Final approvals, financial oversight and system settings.",
    rank: 100,
  },
];

export const ROLE_LABELS: Record<Role, string> = ROLE_OPTIONS.reduce(
  (labels, role) => ({
    ...labels,
    [role.id]: role.label,
  }),
  {} as Record<Role, string>,
);

export const ROLE_SHORT_LABELS: Record<Role, string> = ROLE_OPTIONS.reduce(
  (labels, role) => ({
    ...labels,
    [role.id]: role.shortLabel,
  }),
  {} as Record<Role, string>,
);

export function hasRoleAccess(userRole: Role, allowedRoles: Role[]) {
  return allowedRoles.includes(userRole);
}

export function canAccessModule(role: Role, module: ModuleDefinition) {
  return hasRoleAccess(role, module.allowedRoles);
}
