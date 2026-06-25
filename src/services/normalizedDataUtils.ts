import { supabase } from "@/services/supabaseClient";

export type DataRow = Record<string, unknown>;

export function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function projectNameMap(projectIds: string[]) {
  const ids = [...new Set(projectIds.filter(Boolean))];
  if (!ids.length) return new Map<string, string>();
  const client = requireSupabase();
  const { data, error } = await client
    .from("projects")
    .select("id,name")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return new Map(
    ((data as DataRow[] | null) ?? []).map((row) => [
      String(row.id),
      String(row.name ?? "Project"),
    ]),
  );
}

export async function profileNameMap(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map<string, string>();
  const client = requireSupabase();
  const { data, error } = await client
    .from("user_profiles")
    .select("id,full_name")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return new Map(
    ((data as DataRow[] | null) ?? []).map((row) => [
      String(row.id),
      String(row.full_name ?? "User"),
    ]),
  );
}

export async function vendorNameMap(
  vendorIds: string[],
  table = "vendors",
) {
  const ids = [...new Set(vendorIds.filter(Boolean))];
  if (!ids.length) return new Map<string, string>();
  const client = requireSupabase();
  const { data, error } = await client.from(table).select("id,name").in("id", ids);
  if (error) throw new Error(error.message);
  return new Map(
    ((data as DataRow[] | null) ?? []).map((row) => [
      String(row.id),
      String(row.name ?? "Vendor"),
    ]),
  );
}
