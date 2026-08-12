import {
  CLAIM_ROUTE_ROLES,
  MESSAGE_ROUTE_ROLES,
  PEOPLE_ROUTE_ROLES,
  VENDOR_ROUTE_ROLES,
  VENDOR_SOURCE_ENTRY_ROUTE_ROLES,
} from "@/permissions/routePermissions";
import type { Role } from "@/types/auth";

export const CLAIM_ROLES: Role[] = [...CLAIM_ROUTE_ROLES];
export const PEOPLE_ROLES: Role[] = [...PEOPLE_ROUTE_ROLES];
export const MESSAGE_ROLES: Role[] = [...MESSAGE_ROUTE_ROLES];
export const VENDOR_ROLES: Role[] = [...VENDOR_ROUTE_ROLES];
export const VENDOR_SOURCE_ENTRY_ROLES: Role[] = [...VENDOR_SOURCE_ENTRY_ROUTE_ROLES];
