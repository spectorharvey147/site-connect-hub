import { describe, expect, it } from "vitest";

import { emptyToNull, normalizeEmail, normalizeEmployeeCode, uniqueUuids } from "@/utils/supabaseInput";

describe("supabase input normalization", () => {
  it("converts empty optional values to null", () => {
    expect(emptyToNull("   ")).toBeNull();
    expect(emptyToNull(undefined)).toBeNull();
    expect(emptyToNull(" value ")).toBe("value");
  });

  it("normalizes identity fields", () => {
    expect(normalizeEmail(" User@Example.COM ")).toBe("user@example.com");
    expect(normalizeEmployeeCode(" emp-01 ")).toBe("EMP-01");
  });

  it("removes empty and duplicate UUID values", () => {
    expect(uniqueUuids(["a", "", " a ", null, "b"])).toEqual(["a", "b"]);
  });
});
