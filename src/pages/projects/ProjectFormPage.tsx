import { Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useAuth } from "@/hooks/useAuth";
import { departmentService } from "@/services/departmentService";
import { projectService } from "@/services/projectService";
import { userHierarchyService } from "@/services/userHierarchyService";
import type { AppUser } from "@/types/auth";
import type { Department } from "@/types/organization";
import type { Customer, ProjectInput } from "@/types/projects";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function emptyProject(organizationId: string): ProjectInput {
  return {
    organizationId,
    code: "",
    name: "",
    geofenceRadius: 250,
    projectBudget: 0,
    status: "active",
  };
}

export function ProjectFormPage() {
  const { user } = useAuth();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<ProjectInput | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<AppUser[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.organizationId) {
      return;
    }
    const [departmentRows, userRows, customerRows, project] = await Promise.all([
      departmentService.getDepartments(user.organizationId),
      userHierarchyService.listUsers(user.organizationId),
      projectService.getCustomers(user.organizationId),
      projectId ? projectService.getProjectById(projectId) : Promise.resolve(null),
    ]);
    setDepartments(departmentRows);
    setManagers(
      userRows.filter(
        (candidate) =>
          candidate.status === "active" &&
          ["manager", "hod", "super_admin"].includes(candidate.role),
      ),
    );
    setCustomers(customerRows);
    setForm(
      project
        ? {
            organizationId: project.organizationId,
            code: project.code,
            name: project.name,
            customerId: project.customerId,
            customerName: project.customerName,
            location: project.location,
            address: project.address,
            city: project.city,
            state: project.state,
            pincode: project.pincode,
            latitude: project.latitude,
            longitude: project.longitude,
            geofenceRadius: project.geofenceRadius,
            startDate: project.startDate,
            endDate: project.endDate,
            projectBudget: project.projectBudget,
            projectManagerId: project.projectManagerId,
            primaryDepartmentId: project.primaryDepartmentId,
            description: project.description,
            status: project.status,
          }
        : emptyProject(user.organizationId),
    );
  }, [projectId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user || !form) {
    return null;
  }

  function update<Key extends keyof ProjectInput>(
    key: Key,
    value: ProjectInput[Key],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!form || !user) {
      return;
    }
    const input = form;
    const actor = user;
    setSaving(true);
    try {
      const project = projectId
        ? await projectService.updateProject(projectId, input, actor)
        : await projectService.createProject(input, actor);
      toast.success(projectId ? "Project updated." : "Project created.");
      navigate(`/projects/${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={projectId ? "Edit Project" : "Add Project"}
        description="Maintain project identity, site location, ownership, dates, budget and hierarchy links."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Projects", to: "/projects" },
          { label: projectId ? "Edit" : "New" },
        ]}
      />
      <Card>
        <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
          <Input label="Project Code" value={form.code} onChange={(event) => update("code", event.target.value)} />
          <Input label="Project Name" value={form.name} onChange={(event) => update("name", event.target.value)} />
          <FormField label="Customer">
            <select
              className={selectClass}
              value={form.customerId ?? ""}
              onChange={(event) => {
                const customer = customers.find((item) => item.id === event.target.value);
                update("customerId", event.target.value || undefined);
                update("customerName", customer?.customerName);
              }}
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.customerName}</option>
              ))}
            </select>
          </FormField>
          <Input label="Location" value={form.location ?? ""} onChange={(event) => update("location", event.target.value)} />
          <Input label="Address" value={form.address ?? ""} onChange={(event) => update("address", event.target.value)} />
          <Input label="City" value={form.city ?? ""} onChange={(event) => update("city", event.target.value)} />
          <Input label="State" value={form.state ?? ""} onChange={(event) => update("state", event.target.value)} />
          <Input label="Pincode" value={form.pincode ?? ""} onChange={(event) => update("pincode", event.target.value)} />
          <Input label="Latitude" type="number" value={form.latitude ?? ""} onChange={(event) => update("latitude", event.target.value ? Number(event.target.value) : undefined)} />
          <Input label="Longitude" type="number" value={form.longitude ?? ""} onChange={(event) => update("longitude", event.target.value ? Number(event.target.value) : undefined)} />
          <Input label="Geofence Radius (m)" type="number" value={form.geofenceRadius} onChange={(event) => update("geofenceRadius", Number(event.target.value))} />
          <Input label="Start Date" type="date" value={form.startDate ?? ""} onChange={(event) => update("startDate", event.target.value)} />
          <Input label="End Date" type="date" value={form.endDate ?? ""} onChange={(event) => update("endDate", event.target.value || undefined)} />
          <Input label="Project Budget" type="number" value={form.projectBudget} onChange={(event) => update("projectBudget", Number(event.target.value))} />
          <FormField label="Project Manager">
            <select className={selectClass} value={form.projectManagerId ?? ""} onChange={(event) => update("projectManagerId", event.target.value || undefined)}>
              <option value="">Assign later</option>
              {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.fullName}</option>)}
            </select>
          </FormField>
          <FormField label="Primary Department">
            <select className={selectClass} value={form.primaryDepartmentId ?? ""} onChange={(event) => update("primaryDepartmentId", event.target.value || undefined)}>
              <option value="">Assign later</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.departmentName}</option>)}
            </select>
          </FormField>
          <FormField label="Status">
            <select className={selectClass} value={form.status} onChange={(event) => update("status", event.target.value as ProjectInput["status"])}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>
          <div className="md:col-span-2">
            <Textarea label="Description" value={form.description ?? ""} onChange={(event) => update("description", event.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button leftIcon={<Save className="h-4 w-4" />} isLoading={saving} onClick={() => void save()}>
              Save Project
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
