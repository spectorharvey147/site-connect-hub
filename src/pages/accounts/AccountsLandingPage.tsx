import {
  BookOpenCheck,
  FileCheck2,
  Landmark,
  ReceiptText,
  Scale,
  UsersRound,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";

const sections = [
  { path: "/accounts/payment-queue", label: "Payment Queue", icon: FileCheck2, target: "/accounts/payment-queue" },
  { path: "/accounts/vouchers", label: "Payment Vouchers", icon: ReceiptText, target: "/accounts/vouchers" },
  { path: "/accounts/employee-ledger", label: "Employee Ledger", icon: UsersRound, target: "/accounts/employee-ledger" },
  { path: "/accounts/vendor-ledger", label: "Vendor Ledger", icon: BookOpenCheck, target: "/accounts/vendor-ledger" },
  { path: "/accounts/reconciliation", label: "Reconciliation", icon: Scale, target: "/accounts/reconciliation" },
  { path: "/accounts/reports", label: "Accounts Reports", icon: Landmark, target: "/accounts/reports" },
];

export function AccountsLandingPage() {
  const location = useLocation();
  const selected = sections.find((item) => item.path === location.pathname);
  return (
    <>
      <PageHeader
        title={selected?.label ?? "Accounts"}
        description="Approved payment processing, vouchers, ledgers and reconciliation."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Accounts", to: "/accounts" },
          ...(selected ? [{ label: selected.label }] : []),
        ]}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.path} to={section.target}>
              <Card className="h-full transition hover:border-brand-blue">
                <CardContent className="flex items-center gap-4 pt-5">
                  <Icon className="h-6 w-6 text-brand-blue" />
                  <p className="font-semibold text-text-primary">{section.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
