import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ErrorState } from "@/components/shared/ErrorState";
import { useAuth } from "@/hooks/useAuth";
import { workTypeService } from "@/services/workTypeService";
import type { WorkType, WorkTypeInput } from "@/types/workTypes";

const empty = (organizationId: string): WorkTypeInput => ({ organizationId, code: "", name: "", description: "", status: "active" });

export function WorkTypesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<WorkType[]>([]);
  const [form, setForm] = useState<WorkTypeInput | null>(null);
  const [editingId, setEditingId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const load=useCallback(async()=>{const organizationId=user?.organizationId;if(!organizationId)return;setForm(current=>current??empty(organizationId));setLoadError("");try{setRows(await workTypeService.list(organizationId));}catch(error){setLoadError(error instanceof Error?error.message:"Unable to load work types.")}},[user?.organizationId]);
  useEffect(() => { void load(); }, [load]);
  if (!user || !form) return null;
  const update = <K extends keyof WorkTypeInput>(key: K, value: WorkTypeInput[K]) => setForm((current) => current ? { ...current, [key]: value } : current);
  async function save() { if (!form || !user) return; const input = form; const actor = user; setSaving(true); try { await workTypeService.save(input, actor, editingId); toast.success(editingId ? "Work type updated." : "Work type added."); setEditingId(undefined); setForm(empty(input.organizationId)); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save work type."); } finally { setSaving(false); } }
  async function remove(id: string) { if (!user || !window.confirm("Delete this work type? Existing project mappings should be updated separately.")) return; const actor = user; try { await workTypeService.remove(id, actor); toast.success("Work type deleted."); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete work type."); } }
  return <>
    <PageHeader title="Work Types" description="Maintain the work types used for project manager routing and claim submission." breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Settings", to: "/settings" }, { label: "Work Types" }]} />
    {loadError ? <div className="mb-5"><ErrorState message={loadError} /></div> : null}
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <Card><CardHeader><CardTitle>{editingId ? "Edit Work Type" : "Add Work Type"}</CardTitle></CardHeader><CardContent className="space-y-4">
        <Input label="Code" value={form.code} onChange={(e) => update("code", e.target.value)} />
        <Input label="Work Type Name" placeholder="Construction" value={form.name} onChange={(e) => update("name", e.target.value)} />
        <Input label="Description" value={form.description ?? ""} onChange={(e) => update("description", e.target.value)} />
        <div className="flex gap-2"><Button leftIcon={<Plus className="h-4 w-4" />} isLoading={saving} onClick={() => void save()}>{editingId ? "Update" : "Add"} Work Type</Button>{editingId ? <Button variant="secondary" onClick={() => { setEditingId(undefined); setForm(empty(form.organizationId)); }}>Cancel</Button> : null}</div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Work Type List</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="min-w-full divide-y divide-surface-border text-sm"><thead className="bg-slate-50 text-left"><tr><th className="px-4 py-3">Code</th><th className="px-4 py-3">Work Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-surface-border">{rows.map((row) => <tr key={row.id}><td className="px-4 py-3 font-semibold">{row.code}</td><td className="px-4 py-3"><p className="font-semibold">{row.name}</p><p className="text-xs text-text-secondary">{row.description}</p></td><td className="px-4 py-3"><Badge tone={row.status === "active" ? "success" : "neutral"}>{row.status}</Badge></td><td className="flex gap-1 px-4 py-3"><Button size="icon" variant="ghost" title="Edit" onClick={() => { setEditingId(row.id); setForm({ organizationId: row.organizationId, code: row.code, name: row.name, description: row.description, status: row.status }); }}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title="Delete" onClick={() => void remove(row.id)}><Trash2 className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div></CardContent></Card>
    </div>
  </>;
}
