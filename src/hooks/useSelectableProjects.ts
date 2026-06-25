import { useEffect, useState } from "react";

import { projectAccessService } from "@/services/projectAccessService";
import type { AppUser } from "@/types/auth";
import type { ProjectMaster } from "@/types/projects";

export function useSelectableProjects(
  user: AppUser | null,
  requestedUserId?: string,
) {
  const [projects, setProjects] = useState<ProjectMaster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void projectAccessService
      .getSelectableProjectsForUser(user, requestedUserId ?? user.id)
      .then((rows) => {
        if (active) {
          setProjects(rows);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [requestedUserId, user]);

  return { projects, loading };
}
