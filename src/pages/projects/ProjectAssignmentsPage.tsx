import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useAuth } from "@/hooks/useAuth";
import { departmentService } from "@/services/departmentService";
import { expenseCategoryService } from "@/services/expenseCategoryService";
import { projectService } from "@/services/projectService";
import { userHierarchyService } from "@/services/userHierarchyService";
import type { AppUser } from "@/types/auth";
import type { ExpenseCategory } from "@/types/claims";
import type { Department } from "@/types/organization";
import type {
  CommonCostCode,
  Customer,
  ProjectCostCode,
  ProjectDepartmentAssignment,
  ProjectExpenseType,
  ProjectMaster,
  ProjectUserAssignment,
} from "@/types/projects";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function ProjectAssignmentsPage({
  mode,
}: {
  mode: "users" | "departments" | "cost-codes";
}) {
  const { user } = useAuth();
  const { projectId } = useParams();
  const [project, setProject] = useState<ProjectMaster | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [commonCostCodes, setCommonCostCodes] = useState<CommonCostCode[]>([]);
  const [userRows, setUserRows] = useState<ProjectUserAssignment[]>([]);
  const [departmentRows, setDepartmentRows] = useState<ProjectDepartmentAssignment[]>([]);
  const [costCodes, setCostCodes] = useState<ProjectCostCode[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [assignmentType, setAssignmentType] =
    useState<"primary" | "secondary" | "temporary">("secondary");
  const [departmentType, setDepartmentType] =
    useState<"primary" | "support">("support");
  const [costCode, setCostCode] = useState("");
  const [commonCostCodeId, setCommonCostCodeId] = useState("");
  const [costCodeName, setCostCodeName] = useState("");
  const [expenseType, setExpenseType] = useState<ProjectExpenseType>("Other");
  const [codeType, setCodeType] = useState<"unique" | "common">("unique");
  const [customerIds, setCustomerIds] = useState<string[]>([]);
  const [expenseCategoryIds, setExpenseCategoryIds] = useState<string[]>([]);
  const [budget, setBudget] = useState(0);
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    if (!user?.organizationId || !projectId) {
      return;
    }
    const [projectRow, userList, departmentList, customerList, commonRows, categoryRows] = await Promise.all([
      projectService.getProjectById(projectId),
      userHierarchyService.listUsers(user.organizationId),
      departmentService.getDepartments(user.organizationId),
      projectService.getCustomers(user.organizationId),
      projectService.getCommonCostCodes(user.organizationId),
      expenseCategoryService.list(),
    ]);
    setProject(projectRow);
    setUsers(userList.filter((candidate) => candidate.status === "active"));
    setDepartments(departmentList.filter((department) => department.status === "active"));
    setCustomers(customerList.filter((customer) => customer.status === "active"));
    setExpenseCategories(categoryRows.filter((category) => category.status === "active"));
    setCommonCostCodes(commonRows.filter((item) => item.status === "active"));
    if (mode === "users") {
      setUserRows(await projectService.getProjectUsers(projectId));
    } else if (mode === "departments") {
      setDepartmentRows(await projectService.getProjectDepartments(projectId));
    } else {
      setCostCodes(await projectService.getProjectCostCodes(projectId));
    }
  }, [mode, projectId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user || !projectId || !project) {
    return null;
  }

  async function submit() {
    if (!project || !projectId || !user) {
      return;
    }

    try {
      if (mode === "users") {
        if (!selectedUserId) throw new Error("Select a user.");
        const selected = users.find((candidate) => candidate.id === selectedUserId);
        await projectService.assignUser(
          {
            organizationId: project.organizationId,
            userId: selectedUserId,
            projectId,
            departmentId: selected?.departmentId,
            assignmentType,
            startDate: new Date().toISOString().slice(0, 10),
            status: "active",
          },
          user,
        );
      } else if (mode === "departments") {
        if (!selectedDepartmentId) throw new Error("Select a department.");
        await projectService.assignDepartment(
          {
            organizationId: project.organizationId,
            departmentId: selectedDepartmentId,
            projectId,
            assignmentType: departmentType,
            startDate: new Date().toISOString().slice(0, 10),
            status: "active",
          },
          user,
        );
      } else {
        await projectService.saveCostCode(
          {
            organizationId: project.organizationId,
            projectId,
            commonCostCodeId: commonCostCodeId || undefined,
            code: costCode,
            name: costCodeName,
            expenseType,
            codeType,
            customerIds,
            expenseCategoryIds,
            description,
            budgetAllocated: budget,
            responsibleDepartmentId: selectedDepartmentId || undefined,
            status: "active",
          },
          user,
        );
        setCostCode("");
        setCommonCostCodeId("");
        setCostCodeName("");
        setCodeType("unique");
        setCustomerIds([]);
        setExpenseCategoryIds([]);
      }
      toast.success("Project master updated.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update project.");
    }
  }

  const title =
    mode === "users"
      ? "Project Users"
      : mode === "departments"
        ? "Project Departments"
        : "Project Cost Codes";

  return (
    <>
      <PageHeader
        title={title}
        description={`Manage ${title.toLowerCase()} for ${project.name}.`}
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Projects", to: "/projects" },
          { label: project.code, to: `/projects/${project.id}` },
          { label: title },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "users" ? (
              <UserAssignmentFields
                users={users}
                selectedUserId={selectedUserId}
                setSelectedUserId={setSelectedUserId}
                assignmentType={assignmentType}
                setAssignmentType={setAssignmentType}
              />
            ) : mode === "departments" ? (
              <DepartmentAssignmentFields
                departments={departments}
                selectedDepartmentId={selectedDepartmentId}
                setSelectedDepartmentId={setSelectedDepartmentId}
                departmentType={departmentType}
                setDepartmentType={setDepartmentType}
              />
            ) : (
              <CostCodeFields
                commonCostCodes={commonCostCodes}
                commonCostCodeId={commonCostCodeId}
                setCommonCostCodeId={setCommonCostCodeId}
                costCode={costCode}
                setCostCode={setCostCode}
                costCodeName={costCodeName}
                setCostCodeName={setCostCodeName}
                expenseType={expenseType}
                setExpenseType={setExpenseType}
                codeType={codeType}
                setCodeType={setCodeType}
                customers={customers}
                customerIds={customerIds}
                setCustomerIds={setCustomerIds}
                expenseCategoryIds={expenseCategoryIds}
                setExpenseCategoryIds={setExpenseCategoryIds}
                expenseCategories={expenseCategories}
                budget={budget}
                setBudget={setBudget}
                departments={departments}
                selectedDepartmentId={selectedDepartmentId}
                setSelectedDepartmentId={setSelectedDepartmentId}
                description={description}
                setDescription={setDescription}
              />
            )}
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => void submit()}>
              Add
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Current Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mode === "users" &&
              userRows.map((row) => (
                <Record
                  key={row.id}
                  title={row.userName}
                  subtitle={`${row.employeeCode} · ${row.departmentName ?? "No department"}`}
                  badge={row.assignmentType}
                />
              ))}
            {mode === "departments" &&
              departmentRows.map((row) => (
                <Record
                  key={row.id}
                  title={row.departmentName}
                  subtitle={`Started ${row.startDate}`}
                  badge={row.assignmentType}
                />
              ))}
            {mode === "cost-codes" &&
              costCodes.map((row) => (
                <Record
                  key={row.id}
                  title={`${row.code} · ${row.name}`}
                  subtitle={`${row.expenseType} · ${
                    row.expenseCategoryIds.length
                      ? `${row.expenseCategoryIds.length} mapped claim categories`
                      : "All claim categories"
                  } · ${
                    row.customerIds.length
                      ? `${row.customerIds.length} linked customers`
                      : "All project customers"
                  } · ${row.responsibleDepartmentName ?? "No department"} · ₹${row.budgetAllocated.toLocaleString("en-IN")}`}
                  badge={row.status}
                />
              ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function UserAssignmentFields({
  users,
  selectedUserId,
  setSelectedUserId,
  assignmentType,
  setAssignmentType,
}: {
  users: AppUser[];
  selectedUserId: string;
  setSelectedUserId: (value: string) => void;
  assignmentType: "primary" | "secondary" | "temporary";
  setAssignmentType: (value: "primary" | "secondary" | "temporary") => void;
}) {
  return (
    <>
      <FormField label="User">
        <select
          className={selectClass}
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.target.value)}
        >
          <option value="">Select user</option>
          {users.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.fullName} ({candidate.employeeCode ?? candidate.employeeId})
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Assignment Type">
        <select
          className={selectClass}
          value={assignmentType}
          onChange={(event) =>
            setAssignmentType(event.target.value as "primary" | "secondary" | "temporary")
          }
        >
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="temporary">Temporary</option>
        </select>
      </FormField>
    </>
  );
}

function DepartmentAssignmentFields({
  departments,
  selectedDepartmentId,
  setSelectedDepartmentId,
  departmentType,
  setDepartmentType,
}: {
  departments: Department[];
  selectedDepartmentId: string;
  setSelectedDepartmentId: (value: string) => void;
  departmentType: "primary" | "support";
  setDepartmentType: (value: "primary" | "support") => void;
}) {
  return (
    <>
      <FormField label="Department">
        <select
          className={selectClass}
          value={selectedDepartmentId}
          onChange={(event) => setSelectedDepartmentId(event.target.value)}
        >
          <option value="">Select department</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.departmentName}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Assignment Type">
        <select
          className={selectClass}
          value={departmentType}
          onChange={(event) => setDepartmentType(event.target.value as "primary" | "support")}
        >
          <option value="primary">Primary</option>
          <option value="support">Support</option>
        </select>
      </FormField>
    </>
  );
}

function CostCodeFields({
  commonCostCodes,
  commonCostCodeId,
  setCommonCostCodeId,
  costCode,
  setCostCode,
  costCodeName,
  setCostCodeName,
  expenseType,
  setExpenseType,
  codeType,
  setCodeType,
  customers,
  customerIds,
  setCustomerIds,
  expenseCategoryIds,
  setExpenseCategoryIds,
  expenseCategories,
  budget,
  setBudget,
  departments,
  selectedDepartmentId,
  setSelectedDepartmentId,
  description,
  setDescription,
}: {
  commonCostCodes: CommonCostCode[];
  commonCostCodeId: string;
  setCommonCostCodeId: (value: string) => void;
  costCode: string;
  setCostCode: (value: string) => void;
  costCodeName: string;
  setCostCodeName: (value: string) => void;
  expenseType: ProjectExpenseType;
  setExpenseType: (value: ProjectExpenseType) => void;
  codeType: "unique" | "common";
  setCodeType: (value: "unique" | "common") => void;
  customers: Customer[];
  customerIds: string[];
  setCustomerIds: (values: string[]) => void;
  expenseCategoryIds: string[];
  setExpenseCategoryIds: (values: string[]) => void;
  expenseCategories: ExpenseCategory[];
  budget: number;
  setBudget: (value: number) => void;
  departments: Department[];
  selectedDepartmentId: string;
  setSelectedDepartmentId: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
}) {
  function selectCommonCode(value: string) {
    setCommonCostCodeId(value);
    const commonCode = commonCostCodes.find((item) => item.id === value);
    if (!commonCode) {
      return;
    }
    setCostCode(commonCode.code);
    setCostCodeName(commonCode.name);
    setExpenseType(commonCode.expenseType);
    setCodeType("common");
    setCustomerIds(commonCode.customerIds);
    setExpenseCategoryIds(commonCode.expenseCategoryIds);
    setDescription(commonCode.description ?? "");
  }

  return (
    <>
      <FormField label="Link common cost code">
        <select
          className={selectClass}
          value={commonCostCodeId}
          onChange={(event) => selectCommonCode(event.target.value)}
        >
          <option value="">No common code / project-specific only</option>
          {commonCostCodes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} - {item.name}
            </option>
          ))}
        </select>
      </FormField>
      <Input label="Cost Code" value={costCode} onChange={(event) => setCostCode(event.target.value)} />
      <FormField label="Cost Code Type">
        <select
          className={selectClass}
          value={codeType}
          onChange={(event) => setCodeType(event.target.value as "unique" | "common")}
        >
          <option value="unique">Unique - project/customer specific</option>
          <option value="common">Common - linked to multiple customers</option>
        </select>
      </FormField>
      <Input
        label="Cost Code Name"
        value={costCodeName}
        onChange={(event) => setCostCodeName(event.target.value)}
      />
      <FormField label="Expense Type">
        <select
          className={selectClass}
          value={expenseType}
          onChange={(event) => setExpenseType(event.target.value as ProjectExpenseType)}
        >
          {[
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
          ].map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </FormField>
      <MultiSelect
        label={codeType === "common" ? "Common customers" : "Linked customers"}
        help={
          codeType === "common"
            ? "Select customers that can use this common cost code in claim submission."
            : "Optional for unique codes. Leave empty if it is valid only for the project customer."
        }
        options={customers.map((customer) => ({
          value: customer.id,
          label: `${customer.customerName} (${customer.customerCode})`,
        }))}
        values={customerIds}
        onChange={setCustomerIds}
      />
      <MultiSelect
        label="Allowed claim categories"
        help="Leave empty to allow every claim category for this cost code."
        options={expenseCategories.map((category) => ({
          value: category.id,
          label: category.name,
        }))}
        values={expenseCategoryIds}
        onChange={setExpenseCategoryIds}
      />
      <Input
        label="Budget Allocated"
        type="number"
        value={budget}
        onChange={(event) => setBudget(Number(event.target.value))}
      />
      <FormField label="Responsible Department">
        <select
          className={selectClass}
          value={selectedDepartmentId}
          onChange={(event) => setSelectedDepartmentId(event.target.value)}
        >
          <option value="">Select department</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.departmentName}
            </option>
          ))}
        </select>
      </FormField>
      <Textarea
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
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

function Record({ title, subtitle, badge }: { title: string; subtitle: string; badge: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-border p-4">
      <div>
        <p className="font-bold text-text-primary">{title}</p>
        <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
      </div>
      <Badge tone="info">{badge}</Badge>
    </div>
  );
}
