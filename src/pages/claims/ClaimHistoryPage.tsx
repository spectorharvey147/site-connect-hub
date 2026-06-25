import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ClaimsTable } from "@/components/claims/ClaimsTable";
import { Input } from "@/components/ui/Input";
import { claimsService } from "@/services/claimsService";
import { CLAIM_STATUS_LABELS } from "@/constants/claims";
import { useAuth } from "@/hooks/useAuth";
import { useSelectableProjects } from "@/hooks/useSelectableProjects";
import type { Claim, ClaimStatus } from "@/types/claims";

const selectClass =
  "h-11 rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

export function ClaimHistoryPage() {
  const { user } = useAuth();
  const { projects } = useSelectableProjects(user);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ClaimStatus | "all">("all");
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    void claimsService
      .listClaims(user, {
        search,
        status,
        projectId: projectId || undefined,
      })
      .then(setClaims);
  }, [projectId, search, status, user]);

  return (
    <>
      <PageHeader
        title="Claim History"
        description="Search and review claim progress, approval history and payment status."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Claims", to: "/claims" },
          { label: "History" },
        ]}
      />

      <div className="mb-4 grid gap-3 rounded-lg border border-surface-border bg-white p-4 shadow-card md:grid-cols-[1fr_220px_220px]">
        <Input
          placeholder="Search claim number, title, employee or status"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
        <select
          className={selectClass}
          value={status}
          onChange={(event) => setStatus(event.target.value as ClaimStatus | "all")}
        >
          <option value="all">All statuses</option>
          {Object.entries(CLAIM_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <ClaimsTable claims={claims} />
    </>
  );
}
