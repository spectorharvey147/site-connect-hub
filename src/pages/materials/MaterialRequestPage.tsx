import { FilePlus2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { MaterialRequestTable } from "@/components/materials/MaterialRequestTable";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  MATERIAL_MASTER,
  MATERIAL_PRIORITIES,
  MATERIAL_PRIORITY_LABELS,
} from "@/constants/materials";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import {
  calculateRequestEstimatedCost,
  materialsService,
} from "@/services/materialsService";
import type {
  MaterialPriority,
  MaterialRequest,
  MaterialRequestInput,
  MaterialRequestItem,
  MaterialRequestStatus,
} from "@/types/materials";
import { formatCurrency } from "@/utils/format";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function initialForm(projectId = ""): MaterialRequestInput {
  return {
    projectId,
    requestDate: today(),
    requiredDate: today(),
    priority: "medium",
    items: [materialsService.createRequestItem()],
    attachments: [],
  };
}

export function MaterialRequestPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [form, setForm] = useState<MaterialRequestInput>(initialForm);
  const [attachmentText, setAttachmentText] = useState("");
  const [saving, setSaving] = useState<MaterialRequestStatus | null>(null);
  const estimate = calculateRequestEstimatedCost({ items: form.items });

  useEffect(() => {
    if (!user) {
      return;
    }
    void materialsService.listRequests(user).then(setRequests);
  }, [user]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      projectId: projects.some((project) => project.id === current.projectId)
        ? current.projectId
        : projects[0]?.id ?? "",
    }));
  }, [projects]);

  if (!user) {
    return null;
  }

  function update<Key extends keyof MaterialRequestInput>(
    key: Key,
    value: MaterialRequestInput[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateItem(
    itemId: string,
    updater: (item: MaterialRequestItem) => MaterialRequestItem,
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? updater(item) : item)),
    }));
  }

  function selectMaterial(itemId: string, materialId: string) {
    const material = MATERIAL_MASTER.find((item) => item.id === materialId);
    if (!material) {
      return;
    }
    updateItem(itemId, (item) => ({
      ...item,
      materialId: material.id,
      materialName: material.name,
      uom: material.uom,
    }));
  }

  async function save(status: Extract<MaterialRequestStatus, "draft" | "submitted">) {
    if (!user) {
      return;
    }
    setSaving(status);
    try {
      const attachments = attachmentText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const request = await materialsService.saveRequest(
        { ...form, attachments },
        user,
        status,
      );
      setRequests((current) => [request, ...current]);
      setForm(initialForm(projects[0]?.id));
      setAttachmentText("");
      toast.success(
        status === "submitted"
          ? "Material request submitted."
          : "Material request draft saved.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save material request.",
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Material Request"
        description="Raise project material requirements with priority, required date, item specifications and budget estimate."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Materials", to: "/materials" },
          { label: "Request" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Request Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Project / Site">
                <select
                  className={selectClass}
                  value={form.projectId}
                  onChange={(event) => update("projectId", event.target.value)}
                >
                  <option value="">Select assigned project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <Input
                label="Request Date"
                type="date"
                value={form.requestDate}
                onChange={(event) => update("requestDate", event.target.value)}
              />
              <Input
                label="Required Date"
                type="date"
                value={form.requiredDate}
                onChange={(event) => update("requiredDate", event.target.value)}
              />
              <FormField label="Priority">
                <select
                  className={selectClass}
                  value={form.priority}
                  onChange={(event) =>
                    update("priority", event.target.value as MaterialPriority)
                  }
                >
                  {MATERIAL_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {MATERIAL_PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-text-primary">
                  Material Items
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() =>
                    update("items", [
                      ...form.items,
                      materialsService.createRequestItem(),
                    ])
                  }
                >
                  Add Item
                </Button>
              </div>
              {form.items.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-4 rounded-lg border border-surface-border p-4 md:grid-cols-3"
                >
                  <FormField label={`Material ${index + 1}`}>
                    <select
                      className={selectClass}
                      value={item.materialId}
                      onChange={(event) =>
                        selectMaterial(item.id, event.target.value)
                      }
                    >
                      {MATERIAL_MASTER.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <Input
                    label="Quantity"
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(item.id, (current) => ({
                        ...current,
                        quantity: Number(event.target.value),
                      }))
                    }
                  />
                  <Input label="UOM" value={item.uom} readOnly />
                  <Input
                    label="Specification"
                    value={item.specification}
                    onChange={(event) =>
                      updateItem(item.id, (current) => ({
                        ...current,
                        specification: event.target.value,
                      }))
                    }
                  />
                  <Input
                    label="Estimated Cost"
                    type="number"
                    min={0}
                    value={item.estimatedCost}
                    onChange={(event) =>
                      updateItem(item.id, (current) => ({
                        ...current,
                        estimatedCost: Number(event.target.value),
                      }))
                    }
                  />
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      leftIcon={<Trash2 className="h-4 w-4" />}
                      onClick={() =>
                        update(
                          "items",
                          form.items.filter((current) => current.id !== item.id),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="md:col-span-3">
                    <Input
                      label="Remarks"
                      value={item.remarks}
                      onChange={(event) =>
                        updateItem(item.id, (current) => ({
                          ...current,
                          remarks: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <Textarea
              label="Attachments"
              hint="Enter file names separated by commas."
              value={attachmentText}
              onChange={(event) => setAttachmentText(event.target.value)}
            />
            <Input label="Approver" value="Project Manager" readOnly />
            <Input label="Estimated Total" value={formatCurrency(estimate)} readOnly />

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                leftIcon={<Save className="h-4 w-4" />}
                isLoading={saving === "draft"}
                onClick={() => void save("draft")}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                leftIcon={<FilePlus2 className="h-4 w-4" />}
                isLoading={saving === "submitted"}
                onClick={() => void save("submitted")}
              >
                Submit Request
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request Register</CardTitle>
          </CardHeader>
          <CardContent>
            <MaterialRequestTable requests={requests} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
