import type {
  DprIssueType,
  DprStatus,
  IssueSeverity,
  IssueStatus,
  MachineCode,
  WeatherCondition,
} from "@/types/fieldOperations";

export const DPR_STATUS_LABELS: Record<DprStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
  returned: "Returned",
};

export const DPR_STATUS_TONES: Record<
  DprStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  draft: "neutral",
  submitted: "info",
  reviewed: "success",
  returned: "warning",
};

export const WEATHER_LABELS: Record<WeatherCondition, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  rainy: "Rainy",
  stormy: "Stormy",
  hot: "Hot",
  cold: "Cold",
  foggy: "Foggy",
};

export const ACTIVITY_OPTIONS = [
  "Marking & Staking",
  "Excavation",
  "Filling & Compaction",
  "Concrete Works",
  "Formwork",
  "Reinforcement",
  "Pouring",
  "Finishing",
  "Curing",
  "Custom",
];

export const MACHINE_LABELS: Record<MachineCode, string> = {
  excavator: "Excavator",
  jcb: "JCB",
  dumper: "Dumper",
  compactor: "Compactor",
  crane: "Crane",
  concrete_mixer: "Concrete Mixer",
  vibrator: "Vibrator",
  pump: "Pump",
  other: "Other",
};

export const ISSUE_TYPE_LABELS: Record<DprIssueType, string> = {
  safety: "Safety Issue",
  weather: "Weather Impact",
  material_shortage: "Material Shortage",
  manpower: "Manpower Issue",
  equipment_breakdown: "Equipment Breakdown",
  quality: "Quality Issue",
  other: "Other",
};

export const ISSUE_SEVERITY_LABELS: Record<IssueSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  resolved: "Resolved",
  pending: "Pending",
};
