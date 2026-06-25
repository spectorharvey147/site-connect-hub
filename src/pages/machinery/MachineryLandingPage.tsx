import {
  AlertTriangle,
  ClipboardList,
  FilePlus2,
  Gauge,
  PenLine,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { MachineLogTable } from "@/components/machinery/MachineLogTable";
import { MachineryContractTable } from "@/components/machinery/MachineryContractTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { machineryService } from "@/services/machineryService";
import type {
  MachineLog,
  MachineryContract,
  MachinerySummary,
} from "@/types/machinery";

export function MachineryLandingPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<MachinerySummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<MachineLog[]>([]);
  const [activeContracts, setActiveContracts] = useState<MachineryContract[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void machineryService.getDashboard(user).then((dashboard) => {
      setSummary(dashboard.summary);
      setRecentLogs(dashboard.recentLogs);
      setActiveContracts(dashboard.activeContracts);
    });
  }, [user]);

  if (!user || !summary) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Machinery"
        description="Manage equipment contracts, daily usage logs, meter readings, breakdowns and utilization reports."
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Machinery" }]}
        action={
          <Link to="/machinery/logs">
            <Button type="button" leftIcon={<FilePlus2 className="h-4 w-4" />}>
              Log Usage
            </Button>
          </Link>
        }
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
            label: "Active contracts",
            value: String(summary.activeContracts),
            tone: "success",
          }}
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <StatCard
          metric={{
            label: "Utilization hours",
            value: summary.utilizationHours.toFixed(1),
            tone: "warning",
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

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <ToolLink to="/machinery/logs" title="Machine Logs" />
        <ToolLink to="/machinery/contracts" title="Contracts" />
        <ToolLink to="/machinery/reports" title="Reports" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <MachineLogTable logs={recentLogs} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <MachineryContractTable
              contracts={activeContracts.slice(0, 4)}
              emptyTitle="No active machinery contracts"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ToolLink({ to, title }: { to: string; title: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-surface-border bg-white p-4 text-sm font-bold text-text-primary shadow-card transition hover:border-brand-blue hover:bg-brand-light/40"
    >
      <PenLine className="h-4 w-4 text-brand-blue" />
      {title}
    </Link>
  );
}
