import { attendanceService } from "@/services/attendanceService";
import { casualLabourService } from "@/services/casualLabourService";
import { claimsService } from "@/services/claimsService";
import { fieldOperationsService } from "@/services/fieldOperationsService";
import { fuelService } from "@/services/fuelService";
import { leaveService } from "@/services/leaveService";
import { machineryService } from "@/services/machineryService";
import { materialsService } from "@/services/materialsService";
import { taskService } from "@/services/taskService";
import { vendorsService } from "@/services/vendorsService";
import { supabase } from "@/services/supabaseClient";
import type { AppUser } from "@/types/auth";
import type {
  DetailedReport,
  ReportDefinition,
  ReportChartPoint,
  ReportModuleSummary,
  ReportsDashboard,
} from "@/types/reports";
import { formatCurrency } from "@/utils/format";

async function safe<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

function statusFrom(count: number, warningAt = 1, riskAt = 5): ReportModuleSummary["status"] {
  if (count >= riskAt) {
    return "risk";
  }
  if (count >= warningAt) {
    return "watch";
  }
  return "healthy";
}

export function buildExportRows(dashboard: ReportsDashboard) {
  return [
    ["Section", "Label", "Value"],
    ...dashboard.metrics.map((metric) => ["Metric", metric.label, metric.value]),
    ...dashboard.moduleSummaries.map((summary) => [
      "Module",
      summary.module,
      `${summary.primaryMetric} / ${summary.secondaryMetric}`,
    ]),
    ...dashboard.exceptions.map((exception) => ["Exception", exception, "Open"]),
  ];
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  ["claim-ageing", "Claim Ageing", "Claims"],
  ["claim-approval-delay", "Claim Approval Delay", "Claims"],
  ["employee-claim-ledger", "Employee Claim Ledger", "Claims"],
  ["project-claim-cost", "Project-wise Claim Cost", "Claims"],
  ["claim-deductions", "Claim Deductions", "Claims"],
  ["accounts-payment-pending", "Payment Pending", "Accounts"],
  ["accounts-sap-export", "SAP Export", "Accounts"],
  ["attendance-monthly", "Attendance Monthly Register", "Attendance"],
  ["department-attendance", "Department Attendance", "Attendance"],
  ["late-absent", "Late / Absent Report", "Attendance"],
  ["leave-balance", "Leave Balance", "Leave"],
  ["leave-usage", "Leave Usage", "Leave"],
  ["dpr-progress", "DPR Progress", "DPR"],
  ["labour-attendance", "Labour Attendance", "Labour"],
  ["labour-ot", "Labour OT", "Labour"],
  ["labour-payment", "Labour Payment", "Labour"],
  ["machinery-utilization", "Machinery Utilization", "Machinery"],
  ["machinery-breakdown", "Machinery Breakdown", "Machinery"],
  ["machinery-reconciliation", "Machinery Reconciliation", "Machinery"],
  ["fuel-vendor-balance", "Fuel Vendor Balance", "Fuel"],
  ["fuel-receipt", "Fuel Receipt", "Fuel"],
  ["fuel-issue", "Fuel Issue", "Fuel"],
  ["fuel-efficiency", "Fuel Efficiency", "Fuel"],
  ["material-stock", "Material Stock", "Materials"],
  ["material-consumption", "Material Consumption", "Materials"],
  ["material-wastage", "Material Wastage", "Materials"],
  ["vendor-outstanding", "Vendor Outstanding", "Vendors"],
  ["vendor-bill-ageing", "Vendor Bill Ageing", "Vendors"],
  ["vendor-payment", "Vendor Payment", "Vendors"],
  ["accounts-reconciliation", "Accounts Reconciliation", "Accounts"],
  ["project-cost-summary", "Project Cost Summary", "Accounts"],
  ["cost-code-summary", "Cost Code Summary", "Accounts"],
].map(([key, title, module]) => ({
  key,
  title,
  module,
  description: `${title} with role-scoped operational data and export support.`,
}));

export const reportsService = {
  async getDetailedReport(key: string, user: AppUser): Promise<DetailedReport> {
    const definition =
      REPORT_DEFINITIONS.find((item) => item.key === key) ??
      REPORT_DEFINITIONS[0];
    let headers: string[] = [];
    let rows: Array<Array<string | number>> = [];

    const financeViews:Record<string,{view:string;headers:string[];fields:string[]}>= {
      "claim-ageing":{view:"claim_ageing_report",headers:["Claim Number","Employee","Project","Submitted Date","Current Status","Pending With","Ageing Days","Amount"],fields:["claim_number","employee","project","submitted_at","status","pending_with","ageing_days","amount"]},
      "claim-approval-delay":{view:"claim_approval_delay_report",headers:["Claim Number","Employee","Admin Hours","Manager Hours","HOD Hours","Super Admin Hours","Accounts Hours"],fields:["claim_number","employee","admin_hours","manager_hours","hod_hours","super_admin_hours","accounts_hours"]},
      "project-claim-cost":{view:"claim_project_cost_report",headers:["Project","Customer","Cost Code","Expense Category","With Bill","Without Bill","Approved Amount","Deduction","Paid Amount"],fields:["project","customer","cost_code","expense_category","with_bill","without_bill","approved_amount","deduction","paid_amount"]},
      "employee-claim-ledger":{view:"claim_employee_ledger_report",headers:["Employee","Opening","Advance","Submitted","Approved","Deducted","Paid","Balance"],fields:["employee","opening","advance","submitted","approved","deducted","paid","balance"]},
      "claim-deductions":{view:"claim_deduction_report",headers:["Claim","Employee","Original Amount","Approved Amount","Deduction","Reason","Deducted By"],fields:["claim_number","employee","original_amount","approved_amount","deduction","deduction_reason","deducted_by"]},
      "accounts-payment-pending":{view:"claim_payment_pending_report",headers:["Voucher","Employee","Net Payable","SAP Status","Payment Status","Ageing Days"],fields:["voucher_number","employee","net_payable_amount","sap_status","payment_status","ageing_days"]},
      "accounts-sap-export":{view:"claim_sap_export_report",headers:["Batch","Export Date","Voucher","Claim","Amount","SAP GL","Cost Center","Exported By","Status"],fields:["batch","export_date","voucher_number","claim_number","amount","sap_gl_code","sap_cost_center","exported_by","status"]},
    };
    const finance=financeViews[key];
    if(finance&&supabase){
      if(key.startsWith("accounts-")&&!['accounts_officer','super_admin'].includes(user.role))throw new Error("Accounts report permission denied.");
      const{data,error}=await supabase.from(finance.view).select("*");if(error)throw new Error(error.message);headers=finance.headers;rows=(data??[]).map(row=>finance.fields.map(field=>{const value=(row as Record<string,unknown>)[field];return typeof value==="number"?value:String(value??"")}));
    } else if (key.startsWith("claim") || key === "project-claim-cost") {
      const claims = await claimsService.listClaims(user);
      headers = ["Claim", "Employee", "Project", "Submitted", "Claimed", "Approved", "Status"];
      rows = claims.map((claim) => [
        claim.claimNumber,
        claim.userName,
        claim.projectName,
        claim.submittedAt?.slice(0, 10) ?? claim.createdAt.slice(0, 10),
        claim.totalClaimed,
        claim.totalApproved,
        claim.status,
      ]);
    } else if (key.includes("attendance") || key === "late-absent") {
      const attendance = await attendanceService.listAttendance(user);
      headers = ["Date", "Employee", "Project", "Check in", "Check out", "Hours", "Status"];
      rows = attendance.map((record) => [
        record.date,
        record.userName,
        record.projectName ?? "-",
        record.checkInTime ?? "-",
        record.checkOutTime ?? "-",
        record.workedHours,
        record.status,
      ]);
    } else if (key.startsWith("leave")) {
      const leaves = await leaveService.listLeaves(user);
      headers = ["Reference", "Employee", "Type", "From", "To", "Days", "Status"];
      rows = leaves.map((leave) => [
        leave.leaveNumber,
        leave.userName,
        leave.leaveTypeName,
        leave.fromDate,
        leave.toDate,
        leave.numberOfDays,
        leave.status,
      ]);
    } else if (key.startsWith("dpr")) {
      const reports = await fieldOperationsService.listReports(user);
      headers = ["DPR", "Project", "Date", "Completion", "Labour", "Issues", "Status"];
      rows = reports.map((report) => [
        report.dprNumber,
        report.projectName,
        report.reportDate,
        `${Math.round(
          report.activities.reduce((sum, item) => sum + item.completionPercent, 0) /
            Math.max(report.activities.length, 1),
        )}%`,
        report.activities.reduce(
          (sum, item) =>
            sum +
            item.labor.male +
            item.labor.female +
            item.labor.supervisors +
            item.labor.companyStaff,
          0,
        ),
        report.issues.length,
        report.status,
      ]);
    } else if (key.startsWith("labour")) {
      const records = await casualLabourService.listAttendance(user);
      headers = ["Attendance", "Project", "Vendor", "Date", "Workers", "OT Hours", "Cost", "Status"];
      rows = records.map((record) => {
        const cost = record.rows.reduce(
          (sum, item) =>
            sum +
            item.dailyRate * (item.status === "present" ? 1 : item.status === "half_day" ? 0.5 : 0) +
            item.overtimeHours * item.overtimeRate,
          0,
        );
        return [
          record.attendanceNumber,
          record.projectName,
          record.vendorName,
          record.date,
          record.rows.length,
          record.rows.reduce((sum, item) => sum + item.overtimeHours, 0),
          cost,
          record.status,
        ];
      });
    } else if (key.startsWith("machinery")) {
      const logs = await machineryService.listLogs(user);
      headers = ["Log", "Project", "Machine", "Date", "Hours", "Breakdown", "Cost", "Status"];
      rows = logs.map((log) => [
        log.logNumber,
        log.projectName,
        log.machineNumber,
        log.date,
        log.totalMeterHours,
        log.breakdown.isBreakdown ? log.breakdown.reason : "No",
        log.calculatedCost ?? 0,
        log.status,
      ]);
    } else if (key.startsWith("fuel")) {
      const [receipts, issues] = await Promise.all([
        fuelService.listReceipts(user),
        fuelService.listIssues(user),
      ]);
      headers = ["Date", "Reference", "Project", "Type", "Source", "In", "Out", "Amount / Closing"];
      rows = [
        ...receipts.map((receipt) => [
          receipt.date,
          receipt.receiptNumber,
          receipt.projectName,
          receipt.fuelType,
          receipt.source,
          receipt.quantity,
          0,
          receipt.totalAmount,
        ]),
        ...issues.map((issue) => [
          issue.date,
          issue.issueNumber,
          issue.projectName,
          issue.fuelType,
          "issue",
          0,
          issue.totalIssued,
          issue.closingStock,
        ]),
      ];
    } else if (key.startsWith("material")) {
      const dashboard = await materialsService.getDashboard(user);
      headers = ["Material", "UOM", "Requested", "Received", "Damaged", "Open", "Estimated Cost"];
      rows = dashboard.inventory.map((item) => [
        item.materialName,
        item.uom,
        item.requestedQuantity,
        item.receivedQuantity,
        item.damagedQuantity,
        item.openQuantity,
        item.estimatedCost,
      ]);
    } else {
      const [bills, balances, payments] = await Promise.all([
        vendorsService.listBills(user),
        vendorsService.listBalances(user),
        vendorsService.listPayments(user),
      ]);
      if (key === "vendor-payment" || key === "accounts-reconciliation") {
        headers = ["Date", "Reference", "Vendor", "Amount", "Method", "Status"];
        const names = new Map(balances.map((item) => [item.vendorId, item.vendorName]));
        rows = payments.map((payment) => [
          payment.paymentDate,
          payment.referenceNumber,
          names.get(payment.vendorId) ?? payment.vendorId,
          payment.amount,
          payment.paymentMethod,
          payment.status,
        ]);
      } else {
        headers = ["Bill", "Vendor", "Project", "Invoice Date", "Amount", "Status"];
        rows = bills.map((bill) => [
          bill.billNumber,
          bill.vendorName,
          bill.projectName,
          bill.invoiceDate,
          bill.totalAmount,
          bill.status,
        ]);
      }
    }

    return {
      definition,
      headers,
      rows,
      metrics: [
        { label: "Rows", value: String(rows.length), tone: "info" },
        {
          label: "Generated",
          value: new Date().toISOString().slice(0, 10),
          tone: "neutral",
        },
      ],
    };
  },

  async getDashboard(user: AppUser): Promise<ReportsDashboard> {
    const [
      claims,
      attendance,
      tasks,
      fieldOps,
      leaveQueue,
      labour,
      machinery,
      fuel,
      materials,
      vendors,
    ] = await Promise.all([
      safe(() => claimsService.getReportSummary(user), {
        totalClaims: 0,
        totalClaimed: 0,
        totalApproved: 0,
        pendingApprovals: 0,
        paidAmount: 0,
      }),
      safe(() => attendanceService.getDashboard(user), null),
      safe(() => taskService.getDashboard(user), null),
      safe(() => fieldOperationsService.getDashboard(user), null),
      safe(() => leaveService.listApprovalQueue(user), []),
      safe(() => casualLabourService.getDashboard(user), null),
      safe(() => machineryService.getDashboard(user), null),
      safe(() => fuelService.getDashboard(user), null),
      safe(() => materialsService.getDashboard(user), null),
      safe(() => vendorsService.getDashboard(user), null),
    ]);

    const attendanceRate = attendance
      ? Math.round(
          (attendance.summary.presentDays /
            Math.max(attendance.summary.totalDays, 1)) *
            100,
        )
      : 0;
    const outstandingVendor = vendors?.summary.outstandingBalance ?? 0;
    const openApprovals =
      claims.pendingApprovals +
      (tasks?.summary.overdue ?? 0) +
      leaveQueue.length +
      (labour?.summary.pendingApproval ?? 0) +
      (machinery?.summary.pendingApproval ?? 0) +
      (fuel?.summary.pendingApproval ?? 0);

    const moduleSummaries: ReportModuleSummary[] = [
      {
        module: "Claims",
        primaryMetric: formatCurrency(claims.totalApproved),
        secondaryMetric: `${claims.pendingApprovals} pending`,
        status: statusFrom(claims.pendingApprovals, 1, 6),
        link: "/claims/reports",
      },
      {
        module: "Attendance",
        primaryMetric: `${attendanceRate}% present`,
        secondaryMetric: `${attendance?.summary.lateDays ?? 0} late`,
        status: statusFrom(attendance?.summary.lateDays ?? 0, 1, 4),
        link: "/attendance/summary",
      },
      {
        module: "Tasks",
        primaryMetric: `${tasks?.summary.open ?? 0} open`,
        secondaryMetric: `${tasks?.summary.overdue ?? 0} overdue`,
        status: statusFrom(tasks?.summary.overdue ?? 0, 1, 4),
        link: "/tasks/dashboard",
      },
      {
        module: "Field Ops",
        primaryMetric: `${fieldOps?.summary.totalReports ?? 0} DPRs`,
        secondaryMetric: `${fieldOps?.summary.pendingIssues ?? 0} issues`,
        status: statusFrom(fieldOps?.summary.pendingIssues ?? 0, 1, 4),
        link: "/field-operations/reports",
      },
      {
        module: "Machinery",
        primaryMetric: `${machinery?.summary.utilizationHours.toFixed(1) ?? "0.0"} hrs`,
        secondaryMetric: `${machinery?.summary.breakdownCount ?? 0} breakdowns`,
        status: statusFrom(machinery?.summary.breakdownCount ?? 0, 1, 3),
        link: "/machinery/reports",
      },
      {
        module: "Fuel",
        primaryMetric: `${fuel?.summary.stockOnHand ?? 0} L stock`,
        secondaryMetric: formatCurrency(fuel?.summary.purchaseCostThisMonth ?? 0),
        status: (fuel?.summary.stockOnHand ?? 0) <= 0 ? "risk" : "healthy",
        link: "/fuel",
      },
      {
        module: "Materials",
        primaryMetric: `${materials?.summary.openRequests ?? 0} open`,
        secondaryMetric: `${materials?.summary.damagedReceipts ?? 0} damaged`,
        status: statusFrom(materials?.summary.damagedReceipts ?? 0, 1, 3),
        link: "/materials",
      },
      {
        module: "Vendors",
        primaryMetric: formatCurrency(outstandingVendor),
        secondaryMetric: `${vendors?.summary.pendingBills ?? 0} pending bills`,
        status: statusFrom(vendors?.summary.pendingBills ?? 0, 1, 5),
        link: "/vendors",
      },
    ];

    const financeTrend: ReportChartPoint[] = [
      { label: "Claims approved", value: claims.totalApproved },
      { label: "Claims paid", value: claims.paidAmount },
      { label: "Vendor outstanding", value: outstandingVendor },
      { label: "Vendor paid", value: vendors?.summary.paidThisMonth ?? 0 },
    ];

    const operationsMix: ReportChartPoint[] = [
      { label: "DPRs", value: fieldOps?.summary.totalReports ?? 0 },
      { label: "Labour records", value: labour?.summary.submittedRecords ?? 0 },
      { label: "Machine logs", value: machinery?.summary.logsThisMonth ?? 0 },
      { label: "Fuel issues", value: fuel?.recentIssues.length ?? 0 },
      { label: "Material receipts", value: materials?.summary.receivedThisMonth ?? 0 },
    ];

    const exceptions = moduleSummaries
      .filter((summary) => summary.status !== "healthy")
      .map((summary) => `${summary.module}: ${summary.secondaryMetric}`);

    return {
      metrics: [
        {
          label: "Approved finance",
          value: formatCurrency(claims.totalApproved + outstandingVendor),
          tone: "info",
        },
        {
          label: "Open approvals",
          value: String(openApprovals),
          tone: openApprovals > 0 ? "warning" : "success",
        },
        {
          label: "Attendance rate",
          value: `${attendanceRate}%`,
          tone: attendanceRate >= 85 ? "success" : "danger",
        },
        {
          label: "Site issues",
          value: String(fieldOps?.summary.pendingIssues ?? 0),
          tone: (fieldOps?.summary.pendingIssues ?? 0) > 0 ? "danger" : "success",
        },
      ],
      moduleSummaries,
      financeTrend,
      operationsMix,
      exceptions,
    };
  },
};
