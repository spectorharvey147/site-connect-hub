import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase",
    "migrations",
    "20260813001000_projects_schema_contract_repair.sql",
  ),
  "utf8",
);
const attendanceMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase",
    "migrations",
    "20260811001000_attendance_production_hardening.sql",
  ),
  "utf8",
);

describe("project database schema contract", () => {
  it.each([
    "organization_id",
    "customer_id",
    "address",
    "city",
    "state",
    "pincode",
    "latitude",
    "longitude",
    "geofence_radius",
    "attendance_enabled",
    "attendance_configuration_verified",
    "attendance_verified_by",
    "attendance_verified_at",
    "project_budget",
    "project_manager_id",
    "work_manager_mappings",
    "primary_department_id",
    "is_common_project",
    "description",
  ])("repairs the %s field", (column) => {
    expect(migration).toContain(`add column if not exists ${column}`);
  });

  it("validates the complete creation payload and reloads PostgREST", () => {
    for (const column of [
      "code",
      "name",
      "customer_name",
      "location",
      "start_date",
      "end_date",
      "status",
      "created_by",
      "updated_by",
    ]) {
      expect(migration).toContain(`'${column}'`);
    }
    expect(migration).toContain("pg_notify('pgrst', 'reload schema')");
  });

  it("preserves defaults on the existing attendance punch signature", () => {
    expect(attendanceMigration).toContain("p_project_id uuid default null");
    expect(attendanceMigration).toContain("p_latitude numeric default null");
    expect(attendanceMigration).toContain("p_longitude numeric default null");
    expect(attendanceMigration).toContain("p_accuracy int default null");
  });
});
