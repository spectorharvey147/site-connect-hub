import { Download, Search, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/FormField";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { departmentService } from "@/services/departmentService";
import { organizationService } from "@/services/organizationService";
import { userHierarchyService } from "@/services/userHierarchyService";
import type { Department, Organization, UserHierarchyNode } from "@/types/organization";

const selectClass =
  "h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15";

function flatten(node: UserHierarchyNode): UserHierarchyNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

function nodeMatches(node: UserHierarchyNode, query: string) {
  if (!query) {
    return true;
  }
  const haystack = `${node.label} ${node.subtitle ?? ""}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function filterNode(
  node: UserHierarchyNode,
  query: string,
): UserHierarchyNode | null {
  const children = node.children
    .map((child) => filterNode(child, query))
    .filter((child): child is UserHierarchyNode => Boolean(child));
  if (nodeMatches(node, query) || children.length > 0) {
    return { ...node, children };
  }
  return null;
}

function TreeNode({ node, depth = 0 }: { node: UserHierarchyNode; depth?: number }) {
  return (
    <li>
      <div
        className="rounded-lg border border-surface-border bg-white p-3"
        style={{ marginLeft: `${Math.min(depth, 4) * 18}px` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-bold text-text-primary">{node.label}</p>
            {node.subtitle ? (
              <p className="mt-1 text-xs text-text-secondary">{node.subtitle}</p>
            ) : null}
          </div>
          {node.user ? (
            <Badge tone={node.user.role === "hod" ? "warning" : "info"}>
              {node.user.role.split("_").join(" ")}
            </Badge>
          ) : null}
        </div>
      </div>
      {node.children.length > 0 ? (
        <ol className="mt-2 space-y-2">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function UserHierarchyPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [query, setQuery] = useState("");
  const [tree, setTree] = useState<UserHierarchyNode | null>(null);

  const load = useCallback(async () => {
    const org = await organizationService.getCurrentOrganization();
    const departmentList = await departmentService.getDepartments(org.id);
    setOrganization(org);
    setDepartments(departmentList);
    const hierarchy = await userHierarchyService.getOrganizationHierarchy(org.id);
    setTree(hierarchy);
  }, []);

  const loadTree = useCallback(async (departmentId: string) => {
    if (!organization) {
      return;
    }
    const hierarchy = departmentId
      ? await userHierarchyService.getDepartmentHierarchy(departmentId)
      : await userHierarchyService.getOrganizationHierarchy(organization.id);
    setTree(hierarchy);
  }, [organization]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadTree(selectedDepartmentId);
  }, [loadTree, selectedDepartmentId]);

  const visibleTree = useMemo(
    () => (tree ? filterNode(tree, query.trim()) : null),
    [tree, query],
  );

  function exportHierarchy() {
    if (!tree) {
      return;
    }
    const rows = flatten(tree).map((node) => ({
      name: node.label,
      detail: node.subtitle ?? "",
      role: node.user?.role ?? "",
      managerId: node.user?.reportingManagerId ?? "",
    }));
    const csv = [
      ["Name", "Detail", "Role", "Reporting Manager ID"].join(","),
      ...rows.map((row) =>
        [row.name, row.detail, row.role, row.managerId]
          .map((value) => `"${value.replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "site-connect-user-hierarchy.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Hierarchy exported.");
  }

  if (!organization || !tree) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="User Hierarchy"
        description="View company, department, HOD, manager and user reporting lines."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Users", to: "/users" },
          { label: "Hierarchy" },
        ]}
        action={
          <Button
            type="button"
            variant="secondary"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={exportHierarchy}
          >
            Export
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-brand-blue" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Department">
              <select
                className={selectClass}
                value={selectedDepartmentId}
                onChange={(event) => setSelectedDepartmentId(event.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.departmentName}
                  </option>
                ))}
              </select>
            </FormField>
            <Input
              label="Search User"
              value={query}
              leftIcon={<Search className="h-4 w-4" />}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{visibleTree?.label ?? organization.organizationName}</CardTitle>
        </CardHeader>
        <CardContent>
          {visibleTree ? (
            <ol className="space-y-2">
              <TreeNode node={visibleTree} />
            </ol>
          ) : (
            <p className="rounded-lg border border-dashed border-surface-border p-4 text-sm text-text-secondary">
              No hierarchy entries match the current search.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
