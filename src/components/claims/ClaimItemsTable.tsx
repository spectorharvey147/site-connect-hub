import { formatCurrency } from "@/utils/format";
import type { ClaimItem } from "@/types/claims";

export function ClaimItemsTable({ items }: { items: ClaimItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-border">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-surface-border text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Category
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Project / Cost Code
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Description
              </th>
              <th className="px-4 py-3 text-left font-semibold text-text-secondary">
                Bill
              </th>
              <th className="px-4 py-3 text-right font-semibold text-text-secondary">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-white">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-brand-light/40">
                <td className="px-4 py-3 font-medium text-text-primary">
                  {item.categoryName}
                  <span className="mt-1 block text-xs font-normal text-text-secondary">
                    {item.expenseDate}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  <span className="block font-medium text-text-primary">
                    {item.projectName}
                  </span>
                  {item.costCode}
                </td>
                <td className="max-w-sm px-4 py-3 text-text-secondary">
                  {item.description}
                  {item.attachmentName ? (
                    <span className="mt-1 block text-xs font-semibold text-brand-blue">
                      {item.attachmentName}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {item.billType === "with_bill" ? "With bill" : "Without bill"}
                </td>
                <td className="px-4 py-3 text-right font-bold text-text-primary">
                  {formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <td className="px-4 py-3 text-sm font-bold text-text-primary" colSpan={4}>
                Total
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold text-text-primary">
                {formatCurrency(items.reduce((sum, item) => sum + item.amount, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
