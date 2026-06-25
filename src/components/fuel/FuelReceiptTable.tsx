import { FuelStatusBadge } from "@/components/fuel/FuelStatusBadge";
import { FUEL_SOURCE_LABELS, FUEL_TYPE_LABELS } from "@/constants/fuel";
import type { FuelReceipt } from "@/types/fuel";
import { formatCurrency } from "@/utils/format";

export function FuelReceiptTable({
  receipts,
  emptyTitle = "No fuel receipts found",
}: {
  receipts: FuelReceipt[];
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
            <th className="px-4 py-3 font-semibold">Fuel</th>
            <th className="px-4 py-3 font-semibold">Vendor</th>
            <th className="px-4 py-3 font-semibold">Quantity</th>
            <th className="px-4 py-3 font-semibold">Amount</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border bg-white">
          {receipts.map((receipt) => (
            <tr key={receipt.id}>
              <td className="px-4 py-3">
                <p className="font-bold text-brand-blue">{receipt.receiptNumber}</p>
                <p className="mt-1 text-xs text-text-secondary">{receipt.date}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-text-primary">
                  {FUEL_TYPE_LABELS[receipt.fuelType]}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {FUEL_SOURCE_LABELS[receipt.source]}
                </p>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {receipt.vendorName}
              </td>
              <td className="px-4 py-3 font-semibold text-text-primary">
                {receipt.quantity} {receipt.unit}
              </td>
              <td className="px-4 py-3 font-semibold text-text-primary">
                {formatCurrency(receipt.totalAmount)}
              </td>
              <td className="px-4 py-3">
                <FuelStatusBadge status={receipt.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
