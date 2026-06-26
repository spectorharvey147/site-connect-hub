import { Plus, Tags } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { EXPENSE_CATEGORIES } from "@/constants/claims";
import { useAuth } from "@/hooks/useAuth";
import { projectService } from "@/services/projectService";
import type {
  CommonCostCode,
  Customer,
  ProjectExpenseType,
  ProjectMaster,
} from "@/types/projects";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

const expenseTypes: ProjectExpenseType[] = [
  "Labour",
  "Machinery",
  "Fuel",
  "Material",
  "Travel",
  "Food",
  "Accommodation",
  "Miscellaneous",
  "Vendor Bill",
  "Other",
];

export function ProjectCostCodesPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectMaster[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [commonCostCodes, setCommonCostCodes] = useState<CommonCostCode[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [expenseType, setExpenseType] = useState<ProjectExpenseType>("Other");
  const [customerIds, setCustomerIds] = useState<string[]>([]);
  const [expenseCategoryIds, setExpenseCategoryIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    if (!user?.organizationId) {
      return;
    }
    const [projectRows, customerRows, commonRows] = await Promise.all([
      projectService.getProjects(user.organizationId),
      projectService.getCustomers(user.organizationId),
      projectService.getCommonCostCodes(user.organizationId),
    ]);
    setProjects(projectRows);
    setCustomers(customerRows.filter((customer) => customer.status === "active"));
    setCommonCostCodes(commonRows);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveCommonCostCode() {
    if (!user?.organizationId) {
      return;
    }
    try {
      await projectService.saveCommonCostCode(
        {
          organizationId: user.organizationId,
          code,
          name,
          expenseType,
          customerIds,
          expenseCategoryIds,
          description,
          status: "active",
        },
        user,
      );
      setCode("");
      setName("");
      setCustomerIds([]);
      setExpenseCategoryIds([]);
      setDescription("");
      toast.success("Common cost code created.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save common cost code.");
    }
  }

  return (
    <>
      <PageHeader
        title="Cost Codes"
        description="Maintain reusable common cost codes, then link them into individual project cost codes."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Settings", to: "/settings" },
          { label: "Project Cost Codes" },
        ]}
      />

      <div className="mb-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create Common Cost Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Common Cost Code" value={code} onChange={(event) => setCode(event.target.value)} />
            <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} />
            <FormField label="Expense Type">
              <select
                className={selectClass}
                value={expenseType}
                onChange={(event) => setExpenseType(event.target.value as ProjectExpenseType)}
              >
                {expenseTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </FormField>
            <MultiSelect
              label="Mapped customers"
              help="Select 2–3 or more customers that can use this common cost code."
              options={customers.map((customer) => ({
                value: customer.id,
                label: `${customer.customerName} (${customer.customerCode})`,
              }))}
              values={customerIds}
              onChange={setCustomerIds}
            />
            <MultiSelect
              label="Allowed claim categories"
              help="Controls which claim expense categories can use project codes linked to this common code."
              options={EXPENSE_CATEGORIES.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
              values={expenseCategoryIds}
              onChange={setExpenseCategoryIds}
            />
            <Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => void saveCommonCostCode()}>
              Create Common Code
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Common Cost Code Master</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {commonCostCodes.length === 0 ? (
              <p className="text-sm text-text-secondary">No common cost codes created yet.</p>
            ) : (
              commonCostCodes.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-surface-border p-4"
                >
                  <div>
                    <p className="font-bold text-text-primary">
                      {item.code} · {item.name}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {item.expenseType} · {item.customerIds.length} mapped customers ·{" "}
                      {item.expenseCategoryIds.length || "All"} claim categories
                    </p>
                  </div>
                  <Badge tone="info">{item.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-text-primary">{project.name}</p>
                  <p className="text-sm text-text-secondary">{project.code}</p>
                </div>
                <Tags className="h-5 w-5 text-brand-blue" />
              </div>
              <p className="text-sm text-text-secondary">
                {project.costCodeCount} configured project cost codes
              </p>
              <Link to={`/projects/${project.id}/cost-codes`}>
                <Button className="w-full" variant="secondary">
                  Manage Project Codes
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function MultiSelect({
  label,
  help,
  options,
  values,
  onChange,
}: {
  label: string;
  help: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  }

  return (
    <FormField label={label}>
      <div className="space-y-2 rounded-md border border-surface-border bg-white p-3">
        <p className="text-xs text-text-secondary">{help}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={values.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </FormField>
  );
}
