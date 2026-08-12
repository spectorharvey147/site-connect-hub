import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import { vendorContractService } from "@/services/vendorContractService";
import { vendorsService } from "@/services/vendorsService";
import type { Department } from "@/types/organization";
import type { ProjectCostCode, ProjectMaster } from "@/types/projects";
import type { Vendor } from "@/types/vendors";
import type { VendorContractInput, VendorContractType } from "@/types/vendorContracts";

const selectClass = "h-11 w-full rounded-md border border-surface-border bg-surface-card px-3 text-sm text-text-primary";
const today = new Date().toISOString().slice(0, 10);
const oneYearFromToday = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
const initial: VendorContractInput = {
  contractType: "labour", contractCode: "", contractTitle: "", vendorId: "", projectId: "",
  startDate: today, endDate: oneYearFromToday, status: "active", paymentTerms: "30 days",
  gstApplicable: true, tdsApplicable: true, remarks: "", maleLabourRate: 0,
  labourContractMode: "contractor_labour", standardStartTime: "09:00",
  standardEndTime: "18:00", standardHours: 8, overtimeAfterHours: 8,
  weeklyOffRule: "weekly_off_sunday", defaultPayeeType: "vendor",
  defaultInchargeName: "", defaultInchargePhone: "", defaultInchargePaymentMode: "",
  femaleLabourRate: 0, supervisorRate: 0, skilledLabourRate: 0,
  unskilledLabourRate: 0, overtimeRate: 0, foodAllowance: 0,
  transportAllowance: 0, billingType: "daily", rate: 0, minimumHours: 8,
  workingDaysPerMonth: 26, sundayIncluded: false, driverBetaAmount: 0,
  fuelScope: "excluded", driverCost: "included", driverFoodIncluded: false,
  idleDeductionRule: "", machineRegistrationNumber: "", machineCapacity: "",
  machineOwnership: "rented", machineRemarks: "", contractMachineNumbers: "",
  fuelType: "diesel", fuelRateType: "fixed", fixedFuelRatePerUnit: 0,
  fuelUnit: "L", fuelCreditLimit: 0, fuelAdvanceRequired: false,
  rateUnit: "unit", materialSpecification: "", minimumOrderQuantity: 0,
  scopeOfWork: "", serviceFrequency: "monthly",
};

export function VendorContractFormPage() {
  const { user } = useAuth();
  const { contractId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<ProjectMaster[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [costCodes, setCostCodes] = useState<ProjectCostCode[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!user) return;
    void Promise.all([
      vendorsService.listVendors(user),
      projectService.getProjects(user.organizationId),
      departmentService.getDepartments(user.organizationId),
      contractId ? vendorContractService.get(contractId, user) : Promise.resolve(null),
    ]).then(([vendorRows, projectRows, departmentRows, contract]) => {
      setVendors(vendorRows); setProjects(projectRows); setDepartments(departmentRows);
      const requestedType = searchParams.get("type") as VendorContractType | null;
      setForm(contract ? { ...contract } : { ...initial, contractType: requestedType && ["labour", "machinery", "fuel", "material", "service"].includes(requestedType) ? requestedType : initial.contractType, vendorId: vendorRows[0]?.id ?? "", projectId: projectRows[0]?.id ?? "", departmentId: departmentRows[0]?.id });
    });
  }, [contractId, searchParams, user]);
  useEffect(() => {
    if (!form.projectId) { setCostCodes([]); return; }
    void projectService.getProjectCostCodes(form.projectId).then((rows) => {
      const active = rows.filter((row) => row.status === "active");
      setCostCodes(active);
      if (!active.some((row) => row.id === form.costCodeId)) {
        setForm((current) => ({ ...current, costCodeId: active[0]?.id ?? "" }));
      }
    });
  }, [form.costCodeId, form.projectId]);
  if (!user) return null;
  const update = <K extends keyof VendorContractInput>(key: K, value: VendorContractInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    if (!user) return;
    const actor = user;
    setSaving(true);
    try {
      const contract = await vendorContractService.save(form, actor, contractId);
      toast.success("Vendor contract saved.");
      navigate(`/vendors/contracts/${contract.id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save contract."); }
    finally { setSaving(false); }
  }
  const labour = form.contractType === "labour";
  const machinery = form.contractType === "machinery";
  const fuel = form.contractType === "fuel";
  const material = form.contractType === "material";
  const service = form.contractType === "service";
  return <>
    <PageHeader title={contractId ? "Edit Vendor Contract" : "New Vendor Contract"} description="Define commercial terms used by site operations and vendor billing." breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Vendors", to: "/vendors" }, { label: "Contracts", to: "/vendors/contracts" }, { label: contractId ? "Edit" : "New" }]} />
    <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-3">
      <Select label="Contract type" value={form.contractType} onChange={(value) => update("contractType", value as VendorContractType)} options={[["labour", "Labour Contract"], ["machinery", "Machinery Rental Contract"], ["fuel", "Fuel Supply Contract"], ["material", "Material Supply Contract"], ["service", "General Service Contract"]]} />
      <Input label="Contract code" value={form.contractCode} onChange={(event) => update("contractCode", event.target.value)} />
      <Input label="Contract title" value={form.contractTitle ?? ""} onChange={(event) => update("contractTitle", event.target.value)} />
      <Select label="Vendor" value={form.vendorId} onChange={(value) => update("vendorId", value)} options={vendors.map((item) => [item.id, item.name])} />
      <Select label="Project / Site" value={form.projectId} onChange={(value) => update("projectId", value)} options={projects.map((item) => [item.id, item.name])} />
      <Select label="Department" value={form.departmentId ?? ""} onChange={(value) => update("departmentId", value)} options={departments.map((item) => [item.id, item.departmentName])} />
      <Select label="Cost code" value={form.costCodeId ?? ""} onChange={(value) => update("costCodeId", value)} options={costCodes.map((item) => [item.id, `${item.code} - ${item.name}`])} />
      <Input label="Start date" type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} />
      <Input label="End date" type="date" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} />
      <Input label="Payment terms" value={form.paymentTerms} onChange={(event) => update("paymentTerms", event.target.value)} />
      <Select label="Status" value={form.status} onChange={(value) => update("status", value as VendorContractInput["status"])} options={[["draft", "Draft"], ["active", "Active"], ["expired", "Expired"], ["inactive", "Inactive"]]} />
      {labour ? <>
        <Select label="Labour contract mode" value={form.labourContractMode ?? "contractor_labour"} onChange={(value) => update("labourContractMode", value as VendorContractInput["labourContractMode"])} options={[["contractor_labour", "Contractor labour"], ["fixed_individual_labour", "Fixed individual labour"], ["local_labour_incharge", "Local labour incharge"], ["direct_individual_payment", "Direct individual payment"]]} />
        <Input label="Standard start time" type="time" value={form.standardStartTime ?? ""} onChange={(event) => update("standardStartTime", event.target.value)} />
        <Input label="Standard end time" type="time" value={form.standardEndTime ?? ""} onChange={(event) => update("standardEndTime", event.target.value)} />
        <Money label="Standard hours" value={form.standardHours} onChange={(value) => update("standardHours", value)} />
        <Money label="OT after hours" value={form.overtimeAfterHours} onChange={(value) => update("overtimeAfterHours", value)} />
        <Input label="Weekly off rule" value={form.weeklyOffRule ?? ""} onChange={(event) => update("weeklyOffRule", event.target.value)} />
        <Select label="Default payee type" value={form.defaultPayeeType ?? "vendor"} onChange={(value) => update("defaultPayeeType", value as VendorContractInput["defaultPayeeType"])} options={[["vendor", "Vendor"], ["incharge", "Incharge"], ["individual", "Individual"]]} />
        <Input label="Default incharge name" value={form.defaultInchargeName ?? ""} onChange={(event) => update("defaultInchargeName", event.target.value)} />
        <Input label="Default incharge phone" value={form.defaultInchargePhone ?? ""} onChange={(event) => update("defaultInchargePhone", event.target.value)} />
        <Input label="Incharge payment mode" value={form.defaultInchargePaymentMode ?? ""} onChange={(event) => update("defaultInchargePaymentMode", event.target.value)} />
        <Input label="Labour category" value={form.labourCategory ?? ""} onChange={(event) => update("labourCategory", event.target.value)} />
        <Money label="Male rate / day" value={form.maleLabourRate} onChange={(value) => update("maleLabourRate", value)} />
        <Money label="Female rate / day" value={form.femaleLabourRate} onChange={(value) => update("femaleLabourRate", value)} />
        <Money label="Supervisor rate / day" value={form.supervisorRate} onChange={(value) => update("supervisorRate", value)} />
        <Money label="Skilled rate / day" value={form.skilledLabourRate} onChange={(value) => update("skilledLabourRate", value)} />
        <Money label="Unskilled rate / day" value={form.unskilledLabourRate} onChange={(value) => update("unskilledLabourRate", value)} />
        <Money label="OT rate" value={form.overtimeRate} onChange={(value) => update("overtimeRate", value)} />
        <Money label="Food allowance" value={form.foodAllowance} onChange={(value) => update("foodAllowance", value)} />
        <Money label="Transport allowance" value={form.transportAllowance} onChange={(value) => update("transportAllowance", value)} />
      </> : null}
      {machinery ? <>
        <Input label="Machine type" value={form.machineType ?? ""} onChange={(event) => update("machineType", event.target.value)} />
        <Input label="Machine / Registration number" value={form.machineNumber ?? ""} onChange={(event) => update("machineNumber", event.target.value)} />
        <Input label="Additional machine numbers" value={form.contractMachineNumbers ?? ""} onChange={(event) => update("contractMachineNumbers", event.target.value)} />
        <Input label="Registration number" value={form.machineRegistrationNumber ?? ""} onChange={(event) => update("machineRegistrationNumber", event.target.value)} />
        <Input label="Capacity" value={form.machineCapacity ?? ""} onChange={(event) => update("machineCapacity", event.target.value)} />
        <Select label="Machine ownership" value={form.machineOwnership ?? "rented"} onChange={(value) => update("machineOwnership", value as VendorContractInput["machineOwnership"])} options={[["company", "Company"], ["rented", "Rented"], ["hired", "Hired"]]} />
        <Select label="Billing type" value={form.billingType ?? "daily"} onChange={(value) => update("billingType", value as VendorContractInput["billingType"])} options={[["monthly", "Monthly"], ["weekly", "Weekly"], ["daily", "Daily"], ["hourly", "Hourly"], ["per_trip", "Per Trip"]]} />
        <Money label="Rate" value={form.rate} onChange={(value) => update("rate", value)} />
        <Money label="Minimum hours" value={form.minimumHours} onChange={(value) => update("minimumHours", value)} />
        <Money label="Working days/month" value={form.workingDaysPerMonth} onChange={(value) => update("workingDaysPerMonth", value)} />
        <Money label="OT rate" value={form.overtimeRate} onChange={(value) => update("overtimeRate", value)} />
        <Money label="Driver beta amount" value={form.driverBetaAmount} onChange={(value) => update("driverBetaAmount", value)} />
        <Select label="Fuel scope" value={form.fuelScope ?? "excluded"} onChange={(value) => update("fuelScope", value as VendorContractInput["fuelScope"])} options={[["included", "Included"], ["excluded", "Excluded"], ["partial", "Partial"]]} />
        <Select label="Driver cost" value={form.driverCost ?? "included"} onChange={(value) => update("driverCost", value as VendorContractInput["driverCost"])} options={[["included", "Included"], ["excluded", "Excluded"], ["additional", "Additional"]]} />
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(form.driverFoodIncluded)} onChange={(event) => update("driverFoodIncluded", event.target.checked)} /> Driver food included</label>
        <Input label="Breakdown terms" value={form.breakdownTerms ?? ""} onChange={(event) => update("breakdownTerms", event.target.value)} />
        <Input label="Idle deduction rule" value={form.idleDeductionRule ?? ""} onChange={(event) => update("idleDeductionRule", event.target.value)} />
        <Input label="Machine remarks" value={form.machineRemarks ?? ""} onChange={(event) => update("machineRemarks", event.target.value)} />
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(form.sundayIncluded)} onChange={(event) => update("sundayIncluded", event.target.checked)} /> Sunday included</label>
      </> : null}
      {fuel ? <>
        <Input label="Fuel type" value={form.fuelType ?? ""} onChange={(event) => update("fuelType", event.target.value)} />
        <Select label="Rate type" value={form.fuelRateType ?? "fixed"} onChange={(value) => update("fuelRateType", value as VendorContractInput["fuelRateType"])} options={[["fixed", "Fixed"], ["market", "Market"], ["slip_based", "Slip based"]]} />
        <Money label="Fixed rate / unit" value={form.fixedFuelRatePerUnit} onChange={(value) => update("fixedFuelRatePerUnit", value)} />
        <Input label="Unit" value={form.fuelUnit ?? "L"} onChange={(event) => update("fuelUnit", event.target.value)} />
        <Money label="Credit limit" value={form.fuelCreditLimit} onChange={(value) => update("fuelCreditLimit", value)} />
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(form.fuelAdvanceRequired)} onChange={(event) => update("fuelAdvanceRequired", event.target.checked)} /> Advance required</label>
      </> : null}
      {material ? <>
        <Input label="Material specification" value={form.materialSpecification ?? ""} onChange={(event) => update("materialSpecification", event.target.value)} />
        <Money label="Contract rate" value={form.rate} onChange={(value) => update("rate", value)} />
        <Input label="Rate unit" value={form.rateUnit ?? "unit"} onChange={(event) => update("rateUnit", event.target.value)} />
        <Money label="Minimum order quantity" value={form.minimumOrderQuantity} onChange={(value) => update("minimumOrderQuantity", value)} />
      </> : null}
      {service ? <>
        <Input label="Scope of work" value={form.scopeOfWork ?? ""} onChange={(event) => update("scopeOfWork", event.target.value)} />
        <Input label="Service frequency" value={form.serviceFrequency ?? "monthly"} onChange={(event) => update("serviceFrequency", event.target.value)} />
        <Money label="Contract rate" value={form.rate} onChange={(value) => update("rate", value)} />
        <Input label="Rate unit" value={form.rateUnit ?? "month"} onChange={(event) => update("rateUnit", event.target.value)} />
      </> : null}
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.gstApplicable} onChange={(event) => update("gstApplicable", event.target.checked)} /> GST applicable</label>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.tdsApplicable} onChange={(event) => update("tdsApplicable", event.target.checked)} /> TDS applicable</label>
      <Textarea className="xl:col-span-3" label="Remarks" value={form.remarks} onChange={(event) => update("remarks", event.target.value)} />
      <div className="xl:col-span-3 flex justify-end"><Button type="button" leftIcon={<Save className="h-4 w-4" />} isLoading={saving} onClick={() => void save()}>Save Contract</Button></div>
    </CardContent></Card>
  </>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <FormField label={label}><select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></FormField>;
}
function Money({ label, value = 0, onChange }: { label: string; value?: number; onChange: (value: number) => void }) {
  return <Input label={label} type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} />;
}
