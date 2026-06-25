import type { Role } from "@/types/auth";

export const CLAIM_ROLES: Role[] = [
  "site_staff",
  "manager",
  "hod",
  "admin_hr",
  "super_admin",
  "accounts_officer",
];

export const PEOPLE_ROLES: Role[] = [
  "site_staff",
  "manager",
  "hod",
  "admin_hr",
  "super_admin",
];

export const MESSAGE_ROLES: Role[] = [...CLAIM_ROLES];

export const VENDOR_ROLES: Role[] = [
  "manager",
  "hod",
  "admin_hr",
  "super_admin",
  "accounts_officer",
];

export const VENDOR_SOURCE_ENTRY_ROLES: Role[] = [
  "manager",
  "hod",
  "admin_hr",
  "super_admin",
];
