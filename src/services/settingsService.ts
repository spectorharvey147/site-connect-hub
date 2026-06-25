import { PROJECT_OPTIONS } from "@/constants/claims";
import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type {
  AppSettings,
  CompanySettings,
  MasterSettings,
  NotificationSettings,
  WorkflowSettings,
} from "@/types/settings";

const SETTINGS_STORAGE_KEY = "site-connect:app-settings";

let memorySettings: AppSettings | null = null;

interface SupabaseSettingsRow {
  company: Partial<CompanySettings> | null;
  workflow: Partial<WorkflowSettings> | null;
  notifications: Partial<NotificationSettings> | null;
  masters: Partial<MasterSettings> | null;
  updated_by: string | null;
  updated_at: string;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function now() {
  return new Date().toISOString();
}

function defaultSettings(): AppSettings {
  return {
    company: {
      companyName: "IPI Site Connect",
      supportEmail: "support@siteconnect.local",
      supportPhone: "+91 98765 10000",
      currency: "INR",
      timezone: "Asia/Kolkata",
      fiscalYearStart: "04-01",
      logoUrl: "",
    },
    workflow: {
      claimAdminVerificationRequired: true,
      claimManagerApprovalLimit: 50000,
      claimFinalApprovalLimit: 100000,
      leaveManagerApprovalRequired: true,
      vendorBillAutoVoucher: false,
      attendanceGeoFenceMeters: 250,
    },
    notifications: {
      emailEnabled: true,
      emailEvents: Object.fromEntries([
        "claim_submitted",
        "claim_approved",
        "claim_rejected",
        "claim_changes_requested",
        "leave_submitted",
        "leave_approved",
        "leave_rejected",
        "task_assigned",
        "dpr_submitted",
        "material_request_submitted",
        "vendor_bill_submitted",
        "vendor_bill_approved",
        "voucher_generated",
        "payment_processed",
        "message_mention",
      ].map((event) => [event, true])),
      pushEnabled: true,
      dailyDigestTime: "18:00",
      escalationHours: 24,
    },
    masters: {
      defaultProjectId: PROJECT_OPTIONS[0]?.id ?? "project-metro",
      defaultShiftId: "shift-general",
      defaultLeavePolicy: "standard",
      defaultPaymentTerms: "15 days",
    },
    updatedAt: "2026-06-21T00:00:00.000Z",
  };
}

function readSettings() {
  if (!isBrowser()) {
    memorySettings ??= defaultSettings();
    return memorySettings;
  }
  const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!stored) {
    const seeded = defaultSettings();
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(seeded));
    memorySettings = seeded;
    return seeded;
  }
  try {
    const parsed = normalizeSettings(JSON.parse(stored) as AppSettings);
    memorySettings = parsed;
    return parsed;
  } catch {
    const seeded = defaultSettings();
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(seeded));
    memorySettings = seeded;
    return seeded;
  }
}

function normalizeSettings(settings: AppSettings): AppSettings {
  const defaults = defaultSettings();
  return {
    ...settings,
    company: { ...defaults.company, ...settings.company },
    workflow: { ...defaults.workflow, ...settings.workflow },
    notifications: {
      ...defaults.notifications,
      ...settings.notifications,
      emailEvents: {
        ...defaults.notifications.emailEvents,
        ...(settings.notifications?.emailEvents ?? {}),
      },
    },
    masters: { ...defaults.masters, ...settings.masters },
  };
}

function writeSettings(settings: AppSettings) {
  memorySettings = settings;
  if (isBrowser()) {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }
}

function mapSupabaseSettings(row: SupabaseSettingsRow | null): AppSettings {
  const defaults = defaultSettings();
  if (!row) {
    return defaults;
  }
  return normalizeSettings({
    company: { ...defaults.company, ...(row.company ?? {}) },
    workflow: { ...defaults.workflow, ...(row.workflow ?? {}) },
    notifications: {
      ...defaults.notifications,
      ...(row.notifications ?? {}),
      emailEvents: {
        ...defaults.notifications.emailEvents,
        ...(row.notifications?.emailEvents ?? {}),
      },
    },
    masters: { ...defaults.masters, ...(row.masters ?? {}) },
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at,
  });
}

async function readSupabaseSettings() {
  if (!supabase) {
    return readSettings();
  }
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  const settings = mapSupabaseSettings(
    data ? ((data as unknown) as SupabaseSettingsRow) : null,
  );
  memorySettings = settings;
  return settings;
}

function assertCanManage(actor: AppUser) {
  if (actor.role !== "super_admin") {
    throw new Error("Only Super Admin can update system settings.");
  }
}

async function saveSection(
  actor: AppUser,
  patch: Partial<AppSettings>,
  action: string,
) {
  assertCanManage(actor);
  const current =
    isSupabaseConfigured && supabase ? await readSupabaseSettings() : readSettings();
  const updated: AppSettings = {
    ...current,
    ...patch,
    updatedAt: now(),
    updatedBy: actor.id,
  };
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("app_settings").upsert({
      id: "default",
      company: updated.company,
      workflow: updated.workflow,
      notifications: updated.notifications,
      masters: updated.masters,
      updated_by: actor.id,
      updated_at: updated.updatedAt,
    });
    if (error) {
      throw new Error(error.message);
    }
    memorySettings = updated;
  } else {
    writeSettings(updated);
  }
  await recordAuditLog({
    userId: actor.id,
    action,
    entityType: "app_settings",
    newValues: patch as Record<string, unknown>,
  });
  return updated;
}

export const settingsService = {
  getSettings() {
    return readSettings();
  },

  async loadSettings() {
    return isSupabaseConfigured && supabase
      ? readSupabaseSettings()
      : readSettings();
  },

  async updateCompanySettings(input: CompanySettings, actor: AppUser) {
    if (!input.companyName.trim()) {
      throw new Error("Company name is required.");
    }
    return saveSection(
      actor,
      { company: { ...input, companyName: input.companyName.trim() } },
      "settings.company_updated",
    );
  },

  async updateWorkflowSettings(input: WorkflowSettings, actor: AppUser) {
    if (
      input.claimManagerApprovalLimit < 0 ||
      input.claimFinalApprovalLimit < 0 ||
      input.attendanceGeoFenceMeters < 0
    ) {
      throw new Error("Workflow limits must be non-negative.");
    }
    return saveSection(actor, { workflow: input }, "settings.workflow_updated");
  },

  async updateNotificationSettings(input: NotificationSettings, actor: AppUser) {
    if (input.escalationHours <= 0) {
      throw new Error("Escalation hours must be positive.");
    }
    return saveSection(
      actor,
      { notifications: input },
      "settings.notifications_updated",
    );
  },

  async updateMasterSettings(input: MasterSettings, actor: AppUser) {
    return saveSection(actor, { masters: input }, "settings.masters_updated");
  },

  resetDemoData() {
    writeSettings(defaultSettings());
  },
};
