import { Badge } from "@/components/ui/Badge";
import {
  MATERIAL_PRIORITY_LABELS,
  MATERIAL_PRIORITY_TONES,
} from "@/constants/materials";
import { MaterialStatusBadge } from "@/components/materials/MaterialStatusBadge";
import { calculateRequestEstimatedCost } from "@/services/materialsService";
import type { MaterialRequest } from "@/types/materials";
import { formatCurrency } from "@/utils/format";

export function MaterialRequestTable({
  requests,
  emptyTitle = "No material requests found",
}: {
  requests: MaterialRequest[];
  emptyTitle?: string;
}) {
  if (requests.length === 0) {
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
            <th className="px-4 py-3 font-semibold">Request</th>
            <th className="px-4 py-3 font-semibold">Project</th>
            <th className="px-4 py-3 font-semibold">Items</th>
            <th className="px-4 py-3 font-semibold">Required</th>
            <th className="px-4 py-3 font-semibold">Estimate</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border bg-white">
          {requests.map((request) => (
            <tr key={request.id}>
              <td className="px-4 py-3">
                <p className="font-bold text-brand-blue">{request.requestNumber}</p>
                <div className="mt-1">
                  <Badge tone={MATERIAL_PRIORITY_TONES[request.priority]}>
                    {MATERIAL_PRIORITY_LABELS[request.priority]}
                  </Badge>
                </div>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {request.projectName}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {request.items.map((item) => item.materialName).join(", ")}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {request.requiredDate}
              </td>
              <td className="px-4 py-3 font-semibold text-text-primary">
                {formatCurrency(calculateRequestEstimatedCost(request))}
              </td>
              <td className="px-4 py-3">
                <MaterialStatusBadge status={request.status} kind="request" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
