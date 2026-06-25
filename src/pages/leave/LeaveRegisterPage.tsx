import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LeaveStatusBadge } from "@/components/leave/LeaveStatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { recordAuditLog } from "@/services/auditService";
import { leaveService } from "@/services/leaveService";
import type { AppUser } from "@/types/auth";
import type { LeaveApplication, LeaveStatus } from "@/types/leave";

export type LeaveRegisterView = "applications" | "users" | "monthly" | "balance";

interface BalanceRow {
  userId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  designation: string;
  leaveTypeName: string;
  openingBalance: number;
  used: number;
  pending: number;
  available: number;
  carryForward: number;
}

export function LeaveRegisterPage({
  view = "applications",
}: {
  view?: LeaveRegisterView;
}) {
  const { user } = useAuth();
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [status, setStatus] = useState<LeaveStatus | "all">("all");
  const [department, setDepartment] = useState("all");
  const [leaveType, setLeaveType] = useState("all");

  useEffect(() => {
    if (!user) return;
    void leaveService.getLeaveRegister(user).then((data) => {
      setApplications(data.applications);
      setUsers(data.users);
      setBalances(data.balances);
    });
  }, [user]);

  const filtered = useMemo(
    () =>
      applications.filter((leave) => {
        const employee = users.find((item) => item.id === leave.userId);
        return (
          (status === "all" || leave.status === status) &&
          (department === "all" || employee?.departmentId === department) &&
          (leaveType === "all" || leave.leaveTypeId === leaveType)
        );
      }),
    [applications, department, leaveType, status, users],
  );
  const title =
    view === "balance"
      ? "Leave Balance Register"
      : view === "monthly"
        ? "Monthly Leave Register"
        : user?.role === "manager"
          ? "Team Leave Register"
          : user?.role === "hod"
            ? "Department Leave Register"
            : ["admin_hr", "super_admin"].includes(user?.role ?? "site_staff")
              ? "All Users Leave Register"
              : "My Leave Register";

  async function auditExport(format: string) {
    if (!user) return;
    await recordAuditLog({
      userId: user.id,
      action: "leave.register_exported",
      entityType: "leave_register",
      newValues: { format, view, rowCount: filtered.length },
    });
  }

  async function exportCsv() {
    const rows = view === "balance"
      ? balances.map((row) => Object.values(row))
      : filtered.map((leave) => [
          leave.leaveNumber, leave.userName, leave.leaveTypeName, leave.fromDate,
          leave.toDate, leave.numberOfDays, leave.status, leave.approvedByName ?? "",
          leave.appliedAt, leave.approvalDate ?? "", leave.reason,
        ]);
    const header = view === "balance"
      ? ["User ID", "Employee Code", "Employee Name", "Department", "Designation", "Leave Type", "Opening", "Used", "Pending", "Available", "Carry Forward"]
      : ["Application ID", "Employee", "Leave Type", "From", "To", "Days", "Status", "Approver", "Applied", "Decision Date", "Reason"];
    const csv = [header, ...rows].map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    ).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `leave-register-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    await auditExport("excel_csv");
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(title, 14, 16);
    doc.setFontSize(9);
    const rows = view === "balance"
      ? balances.slice(0, 28).map((row) => `${row.employeeCode} | ${row.employeeName} | ${row.leaveTypeName} | Used ${row.used} | Available ${row.available}`)
      : filtered.slice(0, 28).map((leave) => `${leave.leaveNumber} | ${leave.userName} | ${leave.leaveTypeName} | ${leave.fromDate} to ${leave.toDate} | ${leave.status}`);
    rows.forEach((row, index) => doc.text(row, 14, 28 + index * 7));
    doc.save("leave-register.pdf");
    await auditExport("pdf");
  }

  return (
    <>
      <PageHeader
        title={title}
        description="Role-scoped leave applications, monthly usage and employee balances."
        breadcrumbs={[{ label: "Home", to: "/home" }, { label: "Leave", to: "/leave" }, { label: "Register" }]}
        action={<div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => void exportPdf()}>Download PDF</Button>
          <Button type="button" variant="secondary" leftIcon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => void exportCsv()}>Download Excel</Button>
          <Button type="button" variant="secondary" leftIcon={<Printer className="h-4 w-4" />} onClick={() => { void auditExport("print"); window.print(); }}>Print</Button>
        </div>}
      />
      {view !== "balance" ? (
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Filter label="Status" value={status} onChange={(value) => setStatus(value as LeaveStatus | "all")} options={[["all", "All statuses"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["withdrawn", "Withdrawn"]]} />
          <Filter label="Department" value={department} onChange={setDepartment} options={[["all", "All departments"], ...Array.from(new Map(users.filter((item) => item.departmentId).map((item) => [item.departmentId!, item.department ?? item.departmentId!])).entries())]} />
          <Filter label="Leave type" value={leaveType} onChange={setLeaveType} options={[["all", "All leave types"], ...leaveService.listLeaveTypes().map((item) => [item.id, item.name])]} />
        </div>
      ) : null}
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
          {view === "balance" ? <BalanceTable rows={balances} /> : filtered.length ? <ApplicationTable applications={filtered} /> : <EmptyState title="No leave records" description="Leave records matching this register scope will appear here." />}
        </CardContent>
      </Card>
    </>
  );
}

function ApplicationTable({ applications }: { applications: LeaveApplication[] }) {
  return <div className="overflow-x-auto"><table className="min-w-full divide-y divide-surface-border text-sm"><thead className="bg-slate-50"><tr>{["Application ID", "Employee", "Leave Type", "From", "To", "Days", "Status", "Approver", "Applied", "Decision", "Reason"].map((item) => <th key={item} className="px-3 py-3 text-left text-xs font-semibold text-text-secondary">{item}</th>)}</tr></thead><tbody className="divide-y divide-surface-border bg-surface-card">{applications.map((leave) => <tr key={leave.id}><td className="px-3 py-3 font-semibold">{leave.leaveNumber}</td><td className="px-3 py-3">{leave.userName}</td><td className="px-3 py-3">{leave.leaveTypeName}</td><td className="px-3 py-3">{leave.fromDate}</td><td className="px-3 py-3">{leave.toDate}</td><td className="px-3 py-3">{leave.numberOfDays}</td><td className="px-3 py-3"><LeaveStatusBadge status={leave.status} /></td><td className="px-3 py-3">{leave.approvedByName ?? "-"}</td><td className="px-3 py-3">{new Date(leave.appliedAt).toLocaleDateString()}</td><td className="px-3 py-3">{leave.approvalDate ? new Date(leave.approvalDate).toLocaleDateString() : "-"}</td><td className="max-w-64 px-3 py-3">{leave.reason}</td></tr>)}</tbody></table></div>;
}

function BalanceTable({ rows }: { rows: BalanceRow[] }) {
  return <div className="overflow-x-auto"><table className="min-w-full divide-y divide-surface-border text-sm"><thead className="bg-slate-50"><tr>{["Employee Code", "Employee Name", "Department", "Designation", "Leave Type", "Opening", "Used", "Pending", "Available", "Carry Forward"].map((item) => <th key={item} className="px-3 py-3 text-left text-xs font-semibold text-text-secondary">{item}</th>)}</tr></thead><tbody className="divide-y divide-surface-border bg-surface-card">{rows.map((row) => <tr key={`${row.userId}-${row.leaveTypeName}`}><td className="px-3 py-3">{row.employeeCode}</td><td className="px-3 py-3 font-semibold">{row.employeeName}</td><td className="px-3 py-3">{row.department || "-"}</td><td className="px-3 py-3">{row.designation || "-"}</td><td className="px-3 py-3">{row.leaveTypeName}</td><td className="px-3 py-3">{row.openingBalance}</td><td className="px-3 py-3">{row.used}</td><td className="px-3 py-3">{row.pending}</td><td className="px-3 py-3 font-semibold">{row.available}</td><td className="px-3 py-3">{row.carryForward}</td></tr>)}</tbody></table></div>;
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <label className="text-xs font-semibold text-text-secondary">{label}<select className="mt-1 h-10 w-full rounded-md border border-surface-border bg-surface-card px-3 text-sm text-text-primary" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}
