import type { Role } from "@/types/auth";

export const CLAIM_ROUTE_ROLES: readonly Role[] = [
  "site_staff",
  "manager",
  "hod",
  "admin_hr",
  "super_admin",
  "accounts_officer",
];

export const PEOPLE_ROUTE_ROLES: readonly Role[] = [
  "site_staff",
  "manager",
  "hod",
  "admin_hr",
  "super_admin",
];

export const MESSAGE_ROUTE_ROLES: readonly Role[] = [...CLAIM_ROUTE_ROLES];

export const VENDOR_ROUTE_ROLES: readonly Role[] = [
  "manager",
  "hod",
  "admin_hr",
  "super_admin",
  "accounts_officer",
];

export const VENDOR_SOURCE_ENTRY_ROUTE_ROLES: readonly Role[] = [
  "manager",
  "hod",
  "admin_hr",
];

export function canAccessRoute(role: Role, allowedRoles?: readonly Role[]) {
  return !allowedRoles || allowedRoles.includes(role);
}
