import type {
  LabourAttendanceStatus,
  LabourCategory,
  LabourRecordStatus,
  LabourVendor,
} from "@/types/casualLabour";

export const LABOUR_CATEGORY_LABELS: Record<LabourCategory, string> = {
  male: "Male",
  female: "Female",
  supervisor: "Supervisor",
};

export const LABOUR_ATTENDANCE_STATUS_LABELS: Record<
  LabourAttendanceStatus,
  string
> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half Day",
  on_leave: "On Leave",
};

export const LABOUR_RECORD_STATUS_LABELS: Record<LabourRecordStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
};

export const LABOUR_RECORD_STATUS_TONES: Record<
  LabourRecordStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  draft: "neutral",
  submitted: "info",
  approved: "success",
};

export const LABOUR_VENDORS: LabourVendor[] = [
  {
    id: "vendor-shakti-labour",
    name: "Shakti Labour Supply",
    contactPerson: "Mahesh Patel",
    phone: "+91 98765 20101",
  },
  {
    id: "vendor-metro-labour",
    name: "Metro Workforce Services",
    contactPerson: "Anil Sharma",
    phone: "+91 98765 20102",
  },
  {
    id: "vendor-apex-contractors",
    name: "Apex Site Contractors",
    contactPerson: "Farhan Khan",
    phone: "+91 98765 20103",
  },
];

export const DEFAULT_LABOUR_RATES: Record<LabourCategory, number> = {
  male: 700,
  female: 650,
  supervisor: 950,
};
