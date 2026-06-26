import { EXPENSE_CATEGORIES as DEFAULT_EXPENSE_CATEGORIES } from "@/constants/claims";
import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type { ExpenseCategory } from "@/types/claims";

type Row = {
  id: string;
  name: string;
  description: string | null;
  requires_bill: boolean | null;
  status: ExpenseCategory["status"];
};

export type ExpenseCategoryInput = ExpenseCategory;

function assertCanManage(actor: AppUser) {
  if (!["admin_hr", "super_admin"].includes(actor.role)) {
    throw new Error("Only Admin / HR or Super Admin can manage expense categories.");
  }
}

function mapRow(row: Row): ExpenseCategory {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    requiresBill: Boolean(row.requires_bill),
    status: row.status,
  };
}

export const expenseCategoryService = {
  async list(includeInactive = false): Promise<ExpenseCategory[]> {
    if (!isSupabaseConfigured || !supabase) {
      return DEFAULT_EXPENSE_CATEGORIES.filter(
        (category) => includeInactive || category.status === "active",
      );
    }
    let query = supabase.from("expense_categories").select("*").order("name");
    if (!includeInactive) {
      query = query.eq("status", "active");
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return ((data as Row[] | null) ?? []).map(mapRow);
  },

  async save(input: ExpenseCategoryInput, actor: AppUser) {
    assertCanManage(actor);
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }
    if (!input.id.trim() || !input.name.trim()) {
      throw new Error("Category code and name are required.");
    }
    const payload = {
      id: input.id.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-"),
      name: input.name.trim(),
      description: input.description.trim(),
      requires_bill: input.requiresBill,
      status: input.status,
    };
    const { error } = await supabase
      .from("expense_categories")
      .upsert(payload, { onConflict: "id" });
    if (error) {
      throw new Error(error.message);
    }
    await recordAuditLog({
      userId: actor.id,
      action: "expense_category.saved",
      entityType: "expense_category",
      entityId: payload.id,
      newValues: payload,
    });
  },
};
