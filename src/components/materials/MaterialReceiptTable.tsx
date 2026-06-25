import { MaterialStatusBadge } from "@/components/materials/MaterialStatusBadge";
import { MATERIAL_CONDITION_LABELS } from "@/constants/materials";
import type { MaterialReceipt } from "@/types/materials";

export function MaterialReceiptTable({
  receipts,
  emptyTitle = "No material receipts found",
}: {
  receipts: MaterialReceipt[];
  emptyTitle?: string;
}) {
  if (receipts.length === 0) {
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
            <th className="px-4 py-3 font-semibold">Receipt</th>
            <th className="px-4 py-3 font-semibold">Vendor</th>
            <th className="px-4 py-3 font-semibold">Invoice</th>
            <th className="px-4 py-3 font-semibold">Items</th>
            <th className="px-4 py-3 font-semibold">Condition</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border bg-white">
          {receipts.map((receipt) => (
            <tr key={receipt.id}>
              <td className="px-4 py-3">
                <p className="font-bold text-brand-blue">{receipt.receiptNumber}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {receipt.receiptDate}
                </p>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {receipt.vendorName}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {receipt.invoiceNumber}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {receipt.items
                  .map((item) => `${item.materialName}: ${item.quantityReceived} ${item.uom}`)
                  .join(", ")}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {receipt.items
                  .map((item) => MATERIAL_CONDITION_LABELS[item.condition])
                  .join(", ")}
              </td>
              <td className="px-4 py-3">
                <MaterialStatusBadge status={receipt.status} kind="receipt" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
