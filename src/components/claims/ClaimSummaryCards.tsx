import { IndianRupee, ReceiptText, TimerReset, WalletCards } from "lucide-react";

import { StatCard } from "@/components/shared/StatCard";
import type { ClaimReportSummary } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

export function ClaimSummaryCards({ summary }: { summary: ClaimReportSummary }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        metric={{
          label: "Total claims",
          value: String(summary.totalClaims),
          tone: "info",
        }}
        icon={<ReceiptText className="h-5 w-5" />}
      />
      <StatCard
        metric={{
          label: "Claimed amount",
          value: formatCurrency(summary.totalClaimed),
          tone: "neutral",
        }}
        icon={<IndianRupee className="h-5 w-5" />}
      />
      <StatCard
        metric={{
          label: "Pending approvals",
          value: String(summary.pendingApprovals),
          tone: "warning",
        }}
        icon={<TimerReset className="h-5 w-5" />}
      />
      <StatCard
        metric={{
          label: "Paid amount",
          value: formatCurrency(summary.paidAmount),
          tone: "success",
        }}
        icon={<WalletCards className="h-5 w-5" />}
      />
    </div>
  );
}
