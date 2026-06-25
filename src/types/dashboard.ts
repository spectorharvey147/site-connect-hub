import type { Role } from "@/types/auth";

export interface DashboardMetric {
  label: string;
  value: string;
  trend?: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}

export interface DashboardActivity {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  module: string;
}

export interface DashboardSummary {
  role: Role;
  metrics: DashboardMetric[];
  activities: DashboardActivity[];
  pendingCounts?: Record<string, number>;
  chartData: Array<{
    label: string;
    value: number;
  }>;
}
