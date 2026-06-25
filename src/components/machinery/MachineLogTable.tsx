import { Wrench } from "lucide-react";

import { MachineLogStatusBadge } from "@/components/machinery/MachineLogStatusBadge";
import { Badge } from "@/components/ui/Badge";
import {
  MACHINE_OWNERSHIP_LABELS,
  MACHINE_TYPE_LABELS,
} from "@/constants/machinery";
import { calculateMachineLogSummary } from "@/services/machineryService";
import type { MachineLog } from "@/types/machinery";

export function MachineLogTable({
  logs,
  emptyTitle = "No machine logs found",
}: {
  logs: MachineLog[];
  emptyTitle?: string;
}) {
  if (logs.length === 0) {
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
            <th className="px-4 py-3 font-semibold">Log</th>
            <th className="px-4 py-3 font-semibold">Machine</th>
            <th className="px-4 py-3 font-semibold">Project</th>
            <th className="px-4 py-3 font-semibold">Hours</th>
            <th className="px-4 py-3 font-semibold">Breakdown</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border bg-white">
          {logs.map((log) => {
            const summary = calculateMachineLogSummary(log);
            return (
              <tr key={log.id}>
                <td className="px-4 py-3">
                  <p className="font-bold text-brand-blue">{log.logNumber}</p>
                  <p className="mt-1 text-xs text-text-secondary">{log.date}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-text-primary">
                    {log.machineNumber}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {MACHINE_TYPE_LABELS[log.machineType]} -{" "}
                    {MACHINE_OWNERSHIP_LABELS[log.ownership]}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {log.vendorName ?? "Company fleet"}
                  </p>
                </td>
                <td className="px-4 py-3 text-text-secondary">{log.projectName}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-text-primary">
                    {summary.billableHours.toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Meter {summary.meterHours.toFixed(2)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {log.breakdown.isBreakdown ? (
                    <Badge tone="danger">
                      <Wrench className="mr-1 h-3.5 w-3.5" />
                      {log.breakdown.durationHours}h
                    </Badge>
                  ) : (
                    <Badge tone="success">No</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <MachineLogStatusBadge status={log.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
