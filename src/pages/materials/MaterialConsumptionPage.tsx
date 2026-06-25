import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import { materialsService } from "@/services/materialsService";
import type { MaterialConsumptionInput, MaterialDamageWastageInput } from "@/types/materials";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function MaterialConsumptionPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const materials = materialsService.listMaterials();
  const [savingConsumption, setSavingConsumption] = useState(false);
  const [savingDamage, setSavingDamage] = useState(false);
  const [consumption, setConsumption] = useState<MaterialConsumptionInput>({
    projectId: "",
    materialId: materials[0]?.id ?? "",
    consumptionDate: today(),
    quantity: 0,
    workArea: "",
    purpose: "",
    issuedTo: "",
    remarks: "",
  });
  const [damage, setDamage] = useState<MaterialDamageWastageInput>({
    projectId: "",
    materialId: materials[0]?.id ?? "",
    transactionDate: today(),
    quantity: 0,
    reason: "",
    remarks: "",
  });

  useEffect(() => {
    if (!projects[0]) return;
    setConsumption((current) => ({ ...current, projectId: current.projectId || projects[0].id }));
    setDamage((current) => ({ ...current, projectId: current.projectId || projects[0].id }));
  }, [projects]);

  if (!user) return null;

  async function saveConsumption() {
    const actor = user;
    if (!actor) return;
    setSavingConsumption(true);
    try {
      await materialsService.saveConsumption(consumption, actor);
      toast.success("Material consumption posted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to post consumption.");
    } finally {
      setSavingConsumption(false);
    }
  }

  async function saveDamage() {
    const actor = user;
    if (!actor) return;
    setSavingDamage(true);
    try {
      await materialsService.saveDamageWastage(damage, actor);
      toast.success("Material damage/wastage posted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to post damage/wastage.");
    } finally {
      setSavingDamage(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Material Consumption"
        description="Issue materials to work areas and post damage/wastage into the stock ledger."
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Materials", to: "/materials" }, { label: "Consumption" }]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Consumption issue</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Picker label="Project" value={consumption.projectId} options={projects.map((p) => [p.id, p.name])} onChange={(value) => setConsumption((c) => ({ ...c, projectId: value }))} />
            <Picker label="Material" value={consumption.materialId} options={materials.map((m) => [m.id, `${m.name} (${m.uom})`])} onChange={(value) => setConsumption((c) => ({ ...c, materialId: value }))} />
            <Input label="Date" type="date" value={consumption.consumptionDate} onChange={(event) => setConsumption((c) => ({ ...c, consumptionDate: event.target.value }))} />
            <Input label="Quantity" type="number" min={0} value={consumption.quantity} onChange={(event) => setConsumption((c) => ({ ...c, quantity: Number(event.target.value) }))} />
            <Input label="Work area" value={consumption.workArea ?? ""} onChange={(event) => setConsumption((c) => ({ ...c, workArea: event.target.value }))} />
            <Input label="Issued to" value={consumption.issuedTo ?? ""} onChange={(event) => setConsumption((c) => ({ ...c, issuedTo: event.target.value }))} />
            <Textarea className="md:col-span-2" label="Purpose" value={consumption.purpose ?? ""} onChange={(event) => setConsumption((c) => ({ ...c, purpose: event.target.value }))} />
            <Textarea className="md:col-span-2" label="Remarks" value={consumption.remarks ?? ""} onChange={(event) => setConsumption((c) => ({ ...c, remarks: event.target.value }))} />
            <div className="md:col-span-2 flex justify-end">
              <Button type="button" leftIcon={<Save className="h-4 w-4" />} isLoading={savingConsumption} onClick={() => void saveConsumption()}>
                Post Consumption
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Damage / wastage</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Picker label="Project" value={damage.projectId} options={projects.map((p) => [p.id, p.name])} onChange={(value) => setDamage((c) => ({ ...c, projectId: value }))} />
            <Picker label="Material" value={damage.materialId} options={materials.map((m) => [m.id, `${m.name} (${m.uom})`])} onChange={(value) => setDamage((c) => ({ ...c, materialId: value }))} />
            <Input label="Date" type="date" value={damage.transactionDate} onChange={(event) => setDamage((c) => ({ ...c, transactionDate: event.target.value }))} />
            <Input label="Quantity" type="number" min={0} value={damage.quantity} onChange={(event) => setDamage((c) => ({ ...c, quantity: Number(event.target.value) }))} />
            <Textarea className="md:col-span-2" label="Reason" value={damage.reason} onChange={(event) => setDamage((c) => ({ ...c, reason: event.target.value }))} />
            <Textarea className="md:col-span-2" label="Remarks" value={damage.remarks ?? ""} onChange={(event) => setDamage((c) => ({ ...c, remarks: event.target.value }))} />
            <div className="md:col-span-2 flex justify-end">
              <Button type="button" leftIcon={<Save className="h-4 w-4" />} isLoading={savingDamage} onClick={() => void saveDamage()}>
                Post Damage / Wastage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Picker({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return (
    <FormField label={label}>
      <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </FormField>
  );
}
