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
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import { machineryService } from "@/services/machineryService";
import type {
  MachineLog,
  MachineryContract,
  MachinerySummary,
} from "@/types/machinery";

export function MachineryLandingPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [projectId, setProjectId] = useState("");
  const [summary, setSummary] = useState<MachinerySummary | null>(null);
  const [recentLogs, setRecentLogs] = useState<MachineLog[]>([]);
  const [activeContracts, setActiveContracts] = useState<MachineryContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }
    setLoading(true);
    setLoadError("");
    void machineryService.getDashboard(user, projectId || undefined).then((dashboard) => {
      setSummary(dashboard.summary);
      setRecentLogs(dashboard.recentLogs);
      setActiveContracts(dashboard.activeContracts);
    }).catch((error) => {
      setLoadError(error instanceof Error ? error.message : "Unable to load machinery.");
    }).finally(() => setLoading(false));
  }, [projectId, user]);

  if (!user) {
    return null;
  }

  if (loading) return <LoadingState label="Loading machinery" />;
  if (loadError) return <ErrorState message={loadError} />;
  if (!summary) return <ErrorState message="Unable to load machinery." />;

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
      <div className="mb-5 max-w-md"><label className="text-sm font-semibold">Project view<select className="mt-1 h-11 w-full rounded-md border border-surface-border bg-white px-3" value={projectId} onChange={(e)=>setProjectId(e.target.value)}><option value="">All assigned projects</option>{projects.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>

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
