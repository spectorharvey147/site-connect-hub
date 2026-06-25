export interface ReportMetric {
  label: string;
  value: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}

export interface ReportChartPoint {
  label: string;
  value: number;
}

export interface ReportModuleSummary {
  module: string;
  primaryMetric: string;
  secondaryMetric: string;
  status: "healthy" | "watch" | "risk";
  link: string;
}

export interface ReportsDashboard {
  metrics: ReportMetric[];
  moduleSummaries: ReportModuleSummary[];
  financeTrend: ReportChartPoint[];
  operationsMix: ReportChartPoint[];
  exceptions: string[];
}

export interface ReportDefinition {
  key: string;
  title: string;
  module: string;
  description: string;
}

export interface DetailedReport {
  definition: ReportDefinition;
  headers: string[];
  rows: Array<Array<string | number>>;
  metrics: ReportMetric[];
}
