import { CheckCircle2, Eye, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { CLAIM_STATUS_LABELS, CLAIM_STATUS_TONES } from "@/constants/claims";
import { useAuth } from "@/hooks/useAuth";
import { claimAccountsService } from "@/services/claimAccountsService";
import type { AccountsVerificationInput, Claim, ClaimAccountsVerification, PaymentPriority } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

type QueueRow = { claim: Claim; verification?: ClaimAccountsVerification };
const initialInput: AccountsVerificationInput = { claimId: "", payableAmount: 0, paymentPriority: "normal", requiresSapExport: false, accountsRemarks: "", confirmed: false };

export function ClaimAccountsVerificationPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [selected, setSelected] = useState<Claim | null>(null);
  const [input, setInput] = useState(initialInput);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try { setRows(await claimAccountsService.list(user)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load Accounts verification."); }
  }, [user]);
  useEffect(() => void load(), [load]);

  const deduction = useMemo(() => selected ? Math.max(selected.totalApproved - input.payableAmount, 0) : 0, [selected, input.payableAmount]);
  if (!user) return null;
  const actor = user;

  function openVerify(claim: Claim) {
    setSelected(claim);
    setInput({ ...initialInput, claimId: claim.id, payableAmount: claim.totalApproved });
  }

  async function verify() {
    if (!selected) return;
    setSaving(true);
    try {
      await claimAccountsService.verify(actor, selected, input);
      toast.success(`${selected.claimNumber} verified and moved to voucher preparation.`);
      setSelected(null); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Verification failed."); }
    finally { setSaving(false); }
  }

  async function returnClaim(claim: Claim) {
    const remarks = window.prompt(`Reason for returning ${claim.claimNumber}:`)?.trim();
    if (!remarks) return;
    try { await claimAccountsService.returnForCorrection(actor, claim, remarks); toast.success("Claim returned with Accounts remarks."); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to return claim."); }
  }

  return <>
    <PageHeader title="Claim Accounts Verification" description="Confirm the final approved amount, deductions, payment readiness, and SAP requirement before voucher generation." breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Accounts", to: "/accounts" }, { label: "Claim Verification" }]} />
    <Card><CardContent className="p-0">
      {rows.length === 0 ? <div className="p-6"><EmptyState title="No claims awaiting Accounts" description="Final-approved claims appear here before they can enter the payment queue." /></div> :
        <div className="overflow-x-auto"><table className="min-w-[1250px] w-full text-left text-sm">
          <thead className="border-b border-surface-border bg-surface-muted text-xs uppercase text-text-secondary"><tr>
            {['Claim Number','Employee','Department','Project','Claim Date','Final Approved','Deduction','Payable','Final Approver','Priority','SAP Required','Status','Action'].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}
          </tr></thead>
          <tbody>{rows.map(({ claim, verification }) => {
            const finalApprover = [...claim.approvals].reverse().find((approval) => approval.stage === "final_approval");
            return <tr key={claim.id} className="border-b border-surface-border align-top">
              <td className="px-3 py-3 font-semibold"><Link className="text-primary hover:underline" to={`/claims/${claim.id}`}>{claim.claimNumber}</Link></td>
              <td className="px-3 py-3">{claim.userName}</td><td className="px-3 py-3">{claim.departmentId ?? "—"}</td>
              <td className="px-3 py-3">{claim.projectName}</td><td className="px-3 py-3">{new Date(claim.submittedAt ?? claim.createdAt).toLocaleDateString("en-IN")}</td>
              <td className="px-3 py-3 font-medium">{formatCurrency(claim.totalApproved)}</td><td className="px-3 py-3">{formatCurrency(verification?.deductionAmount ?? 0)}</td>
              <td className="px-3 py-3">{formatCurrency(verification?.payableAmount ?? claim.totalApproved)}</td><td className="px-3 py-3">{finalApprover?.actorName ?? "—"}</td>
              <td className="px-3 py-3 capitalize">{verification?.paymentPriority ?? "normal"}</td><td className="px-3 py-3">{verification?.requiresSapExport ? "Yes" : "No"}</td>
              <td className="px-3 py-3"><Badge tone={CLAIM_STATUS_TONES[claim.status]}>{CLAIM_STATUS_LABELS[claim.status]}</Badge></td>
              <td className="px-3 py-3"><div className="flex gap-2"><Link className="inline-flex h-9 items-center justify-center rounded-md border border-brand-blue px-3 text-brand-blue" to={`/claims/${claim.id}`} aria-label="View claim"><Eye className="h-4 w-4" /></Link><Button size="sm" onClick={() => openVerify(claim)} disabled={claim.status === "voucher_pending"}><CheckCircle2 className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => void returnClaim(claim)}><RotateCcw className="h-4 w-4" /></Button></div></td>
            </tr>;
          })}</tbody>
        </table></div>}
    </CardContent></Card>

    {selected ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Verify claim for payment">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto"><CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between"><div><h2 className="text-xl font-bold">Verify {selected.claimNumber}</h2><p className="text-sm text-text-secondary">{selected.userName} · {selected.projectName}</p></div><Button variant="ghost" size="sm" onClick={() => setSelected(null)}><X className="h-5 w-5" /></Button></div>
        <div className="grid gap-4 sm:grid-cols-3"><Input label="Final approved amount" value={selected.totalApproved} disabled /><Input label="Payable amount" type="number" min={0} max={selected.totalApproved} value={input.payableAmount} onChange={(event) => setInput((current) => ({ ...current, payableAmount: Number(event.target.value) }))} /><Input label="Deduction" value={deduction} disabled /></div>
        <label className="block text-sm font-medium">Payment priority<select className="mt-1 w-full rounded-md border border-surface-border bg-surface px-3 py-2" value={input.paymentPriority} onChange={(event) => setInput((current) => ({ ...current, paymentPriority: event.target.value as PaymentPriority }))}><option value="normal">Normal</option><option value="urgent">Urgent</option><option value="hold">Hold</option></select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={input.requiresSapExport} onChange={(event) => setInput((current) => ({ ...current, requiresSapExport: event.target.checked }))} /> Requires SAP export before payment</label>
        <Textarea label="Accounts remarks" value={input.accountsRemarks} onChange={(event) => setInput((current) => ({ ...current, accountsRemarks: event.target.value }))} placeholder="Required for any deduction or hold." />
        <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={input.confirmed} onChange={(event) => setInput((current) => ({ ...current, confirmed: event.target.checked }))} /><span>I confirm the supporting bills and final approved amount were checked. Original claim quantities and descriptions remain unchanged.</span></label>
        <div className="flex justify-end gap-3"><Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button><Button disabled={saving || !input.confirmed} onClick={() => void verify()}>{saving ? "Verifying…" : "Verify for Payment"}</Button></div>
      </CardContent></Card>
    </div> : null}
  </>;
}
