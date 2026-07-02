import { zodResolver } from "@hookform/resolvers/zod";
import { FilePlus2, Plus, Save, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { ClaimItemsTable } from "@/components/claims/ClaimItemsTable";
import { ClaimAttachmentsList } from "@/components/claims/ClaimAttachmentsList";
import { FileUpload } from "@/components/shared/FileUpload";
import { PageHeader } from "@/components/layout/PageHeader";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { claimsService } from "@/services/claimsService";
import { expenseCategoryService } from "@/services/expenseCategoryService";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import { projectAccessService } from "@/services/projectAccessService";
import { projectService } from "@/services/projectService";
import type { StorageBucket, StoredFile } from "@/services/storageService";
import type { ClaimAttachment, ClaimInput, ClaimItem, ExpenseCategory } from "@/types/claims";
import type { Customer, ProjectCostCode } from "@/types/projects";
import { formatCurrency } from "@/utils/format";

const claimDetailsSchema = z
  .object({
    title: z.string().trim().min(4, "Claim title is required."),
    projectId: z.string().trim().min(1, "Project is required."),
    workType: z.string().trim().min(1, "Work type is required."),
    customerId: z.string().optional(),
    periodFrom: z.string().trim().min(1, "Start date is required."),
    periodTo: z.string().trim().min(1, "End date is required."),
    remarks: z.string().optional(),
  })
  .refine((values) => values.periodTo >= values.periodFrom, {
    message: "End date must be on or after start date.",
    path: ["periodTo"],
  })
  .refine((values) => values.periodFrom <= new Date().toISOString().slice(0, 10), {
    message: "Future claim periods are not allowed.",
    path: ["periodFrom"],
  })
  .refine((values) => values.periodTo <= new Date().toISOString().slice(0, 10), {
    message: "Future claim periods are not allowed.",
    path: ["periodTo"],
  });

type ClaimDetailsFormValues = z.infer<typeof claimDetailsSchema>;

interface ItemDraft {
  categoryId: string;
  costCodeId: string;
  description: string;
  billType: "with_bill" | "without_bill";
  amount: string;
  expenseDate: string;
  attachmentName: string;
  remarks: string;
}

const emptyItemDraft: ItemDraft = {
  categoryId: "",
  costCodeId: "",
  description: "",
  billType: "with_bill",
  amount: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  attachmentName: "",
  remarks: "",
};

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

const steps = ["Details", "Items", "Documents", "Review"];

export function SubmitClaimPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sourceClaimId = searchParams.get("fromClaim");
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [attachments, setAttachments] = useState<StoredFile[]>([]);
  const [itemDraft, setItemDraft] = useState<ItemDraft>(emptyItemDraft);
  const [submitting, setSubmitting] = useState(false);
  const [availableCostCodes, setAvailableCostCodes] = useState<ProjectCostCode[]>(
    [],
  );
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [prefilledClaimId, setPrefilledClaimId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClaimDetailsFormValues>({
    resolver: zodResolver(claimDetailsSchema),
    defaultValues: {
      title: "",
      projectId: "",
      workType: "",
      customerId: "",
      periodFrom: new Date().toISOString().slice(0, 10),
      periodTo: new Date().toISOString().slice(0, 10),
      remarks: "",
    },
  });

  const selectedProjectId = watch("projectId");
  const selectedCustomerId = watch("customerId");
  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const isCommonProject = Boolean(selectedProject?.isCommonProject);
  const filteredCostCodes = useMemo(
    () =>
      availableCostCodes.filter((costCode) => {
        if (isCommonProject && !selectedCustomerId) {
          return false;
        }
        const categoryAllowed =
          costCode.expenseCategoryIds.length === 0 ||
          !itemDraft.categoryId ||
          costCode.expenseCategoryIds.includes(itemDraft.categoryId);
        const customerAllowed =
          costCode.customerIds.length === 0 ||
          !selectedCustomerId ||
          costCode.customerIds.includes(selectedCustomerId);
        return categoryAllowed && customerAllowed;
      }),
    [availableCostCodes, isCommonProject, itemDraft.categoryId, selectedCustomerId],
  );

  useEffect(() => {
    if (!selectedProjectId && projects[0]) {
      setValue("projectId", projects[0].id);
    }
  }, [projects, selectedProjectId, setValue]);

  useEffect(() => {
    if (!user?.organizationId) {
      return;
    }
    void Promise.all([
      projectService.getCustomers(user.organizationId),
      expenseCategoryService.list(),
    ]).then(([customerRows, categoryRows]) => {
      setCustomers(customerRows.filter((customer) => customer.status === "active"));
      setExpenseCategories(categoryRows.filter((category) => category.status === "active"));
    });
  }, [user?.organizationId]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }
    if (!selectedProject.isCommonProject) {
      setValue("customerId", selectedProject.customerId ?? "");
      return;
    }
    setValue("customerId", "");
  }, [selectedProject, setValue]);

  useEffect(() => {
    if (!user || !sourceClaimId || prefilledClaimId === sourceClaimId) {
      return;
    }
    void claimsService.getClaim(sourceClaimId, user).then((claim) => {
      if (!claim) {
        toast.error("Unable to load the claim for resubmission.");
        return;
      }
      setValue("title", `${claim.title} - Resubmission`);
      setValue("projectId", claim.projectId);
      setValue("customerId", claim.customerId ?? "");
      setValue("periodFrom", claim.periodFrom);
      setValue("periodTo", claim.periodTo);
      setValue("remarks", claim.remarks ?? "");
      setItems(
        claim.items.map((item) => ({
          ...item,
          id: crypto.randomUUID(),
        })),
      );
      setAttachments(
        claim.attachments
          .filter((attachment) => attachment.bucket && attachment.path)
          .map((attachment) => ({
            bucket: attachment.bucket as StorageBucket,
            path: attachment.path!,
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            signedUrl: attachment.url,
          })),
      );
      setPrefilledClaimId(sourceClaimId);
      toast.success("Returned claim loaded. Edit details and submit again.");
    });
  }, [prefilledClaimId, sourceClaimId, setValue, user]);

  useEffect(() => {
    let active = true;
    if (!selectedProjectId) {
      setAvailableCostCodes([]);
      return;
    }
    void projectAccessService
      .getSelectableCostCodesForProject(selectedProjectId)
      .then((rows) => {
        if (active) {
          setAvailableCostCodes(rows);
          setItemDraft((current) => ({
            ...current,
            costCodeId: rows.some((row) => row.id === current.costCodeId)
              ? current.costCodeId
              : rows[0]?.id ?? "",
          }));
        }
      });
    return () => {
      active = false;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    setItemDraft((current) => ({
      ...current,
      costCodeId: filteredCostCodes.some((row) => row.id === current.costCodeId)
        ? current.costCodeId
        : filteredCostCodes[0]?.id ?? "",
    }));
  }, [filteredCostCodes]);

  if (!user) {
    return null;
  }

  function updateItemDraft<Key extends keyof ItemDraft>(
    key: Key,
    value: ItemDraft[Key],
  ) {
    setItemDraft((current) => ({ ...current, [key]: value }));
  }

  async function goNext() {
    if (step === 1) {
      const valid = await trigger();
      if (!valid) {
        return;
      }
    }

    if (step === 2 && items.length === 0) {
      toast.error("Add at least one expense item.");
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 1));
  }

  function addItem() {
    const category = expenseCategories.find(
      (item) => item.id === itemDraft.categoryId,
    );
    const costCode = filteredCostCodes.find(
      (item) => item.id === itemDraft.costCodeId,
    );
    const amount = Number(itemDraft.amount);

    if (!selectedProject || (isCommonProject && !selectedCustomerId) || !category || !costCode) {
      toast.error("Select project, customer, category and cost code.");
      return;
    }

    if (!itemDraft.description.trim() || !itemDraft.expenseDate) {
      toast.error("Enter item description and date.");
      return;
    }

    if (itemDraft.expenseDate > new Date().toISOString().slice(0, 10)) {
      toast.error("Future expense dates are not allowed.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    const billReference = itemDraft.attachmentName.trim();
    if (
      billReference &&
      items.some(
        (item) =>
          item.attachmentName?.trim().toLowerCase() ===
          billReference.toLowerCase(),
      )
    ) {
      toast.error("This bill/reference is already added in this claim.");
      return;
    }

    const nextItem: ClaimItem = {
      id: crypto.randomUUID(),
      categoryId: category.id,
      categoryName: category.name,
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      costCodeId: costCode.id,
      costCode: costCode.code,
      description: itemDraft.description.trim(),
      billType: itemDraft.billType,
      amount,
      expenseDate: itemDraft.expenseDate,
      attachmentName: billReference || undefined,
      remarks: itemDraft.remarks.trim() || undefined,
    };

    setItems((current) => [...current, nextItem]);
    setItemDraft({
      ...emptyItemDraft,
      costCodeId: filteredCostCodes[0]?.id ?? "",
      expenseDate: itemDraft.expenseDate,
    });
  }

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  function buildClaimInput(values: ClaimDetailsFormValues): ClaimInput {
    return {
      title: values.title.trim(),
      projectId: values.projectId,
      workType: values.workType,
      customerId: isCommonProject ? values.customerId : selectedProject?.customerId,
      customerName: isCommonProject ? selectedCustomer?.customerName : selectedProject?.customerName,
      periodFrom: values.periodFrom,
      periodTo: values.periodTo,
      remarks: values.remarks?.trim() || undefined,
      items,
      attachments: attachments.map((file) => ({
        id: file.path,
        fileName: file.fileName,
        fileType: file.fileType,
        fileSize: file.fileSize,
        url: file.path,
        bucket: file.bucket,
        path: file.path,
        uploadedAt: new Date().toISOString(),
      })),
    };
  }

  function uploadedClaimAttachments(): ClaimAttachment[] {
    return attachments.map((file) => ({
      id: file.path,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      url: file.signedUrl ?? file.path,
      bucket: file.bucket,
      path: file.path,
      uploadedAt: new Date().toISOString(),
    }));
  }

  function submitClaim(saveAsDraft: boolean) {
    void handleSubmit(async (values) => {
      if (!user) {
        return;
      }

      if (items.length === 0) {
        toast.error("Add at least one expense item.");
        setStep(2);
        return;
      }

      const withBillMissingProof = !saveAsDraft && items.some(
        (item) =>
          item.billType === "with_bill" &&
          attachments.length === 0 &&
          !item.attachmentName?.trim(),
      );
      if (withBillMissingProof) {
        toast.error(
          "Upload at least one bill attachment or enter a bill reference for with-bill items.",
        );
        setStep(3);
        return;
      }

      setSubmitting(true);
      try {
        const input = buildClaimInput(values);
        const claim = saveAsDraft
          ? await claimsService.saveDraft(input, user)
          : await claimsService.submitClaim(input, user);
        toast.success(saveAsDraft ? "Draft saved." : "Claim submitted.");
        navigate(`/claims/${claim.id}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save claim.");
      } finally {
        setSubmitting(false);
      }
    })();
  }

  const totalClaimed = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <PageHeader
        title="Submit Claim"
        description="Create a claim with details, itemized expenses, supporting documents and review."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Claims", to: "/claims" },
          { label: "Submit" },
        ]}
      />

      <div className="mb-6 grid gap-2 sm:grid-cols-4">
        {steps.map((label, index) => {
          const active = step === index + 1;
          const complete = step > index + 1;
          return (
            <div
              key={label}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                active
                  ? "border-brand-blue bg-brand-light text-brand-blue"
                  : complete
                    ? "border-green-200 bg-green-50 text-brand-success"
                    : "border-surface-border bg-white text-text-secondary"
              }`}
            >
              {index + 1}. {label}
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{steps[step - 1]}</CardTitle>
          <CardDescription>
            Total claimed value: {formatCurrency(totalClaimed)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 1 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Claim title"
                error={errors.title?.message}
                {...register("title")}
              />
              <FormField label="Project / Site" error={errors.projectId?.message}>
                <select className={selectClass} {...register("projectId")}>
                  <option value="">Select assigned project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Work Type" error={errors.workType?.message}>
                <select className={selectClass} {...register("workType")}>
                  <option value="">Select work type</option>
                  {selectedProject?.workManagerMappings.map((mapping) => (
                    <option key={mapping.workType} value={mapping.workType}>{mapping.workType}</option>
                  ))}
                </select>
                {selectedProject && selectedProject.workManagerMappings.length === 0 ? <p className="mt-1 text-xs text-text-secondary">No work mappings configured. Add them in Project Master.</p> : null}
              </FormField>
              <Input
                label="Customer"
                value={isCommonProject ? "Select customer below" : selectedProject?.customerName ?? "No customer linked to this project"}
                readOnly
              />
              {isCommonProject ? (
                <FormField label="Customer" error={errors.customerId?.message}>
                  <select className={selectClass} {...register("customerId")}>
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.customerName}
                      </option>
                    ))}
                  </select>
                </FormField>
              ) : null}
              <Input
                label="Period from"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                error={errors.periodFrom?.message}
                {...register("periodFrom")}
              />
              <Input
                label="Period to"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                error={errors.periodTo?.message}
                {...register("periodTo")}
              />
              <div className="md:col-span-2">
                <Textarea
                  label="Remarks"
                  error={errors.remarks?.message}
                  {...register("remarks")}
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <FormField label="Category">
                  <select
                    className={selectClass}
                    value={itemDraft.categoryId}
                    onChange={(event) =>
                      updateItemDraft("categoryId", event.target.value)
                    }
                  >
                    <option value="">Select category</option>
                    {expenseCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Cost code">
                  <select
                    className={selectClass}
                    value={itemDraft.costCodeId}
                    onChange={(event) =>
                      updateItemDraft("costCodeId", event.target.value)
                    }
                  >
                    <option value="">Select cost code</option>
                    {filteredCostCodes.map((costCode) => (
                      <option key={costCode.id} value={costCode.id}>
                        {costCode.code} - {costCode.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <Input
                  label="Expense date"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={itemDraft.expenseDate}
                  onChange={(event) =>
                    updateItemDraft("expenseDate", event.target.value)
                  }
                />
                <FormField label="Bill type">
                  <select
                    className={selectClass}
                    value={itemDraft.billType}
                    onChange={(event) =>
                      updateItemDraft(
                        "billType",
                        event.target.value as ItemDraft["billType"],
                      )
                    }
                  >
                    <option value="with_bill">With bill</option>
                    <option value="without_bill">Without bill</option>
                  </select>
                </FormField>
                <Input
                  label="Amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={itemDraft.amount}
                  onChange={(event) => updateItemDraft("amount", event.target.value)}
                />
                <Input
                  label="Bill no. / reference"
                  placeholder="Invoice number, bill number or reference"
                  value={itemDraft.attachmentName}
                  onChange={(event) =>
                    updateItemDraft("attachmentName", event.target.value)
                  }
                />
                <div className="lg:col-span-2">
                  <Textarea
                    label="Description"
                    value={itemDraft.description}
                    onChange={(event) =>
                      updateItemDraft("description", event.target.value)
                    }
                  />
                </div>
                <Textarea
                  label="Item remarks"
                  value={itemDraft.remarks}
                  onChange={(event) => updateItemDraft("remarks", event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={addItem}
              >
                Add Item
              </Button>
              {items.length > 0 ? (
                <div className="space-y-3">
                  <ClaimItemsTable items={items} />
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                      <Button
                        key={item.id}
                        type="button"
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 className="h-4 w-4" />}
                        onClick={() => removeItem(item.id)}
                      >
                        Remove {item.categoryName}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-semibold">Upload bills / supporting documents</p>
                <p className="mt-1">
                  Attach documents for the expense items listed below. If one file
                  covers multiple expenses, upload it once and mention the bill
                  number in the item attachment/reference field.
                </p>
              </div>
              <ClaimItemsTable items={items} />
              <FileUpload
                bucket="claim-attachments"
                folder="claims"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                value={attachments}
                onChange={setAttachments}
              />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-surface-border bg-slate-50 p-4">
                <h3 className="text-base font-bold text-text-primary">
                  Review Claim
                </h3>
                <p className="mt-2 text-sm text-text-secondary">
                  {watch("title")} · {selectedProject?.name} ·{" "}
                  {watch("periodFrom")} to {watch("periodTo")}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  Customer: {(isCommonProject ? selectedCustomer?.customerName : selectedProject?.customerName) ?? "-"}
                </p>
                {watch("remarks") ? (
                  <p className="mt-2 text-sm text-text-primary">{watch("remarks")}</p>
                ) : null}
              </div>
              <ClaimItemsTable items={items} />
              <div className="rounded-lg border border-surface-border bg-white p-4">
                <p className="text-sm font-bold text-text-primary">
                  Attachments: {attachments.length}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  Total claim value {formatCurrency(totalClaimed)}
                </p>
                <div className="mt-3">
                  <ClaimAttachmentsList
                    attachments={uploadedClaimAttachments()}
                    emptyLabel="No documents uploaded. With-bill items need an uploaded bill or an item-level reference."
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col-reverse justify-between gap-3 border-t border-surface-border pt-5 sm:flex-row">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={goBack}
                disabled={step === 1 || submitting}
              >
                Back
              </Button>
              {step < steps.length ? (
                <Button type="button" onClick={() => void goNext()}>
                  Next
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                leftIcon={<Save className="h-4 w-4" />}
                isLoading={submitting}
                onClick={() => submitClaim(true)}
              >
                Save Draft
              </Button>
              <Button
                type="button"
                leftIcon={
                  step === steps.length ? (
                    <Send className="h-4 w-4" />
                  ) : (
                    <FilePlus2 className="h-4 w-4" />
                  )
                }
                isLoading={submitting}
                onClick={() => {
                  if (step < steps.length) {
                    void goNext();
                    return;
                  }
                  submitClaim(false);
                }}
              >
                {step === steps.length ? "Submit Claim" : "Continue"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
