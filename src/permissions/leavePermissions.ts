import type { AppUser } from "@/types/auth";
import type { LeaveApplication } from "@/types/leave";

function approvalPathIncludes(leave: LeaveApplication, user: AppUser) {
  return (leave.approvalPath ?? []).some(
    (step) =>
      step.role === user.role &&
      (!step.userId || step.userId === user.id || step.delegatedFromUserId === user.id),
  );
}

export function canApproveLeave(user: AppUser, leave?: LeaveApplication) {
  if (user.role === "super_admin") {
    return Boolean(
      leave?.approvalPath?.some(
        (step) =>
          step.role === "super_admin" &&
          (!step.userId || step.userId === user.id || step.delegatedFromUserId === user.id),
      ),
    );
  }
  if (!["manager", "hod"].includes(user.role)) {
    return false;
  }
  if (!leave) {
    return true;
  }
  if (approvalPathIncludes(leave, user)) {
    return true;
  }
  if (user.role === "manager") {
    return leave.reportingManagerId === user.id || leave.managerId === user.id;
  }
  return leave.hodUserId === user.id || leave.departmentId === user.departmentId;
}

export function canViewLeaveOversight(user: AppUser) {
  return ["admin_hr", "super_admin"].includes(user.role);
}
