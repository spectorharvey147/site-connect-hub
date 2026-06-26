import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useAuth } from "@/hooks/useAuth";
import { expenseCategoryService } from "@/services/expenseCategoryService";
import type { ExpenseCategory } from "@/types/claims";

const emptyForm: ExpenseCategory = {
  id: "",
  name: "",
  description: "",
  requiresBill: false,
  status: "active",
};

export function ExpenseCategoriesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ExpenseCategory[]>([]);
  const [form, setForm] = useState<ExpenseCategory>(emptyForm);

  async function load() {
    setRows(await expenseCategoryService.list(true));
  }

  useEffect(() => {
    void load();
  }, []);

  if (!user) {
    return null;
  }

  function update<Key extends keyof ExpenseCategory>(key: Key, value: ExpenseCategory[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!user) {
      return;
    }
    try {
      await expenseCategoryService.save(form, user);
      setForm(emptyForm);
      toast.success("Expense category saved.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save category.");
    }
  }

  return (
    <>
      <PageHeader
        title="Claim Expense Categories"
        description="Add or edit claim expense categories and bill requirement."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Settings", to: "/settings" },
          { label: "Claim Expense Categories" },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add / Edit Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Category Code"
              placeholder="e.g. travel"
              value={form.id}
              onChange={(event) => update("id", event.target.value)}
            />
            <Input
              label="Category Name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
            />
            <Textarea
              label="Description"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={form.requiresBill}
                onChange={(event) => update("requiresBill", event.target.checked)}
              />
              Requires bill by default
            </label>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => void save()}>
              Save Category
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Current Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-surface-border p-4 text-left"
                onClick={() => setForm(row)}
              >
                <div>
                  <p className="font-bold text-text-primary">
                    {row.id} · {row.name}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {row.description || "No description"} · {row.requiresBill ? "Bill required" : "Bill optional"}
                  </p>
                </div>
                <Badge tone={row.status === "active" ? "success" : "neutral"}>{row.status}</Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
