import type {
  FuelRecordStatus,
  FuelSource,
  FuelType,
  FuelUnit,
  FuelVendor,
} from "@/types/fuel";

export const FUEL_TYPES: FuelType[] = [
  "diesel",
  "petrol",
  "engine_oil",
  "hydraulic_oil",
  "grease",
  "other",
];

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  diesel: "Diesel",
  petrol: "Petrol",
  engine_oil: "Engine Oil",
  hydraulic_oil: "Hydraulic Oil",
  grease: "Grease",
  other: "Other",
};

export const FUEL_TYPE_UNITS: Record<FuelType, FuelUnit> = {
  diesel: "L",
  petrol: "L",
  engine_oil: "L",
  hydraulic_oil: "L",
  grease: "KG",
  other: "Units",
};

export const FUEL_SOURCE_LABELS: Record<FuelSource, string> = {
  advance: "Advance",
  cash: "Cash",
  credit: "Credit",
};

export const FUEL_RECORD_STATUS_LABELS: Record<FuelRecordStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
};

export const FUEL_RECORD_STATUS_TONES: Record<
  FuelRecordStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  draft: "neutral",
  submitted: "warning",
  approved: "success",
};

export const FUEL_VENDORS: FuelVendor[] = [
  {
    id: "vendor-apex-fuel",
    name: "Apex Fuel Supply",
    contactPerson: "Nikhil Rao",
    phone: "+91 98765 40101",
    status: "active",
  },
  {
    id: "vendor-city-petroleum",
    name: "City Petroleum Depot",
    contactPerson: "Savita Kulkarni",
    phone: "+91 98765 40102",
    status: "active",
  },
  {
    id: "vendor-shakti-lubes",
    name: "Shakti Lubricants",
    contactPerson: "Aman Verma",
    phone: "+91 98765 40103",
    status: "active",
  },
];
