import type { Holiday, LeaveStatus, LeaveType } from "@/types/leave";

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const LEAVE_STATUS_TONES: Record<
  LeaveStatus,
  "neutral" | "success" | "warning" | "danger" | "info"
> = {
  draft: "neutral",
  submitted: "info",
  pending: "warning",
  approved: "success",
  rejected: "danger",
  withdrawn: "neutral",
};

export const LEAVE_TYPES: LeaveType[] = [
  {
    id: "casual",
    code: "CL",
    name: "Casual Leave",
    annualAllowance: 12,
    carryForward: false,
    requiresDocument: false,
    status: "active",
  },
  {
    id: "sick",
    code: "SL",
    name: "Sick Leave",
    annualAllowance: 10,
    carryForward: false,
    requiresDocument: true,
    status: "active",
  },
  {
    id: "privilege",
    code: "PL",
    name: "Privilege Leave",
    annualAllowance: 18,
    carryForward: true,
    requiresDocument: false,
    status: "active",
  },
  {
    id: "earned",
    code: "EL",
    name: "Earned Leave",
    annualAllowance: 18,
    carryForward: true,
    requiresDocument: false,
    status: "active",
  },
  {
    id: "maternity",
    code: "ML",
    name: "Maternity Leave",
    annualAllowance: 180,
    carryForward: false,
    requiresDocument: true,
    status: "active",
  },
  {
    id: "lwp",
    code: "LWP",
    name: "Leave Without Pay",
    annualAllowance: 365,
    carryForward: false,
    requiresDocument: false,
    status: "active",
  },
  {
    id: "comp_off",
    code: "CO",
    name: "Comp Off",
    annualAllowance: 0,
    carryForward: true,
    requiresDocument: false,
    status: "active",
  },
];

export const HOLIDAYS: Holiday[] = [
  {
    id: "holiday-2026-jan-26",
    name: "Republic Day",
    date: "2026-01-26",
    location: "India",
    type: "national",
  },
  {
    id: "holiday-2026-aug-15",
    name: "Independence Day",
    date: "2026-08-15",
    location: "India",
    type: "national",
  },
  {
    id: "holiday-2026-oct-02",
    name: "Gandhi Jayanti",
    date: "2026-10-02",
    location: "India",
    type: "national",
  },
  {
    id: "holiday-2026-dec-25",
    name: "Christmas",
    date: "2026-12-25",
    location: "India",
    type: "company",
  },
];
