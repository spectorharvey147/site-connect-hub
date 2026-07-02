import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { sapExportService } from "@/services/sapExportService";
import type { SapMapping } from "@/types/sap";

const blank = {
  expenseCategoryId: "", projectCostCodeId: "", customerId: "", departmentId: "",
  glCode: "", costCenter: "", profitCenter: "", companyCode: "IPI",
  postingGroup: "other" as "separate" | "other", active: true,
};

export function SapMappingPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<SapMapping[]>([]);
  const [form, setForm] = useState(blank);
  const [options,setOptions]=useState<{expenseCategories:{id:string;label:string}[];costCodes:{id:string;label:string}[];customers:{id:string;label:string}[];departments:{id:string;label:string}[]}>({expenseCategories:[],costCodes:[],customers:[],departments:[]});
  const load = useCallback(async () => setRows(await sapExportService.listMappings()), []);
  useEffect(() => {void Promise.all([load(),sapExportService.listMappingOptions().then(setOptions)]).catch((error) => toast.error(error.message));}, [load]);
  if (!user) return null;
  const actor=user;

  async function save() {
    try {
      if (!form.glCode.trim()) throw new Error("SAP GL code is required");
      await sapExportService.saveMapping(form, actor);
      setForm(blank); await load(); toast.success("SAP mapping saved");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save mapping"); }
  }

  const inputs = [
    ["SAP GL Code", "glCode"],
    ["SAP Cost Center", "costCenter"], ["SAP Profit Center", "profitCenter"], ["Company Code", "companyCode"],
  ] as const;
  return <>
    <PageHeader title="SAP Mapping" description="Separate selected expense categories; combine every remaining category into Other Expenses." breadcrumbs={[{label:"Settings",to:"/settings"},{label:"SAP Mapping"}]} />
    <Card className="mb-6"><CardHeader><CardTitle>Add Mapping</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">
      {([['Expense Category','expenseCategoryId',options.expenseCategories],['Project Cost Code','projectCostCodeId',options.costCodes],['Customer','customerId',options.customers],['Department','departmentId',options.departments]] as const).map(([label,key,values])=><label key={key} className="text-sm font-semibold">{label}<select className="mt-1 h-11 w-full rounded-md border border-surface-border bg-white px-3" value={form[key]} onChange={event=>setForm(current=>({...current,[key]:event.target.value}))}><option value="">Any / default</option>{values.map(option=><option value={option.id} key={option.id}>{option.label}</option>)}</select></label>)}
      {inputs.map(([label,key]) => <Input key={key} label={label} value={form[key]} onChange={(event) => setForm((current) => ({...current,[key]:event.target.value}))} />)}
      <label className="text-sm font-semibold">SAP grouping<select className="mt-1 h-11 w-full rounded-md border border-surface-border bg-white px-3" value={form.postingGroup} onChange={(event) => setForm((current) => ({...current,postingGroup:event.target.value as "separate"|"other"}))}><option value="separate">Separate category line</option><option value="other">Combine into Other Expenses</option></select></label>
      <div className="flex items-end"><Button onClick={() => void save()}>Save Mapping</Button></div>
    </CardContent></Card>
    <Card><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["Expense Category","Grouping","Cost Code","Customer","Department","GL","Cost Center","Profit Center","Company","Active"].map((heading) => <th className="p-3 text-left" key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.map((row) => <tr className="border-t" key={row.id}><td>{row.expenseCategoryId??"Any"}</td><td>{row.postingGroup==="separate"?"Separate":"Other Expenses"}</td><td>{row.projectCostCodeId??"Any"}</td><td>{row.customerId??"Any"}</td><td>{row.departmentId??"Any"}</td><td>{row.glCode}</td><td>{row.costCenter??"-"}</td><td>{row.profitCenter??"-"}</td><td>{row.companyCode}</td><td>{row.active?"Yes":"No"}</td></tr>)}</tbody></table></div></CardContent></Card>
  </>;
}
