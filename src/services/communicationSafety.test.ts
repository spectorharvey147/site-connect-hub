import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration=readFileSync("supabase/migrations/20260811002000_communication_center.sql","utf8");
const dpr=readFileSync("supabase/migrations/20260811003000_atomic_dpr_and_media.sql","utf8");
describe("Communication Center safety contract",()=>{
  it("excludes Attendance events and personal destinations",()=>{expect(migration).toContain("check(attendance_enabled=false)");expect(migration).toContain("like '%@g.us'");expect(migration).not.toContain("attendance.checked");});
  it("uses locking, idempotency and safe defaults",()=>{expect(migration).toContain("for update skip locked");expect(migration).toContain("unique(organization_id,idempotency_key)");expect(migration).toContain("globally_enabled boolean not null default false");expect(migration).toContain("approval_required boolean not null default true");});
  it("creates a submitted event in the same atomic DPR function",()=>{expect(dpr).toContain("save_daily_progress_report");expect(dpr).toContain("dpr.resubmitted");expect(dpr).toContain("on conflict(organization_id,idempotency_key) do nothing");expect(dpr).toContain("storage_path");});
});
