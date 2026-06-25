import { Tags } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { projectService } from "@/services/projectService";
import type { ProjectMaster } from "@/types/projects";

export function ProjectCostCodesPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectMaster[]>([]);

  useEffect(() => {
    if (user) {
      void projectService.getProjects(user.organizationId).then(setProjects);
    }
  }, [user]);

  return (
    <>
      <PageHeader
        title="Project Cost Codes"
        description="Open a project to create and maintain budget-linked expense cost codes."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Settings", to: "/settings" },
          { label: "Project Cost Codes" },
        ]}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-text-primary">{project.name}</p>
                  <p className="text-sm text-text-secondary">{project.code}</p>
                </div>
                <Tags className="h-5 w-5 text-brand-blue" />
              </div>
              <p className="text-sm text-text-secondary">
                {project.costCodeCount} configured cost codes
              </p>
              <Link to={`/projects/${project.id}/cost-codes`}>
                <Button className="w-full" variant="secondary">
                  Manage Cost Codes
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
