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
    return rows.map((row): DailyProgressReport => ({
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
      photos: ((row.dpr_photos as DataRow[] | null) ?? []).map((item) => ({
        id: String(item.id),
        fileName: String(item.file_name),
        fileType: String(item.file_type ?? ""),
        fileSize: Number(item.file_size ?? 0),
        url: String(item.file_url),
        caption: item.caption ? String(item.caption) : undefined,
        uploadedBy: String(item.uploaded_by ?? row.submitted_by),
        uploadedByName: profiles.get(String(item.uploaded_by ?? row.submitted_by)) ?? "User",
        createdAt: String(item.created_at),
      })),
      status: row.status as DailyProgressReport["status"],
      submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
      reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
      reviewedByName: row.reviewed_by ? profiles.get(String(row.reviewed_by)) : undefined,
      reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
      reviewComments: row.review_comments ? String(row.review_comments) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  },

  async save(
    input: DprInput,
    actor: AppUser,
    status: Extract<DprStatus, "draft" | "submitted">,
  ) {
    const client = requireSupabase();
    const dprNumber = `DPR-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data, error } = await client.from("daily_progress_reports").insert({
      organization_id: actor.organizationId,
      project_id: input.projectId,
      department_id: actor.departmentId ?? null,
      dpr_number: dprNumber,
      report_date: input.reportDate,
      shift_id: input.shiftId,
      weather: input.weather,
      next_day_plan: input.nextDayPlan,
      planned_manpower: input.plannedManpower,
      planned_equipment: input.plannedEquipment,
      status,
      submitted_by: actor.id,
      submitted_at: status === "submitted" ? new Date().toISOString() : null,
      created_by: actor.id,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const dprId = String(data.id);
    const results = await Promise.all([
      input.activities.length
        ? client.from("dpr_activities").insert(input.activities.map((item) => ({
            id: item.id || crypto.randomUUID(),
            dpr_id: dprId,
            activity_name: item.activityName,
            custom_activity_name: item.customActivityName ?? null,
            description: item.description,
            completion_percent: item.completionPercent,
            machines_used: item.machinesUsed,
            custom_machines: item.customMachines ?? [],
            male_labor: item.labor.male,
            female_labor: item.labor.female,
            supervisors: item.labor.supervisors,
            company_staff: item.labor.companyStaff,
            comments: item.comments ?? null,
          })))
        : Promise.resolve({ error: null }),
      input.issues.length
        ? client.from("dpr_issues").insert(input.issues.map((item) => ({
            id: item.id || crypto.randomUUID(),
            dpr_id: dprId,
            issue_type: item.issueType,
            severity: item.severity,
            description: item.description,
            resolution_notes: item.resolutionNotes ?? null,
            status: item.status,
          })))
        : Promise.resolve({ error: null }),
      input.photos.length
        ? client.from("dpr_photos").insert(input.photos.map((item) => ({
            id: item.id || crypto.randomUUID(),
            dpr_id: dprId,
            file_url: item.url,
            file_name: item.fileName,
            file_type: item.fileType,
            file_size: item.fileSize,
            caption: item.caption ?? null,
            uploaded_by: actor.id,
          })))
        : Promise.resolve({ error: null }),
    ]);
    const detailError = results.find((result) => result.error)?.error;
    if (detailError) {
      await client.from("daily_progress_reports").delete().eq("id", dprId);
      throw new Error(detailError.message);
    }
    const labourCount = input.activities.reduce(
      (sum, item) =>
        sum +
        item.labor.male +
        item.labor.female +
        item.labor.supervisors +
        item.labor.companyStaff,
      0,
    );
    const machineryUsed = input.activities.flatMap((item) => [
      ...item.machinesUsed,
      ...(item.customMachines ?? []),
    ]);
    const completionPercentage =
      input.activities.length > 0
        ? input.activities.reduce((sum, item) => sum + item.completionPercent, 0) /
          input.activities.length
        : 0;
    const { error: canonicalError } = await client.from("dpr_reports").insert({
      organization_id: actor.organizationId,
      project_id: input.projectId,
      department_id: actor.departmentId ?? null,
      daily_progress_report_id: dprId,
      report_number: dprNumber,
      report_date: input.reportDate,
      weather: input.weather,
      labour_count: labourCount,
      machinery_used: machineryUsed,
      completion_percentage: completionPercentage,
      issues: input.issues.map((item) => item.description).join("\n"),
      next_day_plan: input.nextDayPlan,
      status,
      created_by: actor.id,
    });
    if (canonicalError) {
      await client.from("daily_progress_reports").delete().eq("id", dprId);
      throw new Error(canonicalError.message);
    }
    return (await this.list(actor)).find((row) => row.id === dprId)!;
  },

  async review(id: string, actor: AppUser, status: "reviewed" | "returned", comments: string) {
    const client = requireSupabase();
    const { error } = await client.from("daily_progress_reports").update({
      status,
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      review_comments: comments,
    }).eq("id", id);
    if (error) throw new Error(error.message);
    return (await this.list(actor)).find((row) => row.id === id)!;
  },
};
