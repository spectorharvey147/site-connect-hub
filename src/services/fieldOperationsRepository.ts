import {
  profileNameMap,
  projectNameMap,
  requireSupabase,
  type DataRow,
} from "@/services/normalizedDataUtils";
import type { AppUser } from "@/types/auth";
import type {
  DailyProgressReport,
  DprInput,
  DprStatus,
} from "@/types/fieldOperations";
import { storageService } from "@/services/storageService";

export const fieldOperationsRepository = {
  async list(actor: AppUser) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("daily_progress_reports")
      .select("*,dpr_activities(*),dpr_issues(*),dpr_photos(*)")
      .eq("organization_id", actor.organizationId!)
      .order("report_date", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data as DataRow[] | null) ?? [];
    const [projects, profiles] = await Promise.all([
      projectNameMap(rows.map((row) => String(row.project_id))),
      profileNameMap(rows.flatMap((row) => [String(row.submitted_by), String(row.reviewed_by ?? "")])),
    ]);
    return Promise.all(rows.map(async (row): Promise<DailyProgressReport> => ({
      id: String(row.id),
      dprNumber: String(row.dpr_number),
      projectId: String(row.project_id),
      projectName: projects.get(String(row.project_id)) ?? "Project",
      reportDate: String(row.report_date),
      shiftId: String(row.shift_id ?? ""),
      shiftName: String(row.shift_name ?? "General Shift"),
      submittedBy: String(row.submitted_by),
      submittedByName: profiles.get(String(row.submitted_by)) ?? "User",
      submittedByRole: actor.role,
      weather: (row.weather ?? []) as DailyProgressReport["weather"],
      activities: ((row.dpr_activities as DataRow[] | null) ?? []).map((item) => ({
        id: String(item.id),
        activityName: String(item.activity_name),
        customActivityName: item.custom_activity_name ? String(item.custom_activity_name) : undefined,
        description: String(item.description),
        completionPercent: Number(item.completion_percent),
        machinesUsed: (item.machines_used ?? []) as DailyProgressReport["activities"][number]["machinesUsed"],
        customMachines: ((item.custom_machines ?? []) as string[]).filter(Boolean),
        labor: {
          male: Number(item.male_labor),
          female: Number(item.female_labor),
          supervisors: Number(item.supervisors),
          companyStaff: Number(item.company_staff),
        },
        comments: item.comments ? String(item.comments) : undefined,
      })),
      issues: ((row.dpr_issues as DataRow[] | null) ?? []).map((item) => ({
        id: String(item.id),
        issueType: item.issue_type as DailyProgressReport["issues"][number]["issueType"],
        severity: item.severity as DailyProgressReport["issues"][number]["severity"],
        description: String(item.description),
        resolutionNotes: item.resolution_notes ? String(item.resolution_notes) : undefined,
        status: item.status as DailyProgressReport["issues"][number]["status"],
      })),
      nextDayPlan: String(row.next_day_plan ?? ""),
      plannedManpower: Number(row.planned_manpower),
      plannedEquipment: String(row.planned_equipment ?? ""),
      photos: await Promise.all(((row.dpr_photos as DataRow[] | null) ?? []).map(async (item) => {
        const bucket = String(item.storage_bucket ?? "dpr-photos") as "dpr-photos";
        const path = item.storage_path ? String(item.storage_path) : undefined;
        let url = String(item.file_url ?? "");
        if (path) url = await storageService.createSignedUrl(bucket, path, 900);
        return {
        id: String(item.id),
        fileName: String(item.file_name),
        fileType: String(item.file_type ?? ""),
        fileSize: Number(item.file_size ?? 0),
        url,
        storageBucket: bucket,
        storagePath: path,
        caption: item.caption ? String(item.caption) : undefined,
        uploadedBy: String(item.uploaded_by ?? row.submitted_by),
        uploadedByName: profiles.get(String(item.uploaded_by ?? row.submitted_by)) ?? "User",
        createdAt: String(item.created_at),
      }})),
      status: row.status as DailyProgressReport["status"],
      submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
      reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
      reviewedByName: row.reviewed_by ? profiles.get(String(row.reviewed_by)) : undefined,
      reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
      reviewComments: row.review_comments ? String(row.review_comments) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })));
  },

  async save(
    input: DprInput,
    actor: AppUser,
    status: Extract<DprStatus, "draft" | "submitted">,
  ) {
    const client = requireSupabase();
    const { data, error } = await client.rpc("save_daily_progress_report", {
      p_dpr_id: input.id ?? null,
      p_project_id: input.projectId,
      p_report_date: input.reportDate,
      p_shift_id: input.shiftId,
      p_weather: input.weather,
      p_next_day_plan: input.nextDayPlan,
      p_planned_manpower: input.plannedManpower,
      p_planned_equipment: input.plannedEquipment,
      p_status: status,
      p_activities: input.activities,
      p_issues: input.issues,
      p_photos: input.photos.map((photo) => ({
        id: /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(photo.id) ? photo.id : crypto.randomUUID(), file_name: photo.fileName,
        file_type: photo.fileType, file_size: photo.fileSize, caption: photo.caption ?? null,
        storage_bucket: photo.storageBucket ?? "dpr-photos", storage_path: photo.storagePath,
      })),
    });
    if (error) throw new Error(error.message);
    const dprId = String(data);
    return (await this.list(actor)).find((row) => row.id === dprId)!;
  },

  async review(id: string, actor: AppUser, status: "reviewed" | "returned", comments: string) {
    const client = requireSupabase();
    const { error } = await client.rpc("review_daily_progress_report", {
      target_dpr_id: id,
      decision: status,
      comments,
    });
    if (error) throw new Error(error.message);
    return (await this.list(actor)).find((row) => row.id === id)!;
  },
};
