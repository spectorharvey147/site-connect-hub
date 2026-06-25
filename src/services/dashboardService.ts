import { attendanceService } from "@/services/attendanceService";
import { claimsService } from "@/services/claimsService";
import { leaveService } from "@/services/leaveService";
import { taskService } from "@/services/taskService";
import type { AppUser } from "@/types/auth";
import type {
  DashboardActivity,
  DashboardMetric,
  DashboardSummary,
} from "@/types/dashboard";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function relativeTime(value: string) {
  const milliseconds = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(milliseconds / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} day(s) ago`;
}

export const dashboardService = {
  async getSummary(user: AppUser): Promise<DashboardSummary> {
    const [claimsResult, attendanceResult, leaveResult, taskResult] =
      await Promise.allSettled([
        claimsService.listClaims(user),
        attendanceService.getDashboard(user),
        leaveService.listLeaves(user),
        taskService.getDashboard(user),
      ]);

    const claims =
      claimsResult.status === "fulfilled" ? claimsResult.value : [];
    const attendance =
      attendanceResult.status === "fulfilled"
        ? attendanceResult.value
        : { today: undefined, summary: { presentDays: 0 }, recent: [] };
    const leaves = leaveResult.status === "fulfilled" ? leaveResult.value : [];
    const taskDashboard =
      taskResult.status === "fulfilled"
        ? taskResult.value
        : {
            summary: {
              total: 0,
              open: 0,
              overdue: 0,
              completed: 0,
              highPriority: 0,
            },
            recent: [],
            overdue: [],
          };

    const pendingClaims = claims.filter((claim) =>
      [
        "submitted",
        "admin_verification_pending",
        "admin_verified",
        "manager_approval_pending",
        "manager_approved",
        "final_approval_pending",
        "approved_for_payment",
        "voucher_generated",
        "partial_paid",
        "pending_payment",
      ].includes(claim.status),
    );
    const approvedAmount = claims.reduce(
      (total, claim) => total + claim.totalApproved,
      0,
    );
    const pendingLeaves = leaves.filter((leave) =>
      ["submitted", "pending"].includes(leave.status),
    );

    const metrics: DashboardMetric[] = [
      {
        label: user.role === "site_staff" ? "My pending claims" : "Visible claim queue",
        value: String(pendingClaims.length),
        trend: formatAmount(
          pendingClaims.reduce((total, claim) => total + claim.totalApproved, 0),
        ),
        tone: pendingClaims.length ? "warning" : "success",
      },
      {
        label: "Approved claim value",
        value: formatAmount(approvedAmount),
        tone: "info",
      },
      {
        label: user.role === "site_staff" ? "My open tasks" : "Scoped open tasks",
        value: String(taskDashboard.summary.open),
        trend: `${taskDashboard.summary.overdue} overdue`,
        tone: taskDashboard.summary.overdue ? "danger" : "success",
      },
      {
        label: user.role === "site_staff" ? "My pending leave" : "Visible leave queue",
        value: String(pendingLeaves.length),
        trend: attendance.today?.checkInTime
          ? "Checked in today"
          : `${attendance.summary.presentDays ?? 0} present day(s) this month`,
        tone: pendingLeaves.length ? "warning" : "neutral",
      },
    ];

    const activities: DashboardActivity[] = [
      ...claims.slice(0, 4).map((claim) => ({
        id: `claim-${claim.id}`,
        title: `${claim.claimNumber} · ${claim.status.replace(/_/g, " ")}`,
        description: `${claim.userName} · ${claim.projectName} · ${formatAmount(claim.totalApproved || claim.totalClaimed)}`,
        timestamp: relativeTime(claim.updatedAt),
        module: "Claims",
      })),
      ...taskDashboard.recent.slice(0, 4).map((task) => ({
        id: `task-${task.id}`,
        title: `${task.taskNumber} · ${task.status.replace(/_/g, " ")}`,
        description: `${task.title} · ${task.assignedToName}`,
        timestamp: relativeTime(task.updatedAt),
        module: "Tasks",
      })),
      ...leaves.slice(0, 3).map((leave) => ({
        id: `leave-${leave.id}`,
        title: `${leave.leaveNumber} · ${leave.status}`,
        description: `${leave.userName} · ${leave.numberOfDays} day(s)`,
        timestamp: relativeTime(leave.updatedAt),
        module: "Leave",
      })),
    ].slice(0, 8);

    return {
      role: user.role,
      metrics,
      chartData: [
        { label: "Claims", value: claims.length },
        { label: "Tasks", value: taskDashboard.summary.total },
        { label: "Leaves", value: leaves.length },
        {
          label: "Attendance",
          value: attendance.summary.presentDays ?? 0,
        },
      ],
      pendingCounts: {
        claims: pendingClaims.length,
        attendance: attendance.today?.checkInTime ? 0 : 1,
        leave: pendingLeaves.length,
        tasks: taskDashboard.summary.open,
        messages: 0,
        fieldOperations: 0,
        vendors: 0,
      },
      activities,
    };
  },
};
