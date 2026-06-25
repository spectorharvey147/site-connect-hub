import { SHIFTS } from "@/constants/attendance";
import { PROJECT_OPTIONS } from "@/constants/claims";
import { DEMO_USERS, toAppUser } from "@/constants/demoData";
import { recordAuditLog } from "@/services/auditService";
import { fieldOperationsRepository } from "@/services/fieldOperationsRepository";
import { isSupabaseConfigured } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type {
  DailyProgressReport,
  DprActivity,
  DprFilters,
  DprInput,
  DprIssue,
  DprLaborSummary,
  DprPhoto,
  DprStatus,
  FieldOperationsSummary,
} from "@/types/fieldOperations";

const DPR_STORAGE_KEY = "site-connect:dpr-reports";

let memoryReports: DailyProgressReport[] | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

function now() {
  return new Date().toISOString();
}

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getProjectName(projectId: string) {
  if (isSupabaseConfigured) {
    throw new Error("Production project names must come from Supabase.");
  }
  return (
    PROJECT_OPTIONS.find((project) => project.id === projectId)?.name ??
    "Unknown project"
  );
}

function getShiftName(shiftId: string) {
  return SHIFTS.find((shift) => shift.id === shiftId)?.name ?? "General Shift";
}

function getDemoUser(email: string) {
  const user = DEMO_USERS.find((item) => item.email === email);
  if (!user) {
    throw new Error(`Missing demo user: ${email}`);
  }
  return toAppUser(user);
}

function sampleActivity(
  overrides: Partial<DprActivity> & Pick<DprActivity, "activityName">,
): DprActivity {
  return {
    id: crypto.randomUUID(),
    description: "Site activity completed as per method statement.",
    completionPercent: 75,
    machinesUsed: [],
    labor: {
      male: 6,
      female: 2,
      supervisors: 1,
      companyStaff: 2,
    },
    comments: "",
    ...overrides,
  };
}

function sampleIssue(overrides: Partial<DprIssue>): DprIssue {
  return {
    id: crypto.randomUUID(),
    issueType: "material_shortage",
    severity: "medium",
    description: "Material delivery was delayed by vendor dispatch.",
    resolutionNotes: "Follow-up completed with procurement.",
    status: "pending",
    ...overrides,
  };
}

function samplePhoto(user: AppUser, fileName: string, caption: string): DprPhoto {
  return {
    id: crypto.randomUUID(),
    fileName,
    fileType: "image/jpeg",
    fileSize: 245760,
    url: "#",
    caption,
    uploadedBy: user.id,
    uploadedByName: user.fullName,
    createdAt: now(),
  };
}

function seedReports(): DailyProgressReport[] {
  const manager = getDemoUser("manager@siteconnect.local");
  const siteUser = getDemoUser("site@siteconnect.local");
  const secondUser = getDemoUser("ishita@siteconnect.local");

  return [
    {
      id: "dpr-demo-001",
      dprNumber: "DPR-2026-0001",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      reportDate: "2026-06-20",
      shiftId: "shift-general",
      shiftName: getShiftName("shift-general"),
      submittedBy: siteUser.id,
      submittedByName: siteUser.fullName,
      submittedByRole: siteUser.role,
      weather: ["clear", "hot"],
      activities: [
        sampleActivity({
          id: "dpr-activity-demo-001",
          activityName: "Formwork",
          description: "Pier P12 shuttering alignment completed.",
          completionPercent: 100,
          machinesUsed: ["crane"],
          labor: { male: 8, female: 2, supervisors: 1, companyStaff: 3 },
        }),
        sampleActivity({
          id: "dpr-activity-demo-002",
          activityName: "Reinforcement",
          description: "Rebar tying completed for pile cap zone A.",
          completionPercent: 80,
          machinesUsed: ["jcb", "dumper"],
          labor: { male: 10, female: 3, supervisors: 1, companyStaff: 2 },
        }),
      ],
      issues: [
        sampleIssue({
          id: "dpr-issue-demo-001",
          issueType: "equipment_breakdown",
          severity: "medium",
          description: "Vibrator stopped for 40 minutes during trial run.",
          resolutionNotes: "Spare unit arranged from central store.",
          status: "resolved",
        }),
      ],
      nextDayPlan:
        "Concrete pour readiness checklist, final safety briefing and cube sample preparation.",
      plannedManpower: 24,
      plannedEquipment: "Concrete pump, vibrator, crane",
      photos: [samplePhoto(siteUser, "pier-p12-shuttering.jpg", "Pier P12 formwork")],
      status: "submitted",
      submittedAt: "2026-06-20T17:40:00.000Z",
      createdAt: "2026-06-20T17:35:00.000Z",
      updatedAt: "2026-06-20T17:40:00.000Z",
    },
    {
      id: "dpr-demo-002",
      dprNumber: "DPR-2026-0002",
      projectId: "project-metro",
      projectName: getProjectName("project-metro"),
      reportDate: "2026-06-19",
      shiftId: "shift-early",
      shiftName: getShiftName("shift-early"),
      submittedBy: manager.id,
      submittedByName: manager.fullName,
      submittedByRole: manager.role,
      weather: ["cloudy"],
      activities: [
        sampleActivity({
          id: "dpr-activity-demo-003",
          activityName: "Excavation",
          description: "Drain trench excavation completed from chainage 120 to 180.",
          completionPercent: 90,
          machinesUsed: ["excavator", "dumper"],
          labor: { male: 12, female: 1, supervisors: 2, companyStaff: 2 },
        }),
      ],
      issues: [],
      nextDayPlan: "Backfilling and compaction for completed drain stretch.",
      plannedManpower: 18,
      plannedEquipment: "Compactor, dumper",
      photos: [samplePhoto(manager, "drain-excavation.jpg", "Drain trench")],
      status: "reviewed",
      submittedAt: "2026-06-19T16:20:00.000Z",
      reviewedBy: manager.id,
      reviewedByName: manager.fullName,
      reviewedAt: "2026-06-19T18:00:00.000Z",
      reviewComments: "Progress accepted.",
      createdAt: "2026-06-19T16:10:00.000Z",
      updatedAt: "2026-06-19T18:00:00.000Z",
    },
    {
      id: "dpr-demo-003",
      dprNumber: "DPR-2026-0003",
      projectId: "project-tower",
      projectName: getProjectName("project-tower"),
      reportDate: "2026-06-20",
      shiftId: "shift-general",
      shiftName: getShiftName("shift-general"),
      submittedBy: secondUser.id,
      submittedByName: secondUser.fullName,
      submittedByRole: secondUser.role,
      weather: ["rainy"],
      activities: [
        sampleActivity({
          id: "dpr-activity-demo-004",
          activityName: "Curing",
          description: "Curing continued for podium slab pour.",
          completionPercent: 60,
          machinesUsed: ["pump"],
          labor: { male: 5, female: 2, supervisors: 1, companyStaff: 1 },
        }),
      ],
      issues: [
        sampleIssue({
          id: "dpr-issue-demo-002",
          issueType: "weather",
          severity: "high",
          description: "Rain stopped external plaster work.",
          resolutionNotes: "Rescheduled work after weather clears.",
          status: "pending",
        }),
      ],
      nextDayPlan: "Resume plaster work if rain stops; otherwise continue internal blockwork.",
      plannedManpower: 16,
      plannedEquipment: "Scaffolding, mixer",
      photos: [samplePhoto(secondUser, "tower-curing.jpg", "Podium curing")],
      status: "submitted",
      submittedAt: "2026-06-20T17:10:00.000Z",
      createdAt: "2026-06-20T17:00:00.000Z",
      updatedAt: "2026-06-20T17:10:00.000Z",
    },
  ];
}

function readReports() {
  if (!isBrowser()) {
    memoryReports ??= seedReports();
    return memoryReports;
  }
  const stored = window.localStorage.getItem(DPR_STORAGE_KEY);
  if (!stored) {
    const seeded = seedReports();
    window.localStorage.setItem(DPR_STORAGE_KEY, JSON.stringify(seeded));
    memoryReports = seeded;
    return seeded;
  }
  try {
    const parsed = JSON.parse(stored) as DailyProgressReport[];
    memoryReports = parsed;
    return parsed;
  } catch {
    const seeded = seedReports();
    window.localStorage.setItem(DPR_STORAGE_KEY, JSON.stringify(seeded));
    memoryReports = seeded;
    return seeded;
  }
}

function writeReports(reports: DailyProgressReport[]) {
  memoryReports = reports;
  if (isBrowser()) {
    window.localStorage.setItem(DPR_STORAGE_KEY, JSON.stringify(reports));
  }
}

function canCreateDpr(user: AppUser) {
  return ["site_staff", "manager", "admin_hr", "super_admin"].includes(user.role);
}

function canViewDpr(user: AppUser, report: DailyProgressReport) {
  if (report.submittedBy === user.id) {
    return true;
  }
  if (user.role === "manager") {
    return user.projectIds.includes(report.projectId);
  }
  return ["admin_hr", "super_admin"].includes(user.role);
}

function canReviewDpr(user: AppUser, report: DailyProgressReport) {
  if (["admin_hr", "super_admin"].includes(user.role)) {
    return true;
  }
  return user.role === "manager" && user.projectIds.includes(report.projectId);
}

function applyFilters(
  reports: DailyProgressReport[],
  filters?: DprFilters,
) {
  return reports.filter((report) => {
    if (filters?.month && !report.reportDate.startsWith(filters.month)) {
      return false;
    }
    if (filters?.projectId && report.projectId !== filters.projectId) {
      return false;
    }
    if (filters?.status && filters.status !== "all" && report.status !== filters.status) {
      return false;
    }
    if (filters?.search?.trim()) {
      const query = filters.search.trim().toLowerCase();
      const haystack = [
        report.dprNumber,
        report.projectName,
        report.submittedByName,
        report.nextDayPlan,
        ...report.activities.map((activity) => activity.activityName),
        ...report.issues.map((issue) => issue.description),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    }
    return true;
  });
}

function nextDprNumber(reports: DailyProgressReport[]) {
  const next =
    reports
      .map((report) => Number(report.dprNumber.split("-").at(-1)))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `DPR-2026-${String(next).padStart(4, "0")}`;
}

function validateReport(input: DprInput, status: DprStatus) {
  if (input.reportDate > today()) {
    throw new Error("DPR date cannot be in the future.");
  }
  for (const activity of input.activities) {
    if (!activity.activityName.trim()) {
      throw new Error("Every activity needs a name.");
    }
    if (!activity.description.trim()) {
      throw new Error("Every activity needs a description.");
    }
    if (
      activity.completionPercent < 0 ||
      activity.completionPercent > 100
    ) {
      throw new Error("Activity completion must be between 0 and 100.");
    }
    const laborValues = Object.values(activity.labor);
    if (laborValues.some((value) => value < 0 || !Number.isFinite(value))) {
      throw new Error("Labor counts must be valid non-negative numbers.");
    }
  }
  if (status === "submitted") {
    if (input.activities.length === 0) {
      throw new Error("Add at least one activity before submitting DPR.");
    }
    if (input.photos.length === 0) {
      throw new Error("Attach at least one site photo before submitting DPR.");
    }
    if (!input.nextDayPlan.trim()) {
      throw new Error("Enter the next day plan before submitting DPR.");
    }
  }
}

function summarize(reports: DailyProgressReport[]): FieldOperationsSummary {
  const month = today().slice(0, 7);
  return {
    totalReports: reports.length,
    submittedThisMonth: reports.filter((report) =>
      report.reportDate.startsWith(month),
    ).length,
    draftReports: reports.filter((report) => report.status === "draft").length,
    pendingIssues: reports.reduce(
      (total, report) =>
        total + report.issues.filter((issue) => issue.status === "pending").length,
      0,
    ),
    photoCount: reports.reduce((total, report) => total + report.photos.length, 0),
  };
}

export function calculateDprLaborSummary(
  report: Pick<DailyProgressReport, "activities">,
): DprLaborSummary {
  const totals = report.activities.reduce(
    (summary, activity) => ({
      male: summary.male + activity.labor.male,
      female: summary.female + activity.labor.female,
      supervisors: summary.supervisors + activity.labor.supervisors,
      companyStaff: summary.companyStaff + activity.labor.companyStaff,
    }),
    { male: 0, female: 0, supervisors: 0, companyStaff: 0 },
  );
  return {
    ...totals,
    casualLabor: totals.male + totals.female,
    totalWorkforce:
      totals.male + totals.female + totals.supervisors + totals.companyStaff,
  };
}

export const fieldOperationsService = {
  async listReports(user: AppUser, filters?: DprFilters) {
    const reports = isSupabaseConfigured
      ? await fieldOperationsRepository.list(user)
      : readReports();
    const visible = reports.filter((report) => canViewDpr(user, report));
    return applyFilters(visible, filters).sort((left, right) =>
      right.reportDate.localeCompare(left.reportDate) ||
      right.updatedAt.localeCompare(left.updatedAt),
    );
  },

  async getReport(reportId: string, user: AppUser) {
    const reports = isSupabaseConfigured
      ? await fieldOperationsRepository.list(user)
      : readReports();
    const report = reports.find((item) => item.id === reportId);
    return report && canViewDpr(user, report) ? report : null;
  },

  async getDashboard(user: AppUser) {
    const reports = await this.listReports(user);
    return {
      summary: summarize(reports),
      recent: reports.slice(0, 6),
      issueReports: reports.filter((report) =>
        report.issues.some((issue) => issue.status === "pending"),
      ),
    };
  },

  async saveDpr(input: DprInput, actor: AppUser, status: Extract<DprStatus, "draft" | "submitted">) {
    if (!canCreateDpr(actor)) {
      throw new Error("You do not have permission to save DPR.");
    }
    validateReport(input, status);

    const reports = isSupabaseConfigured
      ? await fieldOperationsRepository.list(actor)
      : readReports();
    if (
      status === "submitted" &&
      reports.some(
        (report) =>
          report.submittedBy === actor.id &&
          report.projectId === input.projectId &&
          report.reportDate === input.reportDate &&
          report.status !== "draft",
      )
    ) {
      throw new Error("DPR already submitted for this project and date.");
    }
    if (isSupabaseConfigured) {
      return fieldOperationsRepository.save(input, actor, status);
    }

    const createdAt = now();
    const report: DailyProgressReport = {
      id: crypto.randomUUID(),
      dprNumber: nextDprNumber(reports),
      projectId: input.projectId,
      projectName: getProjectName(input.projectId),
      reportDate: input.reportDate,
      shiftId: input.shiftId,
      shiftName: getShiftName(input.shiftId),
      submittedBy: actor.id,
      submittedByName: actor.fullName,
      submittedByRole: actor.role,
      weather: input.weather,
      activities: input.activities,
      issues: input.issues,
      nextDayPlan: input.nextDayPlan.trim(),
      plannedManpower: input.plannedManpower,
      plannedEquipment: input.plannedEquipment.trim(),
      photos: input.photos,
      status,
      submittedAt: status === "submitted" ? createdAt : undefined,
      createdAt,
      updatedAt: createdAt,
    };
    writeReports([report, ...reports]);
    await recordAuditLog({
      userId: actor.id,
      action: status === "submitted" ? "dpr.submitted" : "dpr.draft_saved",
      entityType: "daily_progress_report",
      entityId: report.id,
      newValues: {
        dprNumber: report.dprNumber,
        projectId: report.projectId,
        reportDate: report.reportDate,
        status: report.status,
      },
    });
    return report;
  },

  async reviewDpr(
    reportId: string,
    actor: AppUser,
    decision: Extract<DprStatus, "reviewed" | "returned">,
    comments: string,
  ) {
    const reports = isSupabaseConfigured
      ? await fieldOperationsRepository.list(actor)
      : readReports();
    const report = reports.find((item) => item.id === reportId);
    if (!report) {
      throw new Error("DPR not found.");
    }
    if (!canReviewDpr(actor, report)) {
      throw new Error("You do not have permission to review this DPR.");
    }
    if (isSupabaseConfigured) {
      return fieldOperationsRepository.review(reportId, actor, decision, comments);
    }
    const reviewedAt = now();
    const updated: DailyProgressReport = {
      ...report,
      status: decision,
      reviewedBy: actor.id,
      reviewedByName: actor.fullName,
      reviewedAt,
      reviewComments: comments.trim(),
      updatedAt: reviewedAt,
    };
    writeReports(reports.map((item) => (item.id === reportId ? updated : item)));
    await recordAuditLog({
      userId: actor.id,
      action: `dpr.${decision}`,
      entityType: "daily_progress_report",
      entityId: reportId,
      oldValues: { status: report.status },
      newValues: { status: decision, comments },
    });
    return updated;
  },

  resetDemoData() {
    writeReports(seedReports());
  },
};

export type { DprActivity, DprIssue, DprPhoto };
