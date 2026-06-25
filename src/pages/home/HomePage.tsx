import { ArrowRight, Clock3, ReceiptText, UserRoundCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { ModuleGrid } from "@/components/shared/ModuleGrid";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/Button";
import { getVisibleModules } from "@/constants/modules";
import { ROLE_LABELS } from "@/constants/roles";
import { useAuth } from "@/hooks/useAuth";
import { dashboardService } from "@/services/dashboardService";
import type { DashboardSummary } from "@/types/dashboard";

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    if (!user) {
      setSummary(null);
      return;
    }
    void dashboardService.getSummary(user).then(setSummary);
  }, [user]);

  if (!user) {
    return null;
  }

  const modules = getVisibleModules(user.role);
  const statIcons = [
    <UserRoundCheck key="user" className="h-5 w-5" />,
    <ReceiptText key="claims" className="h-5 w-5" />,
    <Clock3 key="clock" className="h-5 w-5" />,
  ];

  return (
    <>
      <PageHeader
        title="Home"
        description={`${ROLE_LABELS[user.role]} workspace for ${user.fullName}.`}
        breadcrumbs={[{ label: "Home" }]}
        action={
          <Button
            type="button"
            variant="primary"
            rightIcon={<ArrowRight className="h-4 w-4" />}
            onClick={() => navigate("/dashboard")}
          >
            Open Dashboard
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {(summary?.metrics ?? []).slice(0, 3).map((metric, index) => (
          <StatCard key={metric.label} metric={metric} icon={statIcons[index]} />
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Modules</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Role-based launcher for site, office and finance workflows.
          </p>
        </div>
        <Link to="/dashboard" className="hidden text-sm font-semibold sm:inline-flex">
          View dashboard
        </Link>
      </div>
      <ModuleGrid modules={modules} pendingCounts={summary?.pendingCounts ?? {}} />
    </>
  );
}
