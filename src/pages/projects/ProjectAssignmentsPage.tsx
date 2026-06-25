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
import { projectService } from "@/services/projectService";
import { userHierarchyService } from "@/services/userHierarchyService";
import type { AppUser } from "@/types/auth";
import type { Department } from "@/types/organization";
import type {
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
  const [userRows, setUserRows] = useState<ProjectUserAssignment[]>([]);
  const [departmentRows, setDepartmentRows] = useState<ProjectDepartmentAssignment[]>([]);
  const [costCodes, setCostCodes] = useState<ProjectCostCode[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [assignmentType, setAssignmentType] = useState<"primary" | "secondary" | "temporary">("secondary");
  const [departmentType, setDepartmentType] = useState<"primary" | "support">("support");
  const [costCode, setCostCode] = useState("");
  const [costCodeName, setCostCodeName] = useState("");
  const [expenseType, setExpenseType] = useState<ProjectExpenseType>("Other");
  const [budget, setBudget] = useState(0);
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    if (!user?.organizationId || !projectId) {
      return;
    }
    const [projectRow, userList, departmentList] = await Promise.all([
      projectService.getProjectById(projectId),
      userHierarchyService.listUsers(user.organizationId),
      departmentService.getDepartments(user.organizationId),
    ]);
    setProject(projectRow);
    setUsers(userList.filter((candidate) => candidate.status === "active"));
    setDepartments(departmentList.filter((department) => department.status === "active"));
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
    const currentProject = project;
    const currentProjectId = projectId;
    const actor = user;
    try {
      if (mode === "users") {
        if (!selectedUserId) throw new Error("Select a user.");
        const selected = users.find((candidate) => candidate.id === selectedUserId);
        await projectService.assignUser({
          organizationId: currentProject.organizationId,
          userId: selectedUserId,
          projectId: currentProjectId,
          departmentId: selected?.departmentId,
          assignmentType,
          startDate: new Date().toISOString().slice(0, 10),
          status: "active",
        }, actor);
      } else if (mode === "departments") {
        if (!selectedDepartmentId) throw new Error("Select a department.");
        await projectService.assignDepartment({
          organizationId: currentProject.organizationId,
          departmentId: selectedDepartmentId,
          projectId: currentProjectId,
          assignmentType: departmentType,
          startDate: new Date().toISOString().slice(0, 10),
          status: "active",
        }, actor);
      } else {
        await projectService.saveCostCode({
          organizationId: currentProject.organizationId,
          projectId: currentProjectId,
          code: costCode,
          name: costCodeName,
          expenseType,
          description,
          budgetAllocated: budget,
          responsibleDepartmentId: selectedDepartmentId || undefined,
          status: "active",
        }, actor);
        setCostCode("");
        setCostCodeName("");
      }
      toast.success("Project master updated.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update project.");
    }
  }

  const title =
    mode === "users" ? "Project Users" : mode === "departments" ? "Project Departments" : "Project Cost Codes";

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
          <CardHeader><CardTitle>Add Assignment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {mode === "users" ? (
              <>
                <FormField label="User"><select className={selectClass} value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">Select user</option>{users.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.fullName} ({candidate.employeeCode ?? candidate.employeeId})</option>)}</select></FormField>
                <FormField label="Assignment Type"><select className={selectClass} value={assignmentType} onChange={(event) => setAssignmentType(event.target.value as typeof assignmentType)}><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="temporary">Temporary</option></select></FormField>
              </>
            ) : mode === "departments" ? (
              <>
                <FormField label="Department"><select className={selectClass} value={selectedDepartmentId} onChange={(event) => setSelectedDepartmentId(event.target.value)}><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.departmentName}</option>)}</select></FormField>
                <FormField label="Assignment Type"><select className={selectClass} value={departmentType} onChange={(event) => setDepartmentType(event.target.value as typeof departmentType)}><option value="primary">Primary</option><option value="support">Support</option></select></FormField>
              </>
            ) : (
              <>
                <Input label="Cost Code" value={costCode} onChange={(event) => setCostCode(event.target.value)} />
                <Input label="Cost Code Name" value={costCodeName} onChange={(event) => setCostCodeName(event.target.value)} />
                <FormField label="Expense Type"><select className={selectClass} value={expenseType} onChange={(event) => setExpenseType(event.target.value as ProjectExpenseType)}>{["Labour","Machinery","Fuel","Material","Travel","Food","Accommodation","Miscellaneous","Vendor Bill","Other"].map((type) => <option key={type}>{type}</option>)}</select></FormField>
                <Input label="Budget Allocated" type="number" value={budget} onChange={(event) => setBudget(Number(event.target.value))} />
                <FormField label="Responsible Department"><select className={selectClass} value={selectedDepartmentId} onChange={(event) => setSelectedDepartmentId(event.target.value)}><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.departmentName}</option>)}</select></FormField>
                <Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
              </>
            )}
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => void submit()}>Add</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Current Records</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {mode === "users" && userRows.map((row) => <Record key={row.id} title={row.userName} subtitle={`${row.employeeCode} · ${row.departmentName ?? "No department"}`} badge={row.assignmentType} />)}
            {mode === "departments" && departmentRows.map((row) => <Record key={row.id} title={row.departmentName} subtitle={`Started ${row.startDate}`} badge={row.assignmentType} />)}
            {mode === "cost-codes" && costCodes.map((row) => <Record key={row.id} title={`${row.code} · ${row.name}`} subtitle={`${row.expenseType} · ${row.responsibleDepartmentName ?? "No department"} · ₹${row.budgetAllocated.toLocaleString("en-IN")}`} badge={row.status} />)}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Record({ title, subtitle, badge }: { title: string; subtitle: string; badge: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-border p-4"><div><p className="font-bold text-text-primary">{title}</p><p className="mt-1 text-sm text-text-secondary">{subtitle}</p></div><Badge tone="info">{badge}</Badge></div>;
}
