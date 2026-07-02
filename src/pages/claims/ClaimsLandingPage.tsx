import {
  ArrowRight,
  FilePlus2,
  History,
  ListChecks,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/layout/PageHeader";
import { ClaimSummaryCards } from "@/components/claims/ClaimSummaryCards";
import { ClaimsTable } from "@/components/claims/ClaimsTable";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { claimsService } from "@/services/claimsService";
import { useAuth } from "@/hooks/useAuth";
import type { Claim, ClaimReportSummary, UserClaimBalance } from "@/types/claims";
import { formatCurrency } from "@/utils/format";

export function ClaimsLandingPage() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [summary, setSummary] = useState<ClaimReportSummary | null>(null);
  const [balances, setBalances] = useState<UserClaimBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      return;
    }
    const currentUser = user;

    async function loadClaims() {
      setLoading(true);
      const nextClaims = await claimsService.listClaims(currentUser);
      const [nextSummary, nextBalances] = await Promise.all([
        claimsService.getReportSummary(currentUser, nextClaims),
        claimsService.listUserBalances(currentUser, nextClaims),
      ]);
      setClaims(nextClaims);
      setSummary(nextSummary);
      setBalances(nextBalances);
      setLoading(false);
    }

    void loadClaims();
  }, [user]);

  if (!user) {
    return null;
  }

  const queueLink =
    user.role === "admin_hr"
      ? "/claims/admin-verification"
      : user.role === "manager"
        ? "/claims/manager-approval"
        : user.role === "hod"
          ? "/claims/final-approval"
          : user.role === "super_admin"
            ? "/claims/admin-verification"
            : null;
  const canPay = ["accounts_officer", "super_admin"].includes(user.role);
  const currentBalance =
    balances.find((balance) => balance.userId === user.id) ?? balances[0];

  return (
    <>
      <PageHeader
        title="Claims & Finance"
        description="Submit expenses, review approvals, generate vouchers and track employee ledger impact."
        breadcrumbs={[
          { label: "Home", to: "/home" },
          { label: "Claims" },
        ]}
        action={
          <Button
            type="button"
            leftIcon={<FilePlus2 className="h-4 w-4" />}
            onClick={() => {
              window.location.href = "/claims/submit";
            }}
          >
            Submit Claim
          </Button>
        }
      />

      {loading || !summary ? (
        <LoadingState label="Loading claims" />
      ) : (
        <div className="space-y-6">
          <ClaimSummaryCards summary={summary} />

          <div className="rounded-lg border border-surface-border bg-white p-4 shadow-card">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-bold text-text-primary">
                  User Balance
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {currentBalance?.userName ?? user.fullName} outstanding balance
                  is{" "}
                  <span className="font-bold text-text-primary">
                    {formatCurrency(currentBalance?.outstandingBalance ?? 0)}
                  </span>
                  .
                </p>
              </div>
              <Link to="/claims/ledger" className="text-sm font-semibold">
                Open ledger statement
              </Link>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <QuickLink
              icon={<FilePlus2 className="h-5 w-5" />}
              title="Submit Claim"
              description="Create a multi-item employee expense claim."
              to="/claims/submit"
            />
            <QuickLink
              icon={<History className="h-5 w-5" />}
              title="Claim History"
              description="Search submitted, paid and returned claims."
              to="/claims/history"
            />
            <QuickLink
              icon={<WalletCards className="h-5 w-5" />}
              title="Ledger Statement"
              description="View user balance and payable settlement statement."
              to="/claims/ledger"
            />
            <QuickLink
              icon={<ListChecks className="h-5 w-5" />}
              title="Transactions"
              description="Audit register for claims, vouchers and payments."
              to="/claims/transactions"
            />
            <QuickLink icon={<ListChecks className="h-5 w-5"/>} title="Claim Reports" description="Ageing, approval delay, deductions and project cost." to="/claims/reports"/>
            {queueLink ? (
              <QuickLink
                icon={<ReceiptText className="h-5 w-5" />}
                title="Approval Queues"
                description="Verify, approve, reduce or return claims."
                to={queueLink}
              />
            ) : null}
            {canPay ? (
              <QuickLink
                icon={<WalletCards className="h-5 w-5" />}
                title="Vouchers"
                description="Generate vouchers and mark payments paid."
                to="/claims/vouchers"
              />
            ) : null}
          </div>

          <section>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-text-primary">
                  Recent Claims
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Latest visible claims based on your role.
                </p>
              </div>
              <Link to="/claims/history" className="text-sm font-semibold">
                View all
              </Link>
            </div>
            <ClaimsTable claims={claims.slice(0, 6)} />
          </section>
        </div>
      )}
    </>
  );
}

function QuickLink({
  icon,
  title,
  description,
  to,
}: {
  icon: JSX.Element;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link to={to}>
      <Card className="h-full transition hover:border-brand-blue/40 hover:shadow-elevated">
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-light text-brand-blue">
            {icon}
          </div>
          <CardTitle className="mt-3">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center text-sm font-semibold text-brand-blue">
          Open <ArrowRight className="ml-2 h-4 w-4" />
        </CardContent>
      </Card>
    </Link>
  );
}
