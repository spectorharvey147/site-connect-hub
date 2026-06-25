import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const productionServices = [
  "attendanceService.ts",
  "claimsService.ts",
  "casualLabourService.ts",
  "machineryService.ts",
  "fuelService.ts",
  "materialsService.ts",
  "vendorsService.ts",
  "fieldOperationsService.ts",
  "messagingService.ts",
  "taskService.ts",
];

describe("normalized production data paths", () => {
  it.each(productionServices)(
    "%s does not use generic business_documents",
    (fileName) => {
      const source = readFileSync(
        resolve(process.cwd(), "src", "services", fileName),
        "utf8",
      );
      expect(source).not.toContain("businessDocumentService");
      expect(source).not.toContain('from("business_documents")');
    },
  );

  it("provides dedicated normalized repositories", () => {
    for (const repository of [
      "casualLabourRepository.ts",
      "machineryRepository.ts",
      "fuelRepository.ts",
      "materialsRepository.ts",
      "vendorsRepository.ts",
    ]) {
      expect(
        readFileSync(
          resolve(process.cwd(), "src", "services", repository),
          "utf8",
        ).length,
      ).toBeGreaterThan(100);
    }
  });

  it("declares phase 1 canonical normalized gap tables", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase",
        "migrations",
        "20260623005000_phase_1_normalized_schema_alignment.sql",
      ),
      "utf8",
    );
    for (const tableName of [
      "casual_labour_attendance_items",
      "labour_advance_deductions",
      "fuel_cash_expenses",
      "material_damage_wastage",
      "dpr_reports",
    ]) {
      expect(migration).toContain(`create table if not exists public.${tableName}`);
      expect(migration).toContain(`'${tableName}'`);
    }
  });

  it("dual-writes legacy-compatible modules into canonical normalized tables", () => {
    const casualLabourRepository = readFileSync(
      resolve(process.cwd(), "src", "services", "casualLabourRepository.ts"),
      "utf8",
    );
    const fieldOperationsRepository = readFileSync(
      resolve(process.cwd(), "src", "services", "fieldOperationsRepository.ts"),
      "utf8",
    );
    expect(casualLabourRepository).toContain('from("casual_labour_attendance_items")');
    expect(fieldOperationsRepository).toContain('from("dpr_reports")');
  });

  it("keeps fuel deposits, cash purchases and stock ledgers on normalized tables", () => {
    const fuelRepository = readFileSync(
      resolve(process.cwd(), "src", "services", "fuelRepository.ts"),
      "utf8",
    );
    for (const tableName of [
      "fuel_vendor_deposits",
      "fuel_vendor_ledger",
      "fuel_stock_ledger",
      "fuel_cash_expenses",
    ]) {
      expect(fuelRepository).toContain(`from("${tableName}")`);
    }
  });

  it("posts material consumption and wastage into normalized stock records", () => {
    const materialsRepository = readFileSync(
      resolve(process.cwd(), "src", "services", "materialsRepository.ts"),
      "utf8",
    );
    for (const tableName of [
      "material_consumption",
      "material_damage_wastage",
      "material_stock_ledger",
    ]) {
      expect(materialsRepository).toContain(`from("${tableName}")`);
    }
  });

  it.each(productionServices)(
    "%s blocks static demo project names when Supabase is configured",
    (fileName) => {
      const source = readFileSync(
        resolve(process.cwd(), "src", "services", fileName),
        "utf8",
      );
      if (!source.includes("PROJECT_OPTIONS")) {
        return;
      }
      expect(source).toContain("Production project names must come from Supabase.");
    },
  );
});
