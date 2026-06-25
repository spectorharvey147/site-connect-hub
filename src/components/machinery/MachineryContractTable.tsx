import { Badge } from "@/components/ui/Badge";
import {
  BILLING_CYCLE_LABELS,
  MACHINE_STATUS_LABELS,
  MACHINE_STATUS_TONES,
  MACHINE_TYPE_LABELS,
} from "@/constants/machinery";
import type { MachineryContract } from "@/types/machinery";
import { formatCurrency } from "@/utils/format";

export function MachineryContractTable({
  contracts,
  emptyTitle = "No machinery contracts found",
}: {
  contracts: MachineryContract[];
  emptyTitle?: string;
}) {
  if (contracts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-surface-border p-6 text-center text-sm text-text-secondary">
        {emptyTitle}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-surface-border text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-normal text-text-secondary">
          <tr>
            <th className="px-4 py-3 font-semibold">Contract</th>
            <th className="px-4 py-3 font-semibold">Vendor</th>
            <th className="px-4 py-3 font-semibold">Machine</th>
            <th className="px-4 py-3 font-semibold">Period</th>
            <th className="px-4 py-3 font-semibold">Rate</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border bg-white">
          {contracts.map((contract) => (
            <tr key={contract.id}>
              <td className="px-4 py-3">
                <p className="font-bold text-brand-blue">
                  {contract.contractNumber}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {BILLING_CYCLE_LABELS[contract.billingCycle]}
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-text-primary">
                  {contract.vendorName}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  OT {formatCurrency(contract.overtimeRatePerHour)} / hr
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-text-primary">
                  {MACHINE_TYPE_LABELS[contract.machineType]}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {contract.machineNumbers.join(", ")}
                </p>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {contract.periodFrom} to {contract.periodTo}
              </td>
              <td className="px-4 py-3 font-semibold text-text-primary">
                {formatCurrency(contract.rate)}
              </td>
              <td className="px-4 py-3">
                <Badge tone={MACHINE_STATUS_TONES[contract.status]}>
                  {MACHINE_STATUS_LABELS[contract.status]}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
