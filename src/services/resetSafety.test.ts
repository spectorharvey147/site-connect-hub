import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function resetFile(name: string) {
  return readFileSync(resolve(process.cwd(), "supabase", "reset", name), "utf8");
}

describe("production reset safety", () => {
  it("uses an explicit app-table whitelist", () => {
    const sql = resetFile("001_wipe_app_data.sql");

    expect(sql).toContain("foreach table_name in array");
    expect(sql).not.toContain("information_schema.tables");
    expect(sql).not.toContain("truncate table public.%I cascade");
  });

  it("deletes objects only from the approved Site Connect buckets", () => {
    const sql = resetFile("002_wipe_storage.sql");
    const requiredBuckets = [
      "organization-logos",
      "profile-photos",
      "claim-attachments",
      "leave-documents",
      "dpr-photos",
      "task-attachments",
      "message-attachments",
      "vendor-bills",
      "material-documents",
      "fuel-receipts",
      "vendor-contracts",
      "payment-proofs",
      "sap-exports",
    ];

    for (const bucket of requiredBuckets) {
      expect(sql).toContain(`'${bucket}'`);
    }
    expect(sql).toContain("where bucket_id in");
    expect(sql).not.toMatch(/delete\s+from\s+storage\.objects\s*;/i);
  });

  it("never references the local environment file", () => {
    for (const name of [
      "001_wipe_app_data.sql",
      "002_wipe_storage.sql",
      "003_optional_wipe_auth_users.sql",
      "004_fresh_seed.sql",
    ]) {
      expect(resetFile(name)).not.toContain(".env.local");
    }
  });
});
