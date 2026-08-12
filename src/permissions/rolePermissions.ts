import type { AppUser, Role } from "@/types/auth";

export const ORGANIZATION_VIEW_ROLES: readonly Role[] = ["super_admin"];
export const ORGANIZATION_MANAGEMENT_ROLES: readonly Role[] = ["super_admin"];
export const CLAIM_VIEW_ALL_ROLES: readonly Role[] = ["super_admin", "admin_hr"];
export const FINANCIAL_VIEW_ROLES: readonly Role[] = [
  "super_admin",
  "admin_hr",
  "accounts_officer",
];

export function hasRole(user: AppUser | null | undefined, role: Role) {
  return user?.role === role;
}

export function hasAnyRole(
  user: AppUser | null | undefined,
  roles: readonly Role[],
) {
  return Boolean(user && roles.includes(user.role));
}

export function canViewAllOrganizationData(user: AppUser | null | undefined) {
  return hasAnyRole(user, ORGANIZATION_VIEW_ROLES);
}

export function canManageOrganization(user: AppUser | null | undefined) {
  return hasAnyRole(user, ORGANIZATION_MANAGEMENT_ROLES);
}

export function canViewAllClaims(user: AppUser | null | undefined) {
  return hasAnyRole(user, CLAIM_VIEW_ALL_ROLES);
}

export function canViewFinancialData(user: AppUser | null | undefined) {
  return hasAnyRole(user, FINANCIAL_VIEW_ROLES);
}
