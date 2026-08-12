import { AlertTriangle, CheckCircle2, Gauge, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { MachineLogTable } from "@/components/machinery/MachineLogTable";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MACHINE_TYPE_LABELS, MACHINE_TYPE_OPTIONS } from "@/constants/machinery";
import { useAuth } from "@/hooks/useAuth";
import {
  calculateMachineLogSummary,
  machineryService,
} from "@/services/machineryService";
import type {
  MachineLog,
  MachineryContract,
  MachinerySummary,
  MachineType,
  MachineryUsageBill,
} from "@/types/machinery";
import { formatCurrency } from "@/utils/format";

export function MachineryReportsPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<MachinerySummary | null>(null);
  const [logs, setLogs] = useState<MachineLog[]>([]);
  const [contracts, setContracts] = useState<MachineryContract[]>([]);
  const [bills, setBills] = useState<MachineryUsageBill[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void machineryService.getDashboard(user).then((dashboard) => {
      setSummary(dashboard.summary);
      setLogs(dashboard.recentLogs);
      setContracts(dashboard.activeContracts);
      setBills(dashboard.bills);
    });
  }, [user]);

  const hoursByType = useMemo(() => {
    const totals = MACHINE_TYPE_OPTIONS.reduce(
      (result, type) => ({ ...result, [type]: 0 }),
      {} as Record<MachineType, number>,
    );
    logs.forEach((log) => {
      totals[log.machineType] += calculateMachineLogSummary(log).billableHours;
    });
    return Object.entries(totals)
      .map(([type, value]) => ({
        type: type as MachineType,
        value,
      }))
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value);
  }, [logs]);

  const maxHours = Math.max(...hoursByType.map((item) => item.value), 1);

  if (!user || !summary) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Machinery Reports"
        description="Review utilization hours, pending approvals, breakdowns and active contract coverage."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Machinery", to: "/machinery" },
          { label: "Reports" },
        ]}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          metric={{
            label: "Active machines",
            value: String(summary.activeMachines),
            tone: "info",
          }}
          icon={<Truck className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Approved / pending",
            value: `${logs.filter((log) => log.status === "approved").length} / ${
              summary.pendingApproval
            }`,
            tone: summary.pendingApproval > 0 ? "warning" : "success",
          }}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Total hours",
            value: summary.utilizationHours.toFixed(1),
            tone: "success",
          }}
          icon={<Gauge className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Breakdowns",
            value: String(summary.breakdownCount),
            tone: summary.breakdownCount > 0 ? "danger" : "success",
          }}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Hours by Machine Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hoursByType.length === 0 ? (
              <p className="text-sm text-text-secondary">
                No utilization data available.
              </p>
            ) : (
              hoursByType.map((item) => (
                <div key={item.type}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-text-primary">
                      {MACHINE_TYPE_LABELS[item.type]}
                    </span>
                    <span className="text-text-secondary">
                      {item.value.toFixed(1)} hrs
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-brand-blue"
                      style={{ width: `${Math.max((item.value / maxHours) * 100, 8)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Breakdown Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <MachineLogTable
              logs={logs.filter((log) => log.breakdown.isBreakdown)}
              emptyTitle="No breakdown logs"
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Active Contract Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {contracts.map((contract) => (
              <div
                key={contract.id}
                className="rounded-lg border border-surface-border p-4 text-sm"
              >
                <p className="font-bold text-brand-blue">
                  {contract.contractNumber}
                </p>
                <p className="mt-1 font-semibold text-text-primary">
                  {contract.vendorName}
                </p>
                <p className="mt-1 text-text-secondary">
                  {MACHINE_TYPE_LABELS[contract.machineType]} -{" "}
                  {contract.machineNumbers.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Approved Machinery Bill Sources</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-surface-border text-sm">
            <thead className="bg-slate-50"><tr>
              <th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Machine</th>
              <th className="px-4 py-3 text-left">Vendor</th><th className="px-4 py-3 text-right">Hours</th>
              <th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">Breakdown deduction</th>
              <th className="px-4 py-3 text-right">Net</th>
            </tr></thead>
            <tbody className="divide-y divide-surface-border">{bills.map((bill) => <tr key={bill.id}>
              <td className="px-4 py-3">{bill.periodFrom}</td><td className="px-4 py-3 font-semibold">{bill.machineNumber}</td>
              <td className="px-4 py-3">{bill.vendorName}</td><td className="px-4 py-3 text-right">{bill.usageHours.toFixed(1)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(bill.baseAmount)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(bill.breakdownDeduction)}</td>
              <td className="px-4 py-3 text-right font-bold">{formatCurrency(bill.netAmount)}</td>
            </tr>)}</tbody>
          </table></div>
        </CardContent>
      </Card>
    </>
  );
}
