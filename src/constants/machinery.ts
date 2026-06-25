import type {
  BillingCycle,
  DriverCostScope,
  FuelScope,
  MachineLogStatus,
  MachineStatus,
  MachineType,
  MachineVendor,
  MachineOwnership,
} from "@/types/machinery";

export const MACHINE_TYPE_OPTIONS: MachineType[] = [
  "excavator",
  "jcb",
  "dumper",
  "compactor",
  "crane",
  "concrete_mixer",
  "pump",
  "other",
];

export const MACHINE_TYPE_LABELS: Record<MachineType, string> = {
  excavator: "Excavator",
  jcb: "JCB",
  dumper: "Dumper",
  compactor: "Compactor",
  crane: "Crane",
  concrete_mixer: "Concrete Mixer",
  pump: "Pump",
  other: "Other",
};

export const MACHINE_OWNERSHIP_LABELS: Record<MachineOwnership, string> = {
  company_owned: "Company Owned",
  rented: "Rented",
  hired: "Hired",
};

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  daily: "Daily",
  hourly: "Hourly",
  per_trip: "Per Trip",
};

export const FUEL_SCOPE_LABELS: Record<FuelScope, string> = {
  included: "Fuel Included",
  excluded: "Fuel Excluded",
  partial: "Partial Fuel Scope",
};

export const DRIVER_COST_SCOPE_LABELS: Record<DriverCostScope, string> = {
  included: "Driver Included",
  additional: "Driver Additional",
  excluded: "Driver Excluded",
};

export const MACHINE_STATUS_LABELS: Record<MachineStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

export const MACHINE_LOG_STATUS_LABELS: Record<MachineLogStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
};

export const MACHINE_LOG_STATUS_TONES: Record<
  MachineLogStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  draft: "neutral",
  submitted: "warning",
  approved: "success",
};

export const MACHINE_STATUS_TONES: Record<
  MachineStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  active: "success",
  inactive: "neutral",
};

export const MACHINERY_VENDORS: MachineVendor[] = [
  {
    id: "vendor-apex-machinery",
    name: "Apex Plant & Machinery",
    contactPerson: "Rajat Menon",
    phone: "+91 98765 30101",
    status: "active",
  },
  {
    id: "vendor-steel-equip",
    name: "Steel Equip Rentals",
    contactPerson: "Preeti Shah",
    phone: "+91 98765 30102",
    status: "active",
  },
  {
    id: "vendor-city-cranes",
    name: "City Crane Services",
    contactPerson: "Imran Qureshi",
    phone: "+91 98765 30103",
    status: "active",
  },
];
