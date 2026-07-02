import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { AttendanceAdminPage } from "@/pages/attendance/AttendanceAdminPage";
import { AttendanceLandingPage } from "@/pages/attendance/AttendanceLandingPage";
import { AttendanceRegisterPage } from "@/pages/attendance/AttendanceRegisterPage";
import { AttendanceSummaryPage } from "@/pages/attendance/AttendanceSummaryPage";
import { ManualAttendancePage } from "@/pages/attendance/ManualAttendancePage";
import { QuickCheckInPage } from "@/pages/attendance/QuickCheckInPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { SetupAdminPage } from "@/pages/auth/SetupAdminPage";
import { ClaimDetailPage } from "@/pages/claims/ClaimDetailPage";
import { ClaimHistoryPage } from "@/pages/claims/ClaimHistoryPage";
import { ClaimLedgerPage } from "@/pages/claims/ClaimLedgerPage";
import { ClaimQueuePage } from "@/pages/claims/ClaimQueuePage";
import { ClaimReportsPage } from "@/pages/claims/ClaimReportsPage";
import { ClaimTransactionsPage } from "@/pages/claims/ClaimTransactionsPage";
import { ClaimVouchersPage } from "@/pages/claims/ClaimVouchersPage";
import { ClaimsLandingPage } from "@/pages/claims/ClaimsLandingPage";
import { SubmitClaimPage } from "@/pages/claims/SubmitClaimPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { DprDetailPage } from "@/pages/fieldOperations/DprDetailPage";
import { DprHistoryPage } from "@/pages/fieldOperations/DprHistoryPage";
import { FieldOperationsLandingPage } from "@/pages/fieldOperations/FieldOperationsLandingPage";
import { FieldOperationsReportsPage } from "@/pages/fieldOperations/FieldOperationsReportsPage";
import { SubmitDprPage } from "@/pages/fieldOperations/SubmitDprPage";
import { HomePage } from "@/pages/home/HomePage";
import { ApplyLeavePage } from "@/pages/leave/ApplyLeavePage";
import { HolidayCalendarPage } from "@/pages/leave/HolidayCalendarPage";
import { LeaveApprovalsPage } from "@/pages/leave/LeaveApprovalsPage";
import { LeaveHistoryPage } from "@/pages/leave/LeaveHistoryPage";
import { LeaveRegisterPage } from "@/pages/leave/LeaveRegisterPage";
import { UserLeaveRegisterPage } from "@/pages/leave/UserLeaveRegisterPage";
import { MonthlyLeaveRegisterPage } from "@/pages/leave/MonthlyLeaveRegisterPage";
import { LeaveBalanceRegisterPage } from "@/pages/leave/LeaveBalanceRegisterPage";
import { LeaveLandingPage } from "@/pages/leave/LeaveLandingPage";
import { LeavePolicyPage } from "@/pages/leave/LeavePolicyPage";
import { ConversationPage } from "@/pages/messages/ConversationPage";
import { MessagesInboxPage } from "@/pages/messages/MessagesInboxPage";
import { NewConversationPage } from "@/pages/messages/NewConversationPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { NotificationsPage } from "@/pages/notifications/NotificationsPage";
import { ProjectAssignmentsPage } from "@/pages/projects/ProjectAssignmentsPage";
import { ProfilePage } from "@/pages/profile/ProfilePage";
import { ProjectDetailPage } from "@/pages/projects/ProjectDetailPage";
import { ProjectFormPage } from "@/pages/projects/ProjectFormPage";
import { ProjectsPage } from "@/pages/projects/ProjectsPage";
import { CreateTaskPage } from "@/pages/tasks/CreateTaskPage";
import { TaskDashboardPage } from "@/pages/tasks/TaskDashboardPage";
import { TaskDetailPage } from "@/pages/tasks/TaskDetailPage";
import { TaskListPage } from "@/pages/tasks/TaskListPage";
import { TasksLandingPage } from "@/pages/tasks/TasksLandingPage";
import { UnauthorizedPage } from "@/pages/UnauthorizedPage";
import { UserDetailPage } from "@/pages/users/UserDetailPage";
import { CreateUserPage } from "@/pages/users/CreateUserPage";
import { EditUserPage } from "@/pages/users/EditUserPage";
import { UserHierarchyPage } from "@/pages/users/UserHierarchyPage";
import { UserProjectAssignmentPage } from "@/pages/users/UserProjectAssignmentPage";
import { UsersPage } from "@/pages/users/UsersPage";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import {
  CLAIM_ROLES,
  MESSAGE_ROLES,
  PEOPLE_ROLES,
  VENDOR_SOURCE_ENTRY_ROLES,
  VENDOR_ROLES,
} from "@/routes/routePermissions";
import type { Role } from "@/types/auth";

const AccountsLandingPage = lazy(() =>
  import("@/pages/accounts/AccountsLandingPage").then((module) => ({
    default: module.AccountsLandingPage,
  })),
);
const AccountsPaymentQueuePage = lazy(() =>
  import("@/pages/accounts/AccountsPaymentQueuePage").then((module) => ({
    default: module.AccountsPaymentQueuePage,
  })),
);
const AccountsSectionPage = lazy(() =>
  import("@/pages/accounts/AccountsSectionPage").then((module) => ({
    default: module.AccountsSectionPage,
  })),
);
const CasualLabourLandingPage = lazy(() =>
  import("@/pages/casualLabour/CasualLabourLandingPage").then((module) => ({
    default: module.CasualLabourLandingPage,
  })),
);
const LabourAttendancePage = lazy(() =>
  import("@/pages/casualLabour/LabourAttendancePage").then((module) => ({
    default: module.LabourAttendancePage,
  })),
);
const LabourMasterPage = lazy(() =>
  import("@/pages/casualLabour/LabourMasterPage").then((module) => ({
    default: module.LabourMasterPage,
  })),
);
const LabourRegisterPage = lazy(() =>
  import("@/pages/casualLabour/LabourRegisterPage").then((module) => ({
    default: module.LabourRegisterPage,
  })),
);
const LabourBillsPage = lazy(() =>
  import("@/pages/casualLabour/LabourBillsPage").then((module) => ({
    default: module.LabourBillsPage,
  })),
);
const FuelLandingPage = lazy(() =>
  import("@/pages/fuel/FuelLandingPage").then((module) => ({
    default: module.FuelLandingPage,
  })),
);
const FuelSectionPage = lazy(() =>
  import("@/pages/fuel/FuelSectionPage").then((module) => ({
    default: module.FuelSectionPage,
  })),
);
const FuelDepositsPage = lazy(() =>
  import("@/pages/fuel/FuelDepositsPage").then((module) => ({
    default: module.FuelDepositsPage,
  })),
);
const VendorBillsWorkflowPage = lazy(() =>
  import("@/pages/vendors/VendorBillsWorkflowPage").then((module) => ({
    default: module.VendorBillsWorkflowPage,
  })),
);
const MaterialReceiptPage = lazy(() =>
  import("@/pages/materials/MaterialReceiptPage").then((module) => ({
    default: module.MaterialReceiptPage,
  })),
);
const MaterialConsumptionPage = lazy(() =>
  import("@/pages/materials/MaterialConsumptionPage").then((module) => ({
    default: module.MaterialConsumptionPage,
  })),
);
const MaterialRequestPage = lazy(() =>
  import("@/pages/materials/MaterialRequestPage").then((module) => ({
    default: module.MaterialRequestPage,
  })),
);
const MaterialsLandingPage = lazy(() =>
  import("@/pages/materials/MaterialsLandingPage").then((module) => ({
    default: module.MaterialsLandingPage,
  })),
);
const MaterialsSectionPage = lazy(() =>
  import("@/pages/materials/MaterialsSectionPage").then((module) => ({
    default: module.MaterialsSectionPage,
  })),
);
const MachineLogsPage = lazy(() =>
  import("@/pages/machinery/MachineLogsPage").then((module) => ({
    default: module.MachineLogsPage,
  })),
);
const MachineryContractsPage = lazy(() =>
  import("@/pages/machinery/MachineryContractsPage").then((module) => ({
    default: module.MachineryContractsPage,
  })),
);
const MachineryLandingPage = lazy(() =>
  import("@/pages/machinery/MachineryLandingPage").then((module) => ({
    default: module.MachineryLandingPage,
  })),
);
const MachineryReportsPage = lazy(() =>
  import("@/pages/machinery/MachineryReportsPage").then((module) => ({
    default: module.MachineryReportsPage,
  })),
);
const ReportsLandingPage = lazy(() =>
  import("@/pages/reports/ReportsLandingPage").then((module) => ({
    default: module.ReportsLandingPage,
  })),
);
const ReportDetailPage = lazy(() =>
  import("@/pages/reports/ReportDetailPage").then((module) => ({
    default: module.ReportDetailPage,
  })),
);
const ApprovalMatrixPage = lazy(() =>
  import("@/pages/settings/ApprovalMatrixPage").then((module) => ({
    default: module.ApprovalMatrixPage,
  })),
);
const CustomersMasterPage = lazy(() =>
  import("@/pages/settings/CustomersMasterPage").then((module) => ({
    default: module.CustomersMasterPage,
  })),
);
const DelegationsPage = lazy(() =>
  import("@/pages/settings/DelegationsPage").then((module) => ({
    default: module.DelegationsPage,
  })),
);
const DepartmentsPage = lazy(() =>
  import("@/pages/settings/DepartmentsPage").then((module) => ({
    default: module.DepartmentsPage,
  })),
);
const EmailSettingsPage = lazy(() =>
  import("@/pages/settings/EmailSettingsPage").then((module) => ({
    default: module.EmailSettingsPage,
  })),
);
const ExpenseCategoriesPage = lazy(() =>
  import("@/pages/settings/ExpenseCategoriesPage").then((module) => ({
    default: module.ExpenseCategoriesPage,
  })),
);
const DesignationsPage = lazy(() =>
  import("@/pages/settings/DesignationsPage").then((module) => ({
    default: module.DesignationsPage,
  })),
);
const AccountsVouchersPage = lazy(() =>
  import("@/pages/accounts/AccountsVouchersPage").then((module) => ({ default: module.AccountsVouchersPage })),
);
const ClaimAccountsVerificationPage = lazy(() =>
  import("@/pages/accounts/ClaimAccountsVerificationPage").then((module) => ({
    default: module.ClaimAccountsVerificationPage,
  })),
);
const SapEntryPage=lazy(()=>import("@/pages/accounts/SapEntryPage").then(m=>({default:m.SapEntryPage})));
const SapPendingPage=lazy(()=>import("@/pages/accounts/SapPendingPage").then(m=>({default:m.SapPendingPage})));
const SapPreviewPage=lazy(()=>import("@/pages/accounts/SapPreviewPage").then(m=>({default:m.SapPreviewPage})));
const SapBatchesPage=lazy(()=>import("@/pages/accounts/SapBatchesPage").then(m=>({default:m.SapBatchesPage})));
const SapBatchDetailPage=lazy(()=>import("@/pages/accounts/SapBatchDetailPage").then(m=>({default:m.SapBatchDetailPage})));
const SapMappingPage=lazy(()=>import("@/pages/settings/SapMappingPage").then(m=>({default:m.SapMappingPage})));
const EmployeeLedgerPage=lazy(()=>import("@/pages/accounts/EmployeeLedgerPage").then(m=>({default:m.EmployeeLedgerPage})));
const EmployeeLedgerDetailPage=lazy(()=>import("@/pages/accounts/EmployeeLedgerDetailPage").then(m=>({default:m.EmployeeLedgerDetailPage})));
const UserAdvancePage=lazy(()=>import("@/pages/users/UserAdvancePage").then(m=>({default:m.UserAdvancePage})));
const UserSignaturePage=lazy(()=>import("@/pages/users/UserSignaturePage").then(m=>({default:m.UserSignaturePage})));
const SignaturesPage=lazy(()=>import("@/pages/settings/SignaturesPage").then(m=>({default:m.SignaturesPage})));
const ClaimEmailActionPage=lazy(()=>import("@/pages/claims/ClaimEmailActionPage").then(m=>({default:m.ClaimEmailActionPage})));
const WorkTypesPage = lazy(() => import("@/pages/settings/WorkTypesPage").then((module) => ({ default: module.WorkTypesPage })));
const OrganizationSettingsPage = lazy(() =>
  import("@/pages/settings/OrganizationSettingsPage").then((module) => ({
    default: module.OrganizationSettingsPage,
  })),
);
const ProjectCostCodesPage = lazy(() =>
  import("@/pages/settings/ProjectCostCodesPage").then((module) => ({
    default: module.ProjectCostCodesPage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const VendorsLandingPage = lazy(() =>
  import("@/pages/vendors/VendorsLandingPage").then((module) => ({
    default: module.VendorsLandingPage,
  })),
);
const VendorSectionPage = lazy(() =>
  import("@/pages/vendors/VendorSectionPage").then((module) => ({
    default: module.VendorSectionPage,
  })),
);
const VendorContractsPage = lazy(() =>
  import("@/pages/vendors/VendorContractsPage").then((module) => ({
    default: module.VendorContractsPage,
  })),
);
const VendorContractFormPage = lazy(() =>
  import("@/pages/vendors/VendorContractFormPage").then((module) => ({
    default: module.VendorContractFormPage,
  })),
);
const VendorContractDetailPage = lazy(() =>
  import("@/pages/vendors/VendorContractDetailPage").then((module) => ({
    default: module.VendorContractDetailPage,
  })),
);
const LabourContractsPage = lazy(() =>
  import("@/pages/vendors/LabourContractsPage").then((module) => ({
    default: module.LabourContractsPage,
  })),
);
const FuelContractsPage = lazy(() =>
  import("@/pages/vendors/FuelContractsPage").then((module) => ({
    default: module.FuelContractsPage,
  })),
);
const MaterialContractsPage = lazy(() =>
  import("@/pages/vendors/MaterialContractsPage").then((module) => ({
    default: module.MaterialContractsPage,
  })),
);
const VendorMachineryContractsPage = lazy(() =>
  import("@/pages/vendors/MachineryContractsPage").then((module) => ({
    default: module.MachineryContractsPage,
  })),
);

function restricted(element: JSX.Element, allowedRoles: Role[]) {
  return <ProtectedRoute allowedRoles={allowedRoles}>{element}</ProtectedRoute>;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading page…</div>}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/setup-admin" element={<SetupAdminPage />} />
      <Route path="/claim-action" element={<ClaimEmailActionPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="unauthorized" element={<UnauthorizedPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="claims"
          element={
            <ProtectedRoute
              allowedRoles={[
                "site_staff",
                "manager",
                "hod",
                "admin_hr",
                "super_admin",
                "accounts_officer",
              ]}
            >
              <ClaimsLandingPage />
            </ProtectedRoute>
          }
        />
        <Route path="claims/submit" element={restricted(<SubmitClaimPage />, PEOPLE_ROLES)} />
        <Route path="claims/history" element={restricted(<ClaimHistoryPage />, CLAIM_ROLES)} />
        <Route path="claims/ledger" element={restricted(<ClaimLedgerPage />, CLAIM_ROLES)} />
        <Route path="claims/transactions" element={restricted(<ClaimTransactionsPage />, CLAIM_ROLES)} />
        <Route path="claims/reports" element={restricted(<ClaimReportsPage />, CLAIM_ROLES)} />
        <Route path="claims/:claimId" element={restricted(<ClaimDetailPage />, CLAIM_ROLES)} />
        <Route
          path="claims/admin-verification"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <ClaimQueuePage stage="admin" />
            </ProtectedRoute>
          }
        />
        <Route
          path="claims/manager-approval"
          element={
            <ProtectedRoute allowedRoles={["manager", "hod", "super_admin"]}>
              <ClaimQueuePage stage="manager" />
            </ProtectedRoute>
          }
        />
        <Route
          path="claims/final-approval"
          element={
            <ProtectedRoute allowedRoles={["hod", "super_admin"]}>
              <ClaimQueuePage stage="final" />
            </ProtectedRoute>
          }
        />
        <Route
          path="claims/vouchers"
          element={
            <ProtectedRoute allowedRoles={["accounts_officer", "super_admin"]}>
              <ClaimVouchersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="attendance"
          element={
            <ProtectedRoute
              allowedRoles={[
                "site_staff",
                "manager",
                "hod",
                "admin_hr",
                "super_admin",
              ]}
            >
              <AttendanceLandingPage />
            </ProtectedRoute>
          }
        />
        <Route path="attendance/check-in" element={restricted(<QuickCheckInPage />, PEOPLE_ROLES)} />
        <Route path="attendance/manual" element={restricted(<ManualAttendancePage />, ["manager", "hod", "admin_hr", "super_admin"])} />
        <Route path="attendance/register" element={restricted(<AttendanceRegisterPage />, PEOPLE_ROLES)} />
        <Route path="attendance/summary" element={restricted(<AttendanceSummaryPage />, PEOPLE_ROLES)} />
        <Route
          path="attendance/admin"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <AttendanceAdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="leave"
          element={
            <ProtectedRoute
              allowedRoles={[
                "site_staff",
                "manager",
                "hod",
                "admin_hr",
                "super_admin",
              ]}
            >
              <LeaveLandingPage />
            </ProtectedRoute>
          }
        />
        <Route path="leave/apply" element={restricted(<ApplyLeavePage />, PEOPLE_ROLES)} />
        <Route path="leave/history" element={restricted(<LeaveHistoryPage />, PEOPLE_ROLES)} />
        <Route path="leave/register" element={restricted(<LeaveRegisterPage />, PEOPLE_ROLES)} />
        <Route path="leave/register/users" element={restricted(<UserLeaveRegisterPage />, PEOPLE_ROLES)} />
        <Route path="leave/register/monthly" element={restricted(<MonthlyLeaveRegisterPage />, PEOPLE_ROLES)} />
        <Route path="leave/register/balance" element={restricted(<LeaveBalanceRegisterPage />, PEOPLE_ROLES)} />
        <Route path="leave/holidays" element={restricted(<HolidayCalendarPage />, PEOPLE_ROLES)} />
        <Route
          path="leave/approvals"
          element={
            <ProtectedRoute allowedRoles={["manager", "hod", "super_admin"]}>
              <LeaveApprovalsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="leave/policies"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <LeavePolicyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="tasks"
          element={
            <ProtectedRoute
              allowedRoles={[
                "site_staff",
                "manager",
                "hod",
                "admin_hr",
                "super_admin",
              ]}
            >
              <TasksLandingPage />
            </ProtectedRoute>
          }
        />
        <Route path="tasks/list" element={restricted(<TaskListPage />, PEOPLE_ROLES)} />
        <Route path="tasks/dashboard" element={restricted(<TaskDashboardPage />, PEOPLE_ROLES)} />
        <Route path="tasks/:taskId" element={restricted(<TaskDetailPage />, PEOPLE_ROLES)} />
        <Route
          path="tasks/create"
          element={
            <ProtectedRoute allowedRoles={["manager", "hod", "admin_hr", "super_admin"]}>
              <CreateTaskPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="messages"
          element={
            <ProtectedRoute
              allowedRoles={[
                "site_staff",
                "manager",
                "hod",
                "admin_hr",
                "super_admin",
                "accounts_officer",
              ]}
            >
              <MessagesInboxPage />
            </ProtectedRoute>
          }
        />
        <Route path="messages/new" element={restricted(<NewConversationPage />, MESSAGE_ROLES)} />
        <Route path="messages/:conversationId" element={restricted(<ConversationPage />, MESSAGE_ROLES)} />
        <Route
          path="field-operations"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <FieldOperationsLandingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="field-operations/submit"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <SubmitDprPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="field-operations/history"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <DprHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="field-operations/reports"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <FieldOperationsReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="field-operations/:reportId"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <DprDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="dpr/submit"
          element={<Navigate to="/field-operations/submit" replace />}
        />
        <Route
          path="dpr/history"
          element={<Navigate to="/field-operations/history" replace />}
        />
        <Route
          path="dpr/:reportId"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <DprDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="casual-labour"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <CasualLabourLandingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="casual-labour/attendance"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <LabourAttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="casual-labour/register"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <LabourRegisterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="casual-labour/master"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <LabourMasterPage />
            </ProtectedRoute>
          }
        />
        <Route path="casual-labour/contracts" element={<Navigate to="/vendors/contracts/labour" replace />} />
        <Route path="casual-labour/work-allocation" element={restricted(<LabourAttendancePage />, PEOPLE_ROLES)} />
        <Route path="casual-labour/bills" element={restricted(<LabourBillsPage />, PEOPLE_ROLES)} />
        <Route path="casual-labour/reports" element={restricted(<LabourRegisterPage />, PEOPLE_ROLES)} />
        <Route
          path="labor/attendance"
          element={<Navigate to="/casual-labour/attendance" replace />}
        />
        <Route
          path="labor/register"
          element={<Navigate to="/casual-labour/register" replace />}
        />
        <Route
          path="machinery"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <MachineryLandingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="machinery/logs"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <MachineLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="machinery/contracts"
          element={
            <ProtectedRoute allowedRoles={["manager", "hod", "admin_hr", "super_admin"]}>
              <MachineryContractsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="machinery/reports"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <MachineryReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="fuel"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <FuelLandingPage />
            </ProtectedRoute>
          }
        />
        <Route path="fuel/deposits" element={restricted(<FuelDepositsPage />, PEOPLE_ROLES)} />
        <Route path="fuel/receipts" element={restricted(<FuelLandingPage />, PEOPLE_ROLES)} />
        <Route path="fuel/issues" element={restricted(<FuelLandingPage />, PEOPLE_ROLES)} />
        {(["vendors", "stock", "ledger", "reports"] as const).map((section) => (
          <Route key={section} path={`fuel/${section}`} element={restricted(<FuelSectionPage section={section} />, PEOPLE_ROLES)} />
        ))}
        <Route
          path="materials"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <MaterialsLandingPage />
            </ProtectedRoute>
          }
        />
        <Route path="materials/master" element={restricted(<MaterialsSectionPage section="master" />, ["manager", "hod", "admin_hr", "super_admin"])} />
        <Route path="materials/requests" element={restricted(<MaterialRequestPage />, PEOPLE_ROLES)} />
        <Route path="materials/receipts" element={restricted(<MaterialReceiptPage />, PEOPLE_ROLES)} />
        <Route path="materials/consumption" element={restricted(<MaterialConsumptionPage />, PEOPLE_ROLES)} />
        <Route path="materials/stock" element={restricted(<MaterialsSectionPage section="stock" />, PEOPLE_ROLES)} />
        <Route path="materials/ledger" element={restricted(<MaterialsSectionPage section="ledger" />, PEOPLE_ROLES)} />
        <Route path="materials/reports" element={restricted(<MaterialsSectionPage section="reports" />, PEOPLE_ROLES)} />
        <Route
          path="material/request"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <MaterialRequestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="material/receipt"
          element={
            <ProtectedRoute
              allowedRoles={["site_staff", "manager", "hod", "admin_hr", "super_admin"]}
            >
              <MaterialReceiptPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="materials/request"
          element={<Navigate to="/material/request" replace />}
        />
        <Route
          path="materials/receipt"
          element={<Navigate to="/material/receipt" replace />}
        />
        <Route
          path="vendors"
          element={
            <ProtectedRoute
              allowedRoles={[
                "manager",
                "hod",
                "admin_hr",
                "super_admin",
                "accounts_officer",
              ]}
            >
              <VendorsLandingPage />
            </ProtectedRoute>
          }
        />
        <Route path="vendors/contracts" element={restricted(<VendorContractsPage />, VENDOR_ROLES)} />
        <Route
          path="vendors/contracts/new"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <VendorContractFormPage />
            </ProtectedRoute>
          }
        />
        <Route path="vendors/contracts/labour" element={restricted(<LabourContractsPage />, VENDOR_ROLES)} />
        <Route path="vendors/contracts/machinery" element={restricted(<VendorMachineryContractsPage />, VENDOR_ROLES)} />
        <Route path="vendors/contracts/fuel" element={restricted(<FuelContractsPage />, VENDOR_ROLES)} />
        <Route path="vendors/contracts/material" element={restricted(<MaterialContractsPage />, VENDOR_ROLES)} />
        <Route path="vendors/bills/new" element={restricted(<VendorsLandingPage />, VENDOR_SOURCE_ENTRY_ROLES)} />
        <Route path="vendors/bills/source-preview" element={restricted(<VendorBillsWorkflowPage section="source-preview" />, VENDOR_ROLES)} />
        <Route path="vendors/bills/:billId" element={restricted(<VendorBillsWorkflowPage section="bills" />, VENDOR_ROLES)} />
        <Route path="vendors/bills/:billId/edit" element={restricted(<VendorsLandingPage />, VENDOR_SOURCE_ENTRY_ROLES)} />
        <Route path="vendors/contracts/:contractId" element={restricted(<VendorContractDetailPage />, VENDOR_ROLES)} />
        <Route
          path="vendors/contracts/:contractId/edit"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <VendorContractFormPage />
            </ProtectedRoute>
          }
        />
        <Route path="vendors/bills" element={restricted(<VendorBillsWorkflowPage section="bills" />, VENDOR_ROLES)} />
        <Route path="vendors/vouchers" element={restricted(<VendorBillsWorkflowPage section="vouchers" />, VENDOR_ROLES)} />
        <Route path="vendors/payments" element={restricted(<VendorBillsWorkflowPage section="payments" />, VENDOR_ROLES)} />
        <Route path="vendors/ledger" element={restricted(<VendorBillsWorkflowPage section="ledger" />, VENDOR_ROLES)} />
        {(["master", "reports"] as const).map((section) => (
          <Route key={section} path={`vendors/${section}`} element={restricted(<VendorSectionPage section={section} />, VENDOR_ROLES)} />
        ))}
        <Route path="vendors/:vendorId" element={restricted(<VendorSectionPage section="detail" />, VENDOR_ROLES)} />
        <Route
          path="accounts"
          element={
            <ProtectedRoute allowedRoles={["accounts_officer", "super_admin"]}>
              <AccountsLandingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="accounts/claim-verification"
          element={
            <ProtectedRoute allowedRoles={["accounts_officer", "admin_hr", "super_admin"]}>
              <ClaimAccountsVerificationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="accounts/payment-queue"
          element={
            <ProtectedRoute allowedRoles={["accounts_officer", "super_admin"]}>
              <AccountsPaymentQueuePage />
            </ProtectedRoute>
          }
        />
        <Route path="accounts/payment-queue/generate-combined-voucher" element={<ProtectedRoute allowedRoles={["accounts_officer", "super_admin"]}><AccountsPaymentQueuePage /></ProtectedRoute>} />
        <Route path="accounts/vouchers" element={<ProtectedRoute allowedRoles={["accounts_officer", "super_admin"]}><AccountsVouchersPage /></ProtectedRoute>} />
        <Route path="accounts/sap-entry" element={<ProtectedRoute allowedRoles={["accounts_officer","super_admin"]}><SapEntryPage/></ProtectedRoute>}/>
        <Route path="accounts/sap-entry/pending" element={<ProtectedRoute allowedRoles={["accounts_officer","super_admin"]}><SapPendingPage/></ProtectedRoute>}/>
        <Route path="accounts/sap-entry/preview" element={<ProtectedRoute allowedRoles={["accounts_officer","super_admin"]}><SapPreviewPage/></ProtectedRoute>}/>
        <Route path="accounts/sap-entry/batches" element={<ProtectedRoute allowedRoles={["accounts_officer","super_admin"]}><SapBatchesPage/></ProtectedRoute>}/>
        <Route path="accounts/sap-entry/:batchId" element={<ProtectedRoute allowedRoles={["accounts_officer","super_admin"]}><SapBatchDetailPage/></ProtectedRoute>}/>
        <Route path="accounts/employee-ledger" element={<ProtectedRoute allowedRoles={["accounts_officer","super_admin"]}><EmployeeLedgerPage/></ProtectedRoute>}/>
        <Route path="accounts/employee-ledger/:employeeId" element={<ProtectedRoute allowedRoles={["accounts_officer","super_admin"]}><EmployeeLedgerDetailPage/></ProtectedRoute>}/>
        {(["vendor-ledger", "reconciliation", "reports"] as const).map((section) => (
          <Route
            key={section}
            path={`accounts/${section}`}
            element={
              <ProtectedRoute allowedRoles={["accounts_officer", "super_admin"]}>
                <AccountsSectionPage section={section} />
              </ProtectedRoute>
            }
          />
        ))}
        <Route
          path="reports"
          element={
            <ProtectedRoute
              allowedRoles={[
                "manager",
                "hod",
                "admin_hr",
                "super_admin",
                "accounts_officer",
              ]}
            >
              <ReportsLandingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports/:reportKey"
          element={restricted(
            <ReportDetailPage />,
            ["manager", "hod", "admin_hr", "super_admin", "accounts_officer"],
          )}
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings/organization"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <OrganizationSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings/customers"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <CustomersMasterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings/departments"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <DepartmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings/designations"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <DesignationsPage />
            </ProtectedRoute>
          }
          />
        <Route path="settings/work-types" element={<ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}><WorkTypesPage /></ProtectedRoute>} />
        <Route
          path="settings/approval-matrix"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <ApprovalMatrixPage />
            </ProtectedRoute>
          }
        />
        <Route path="reports/claims/ageing" element={<Navigate to="/reports/claim-ageing" replace/>}/>
        <Route path="reports/claims/approval-delay" element={<Navigate to="/reports/claim-approval-delay" replace/>}/>
        <Route path="reports/claims/project-cost" element={<Navigate to="/reports/project-claim-cost" replace/>}/>
        <Route path="reports/claims/employee-ledger" element={<Navigate to="/reports/employee-claim-ledger" replace/>}/>
        <Route path="reports/claims/deductions" element={<Navigate to="/reports/claim-deductions" replace/>}/>
        <Route path="reports/accounts/payment-pending" element={<Navigate to="/reports/accounts-payment-pending" replace/>}/>
        <Route path="reports/accounts/sap-export" element={<Navigate to="/reports/accounts-sap-export" replace/>}/>
        <Route path="settings/sap-mapping" element={<ProtectedRoute allowedRoles={["super_admin"]}><SapMappingPage/></ProtectedRoute>}/>
        <Route path="settings/signatures" element={<ProtectedRoute allowedRoles={["admin_hr","super_admin"]}><SignaturesPage/></ProtectedRoute>}/>
        <Route
          path="settings/delegations"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <DelegationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings/email"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <EmailSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings/expense-categories"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <ExpenseCategoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings/project-cost-codes"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <ProjectCostCodesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <ProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/new"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <ProjectFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/edit"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <ProjectFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/users"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <ProjectAssignmentsPage mode="users" />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/departments"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <ProjectAssignmentsPage mode="departments" />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId/cost-codes"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <ProjectAssignmentsPage mode="cost-codes" />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:projectId"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <ProjectDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users/hierarchy"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "hod", "super_admin"]}>
              <UserHierarchyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users/new"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <CreateUserPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users/:userId/assign-projects"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <UserProjectAssignmentPage />
            </ProtectedRoute>
          }
        />
        <Route path="users/:userId/advance" element={<ProtectedRoute allowedRoles={["accounts_officer","super_admin"]}><UserAdvancePage/></ProtectedRoute>}/>
        <Route path="users/:userId/signature" element={<ProtectedRoute allowedRoles={["admin_hr","super_admin"]}><UserSignaturePage/></ProtectedRoute>}/>
        <Route
          path="users/:userId/edit"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <EditUserPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users/:userId"
          element={
            <ProtectedRoute allowedRoles={["admin_hr", "super_admin"]}>
              <UserDetailPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}
