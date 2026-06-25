import type { LucideIcon } from "lucide-react";

import type { Role } from "@/types/auth";

export type ModuleKey =
  | "dashboard"
  | "claims"
  | "attendance"
  | "leave"
  | "tasks"
  | "messages"
  | "field_operations"
  | "casual_labour"
  | "machinery"
  | "fuel"
  | "materials"
  | "vendors"
  | "accounts"
  | "reports"
  | "settings"
  | "users"
  | "projects";

export interface ModuleDefinition {
  key: ModuleKey;
  name: string;
  path: string;
  description: string;
  icon: LucideIcon;
  allowedRoles: Role[];
  pendingCountKey?: string;
  accent: "blue" | "green" | "orange" | "red" | "slate";
  category:
    | "core"
    | "finance"
    | "people"
    | "operations"
    | "admin"
    | "communication";
}

export interface ModuleLandingContent {
  title: string;
  description: string;
  primaryActions: string[];
  workflow: string[];
}
