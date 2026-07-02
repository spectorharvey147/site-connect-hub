import type { MasterStatus } from "@/types/organization";

export interface WorkType {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description?: string;
  status: MasterStatus;
}

export type WorkTypeInput = Omit<WorkType, "id">;
