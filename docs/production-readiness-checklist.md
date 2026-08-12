# Production Readiness Checklist

## Phase 1 — Roles, labels and permission source of truth

| Requirement | Status | Notes |
| --- | --- | --- |
| Replace old Super Admin finance-head labels | IMPLEMENTED | Explicit legacy label scan is clean across `src`, `supabase`, `README.md`, and `docs`. |
| Use HOD / Department Head, Pending HOD Approval and HOD Approved labels | IMPLEMENTED | Existing HOD labels retained; claim labels distinguish HOD approval from Master Exception Approval. |
| Use Accounts Officer and Accounts Verification labels | IMPLEMENTED | Existing Accounts labels retained in constants and pages. |
| Add centralized role permission helpers | IMPLEMENTED | Added `src/permissions/rolePermissions.ts`. |
| Add centralized claim permission helpers | IMPLEMENTED | Added `src/permissions/claimPermissions.ts`. |
| Add centralized accounts permission helpers | IMPLEMENTED | Added `src/permissions/accountsPermissions.ts`. |
| Add centralized route permission helpers | IMPLEMENTED | Added `src/permissions/routePermissions.ts`; route guard now uses it. |
| Admin Verification action is `admin_hr` only | TESTED | Covered by targeted permission tests and wired through `canPerformClaimAction`. |
| Manager Approval action is `manager` only or valid delegate | TESTED | Covered by targeted permission tests and wired through `canPerformClaimAction`. |
| HOD Approval action is `hod` only or valid delegate | TESTED | Covered by targeted permission tests and wired through `canPerformClaimAction`. |
| Master Exception Approval is `super_admin` only for explicit matrix path | TESTED | `canApproveClaimAsMaster` requires `final_approval_pending` and an approval path containing `super_admin`. |
| Accounts mutations are `accounts_officer` only | TESTED | Frontend helpers, service guards and existing DB trigger migration align on Accounts Officer mutations. |
| Super Admin has view-only access to operational queues | IMPLEMENTED | Review, accounts verification, voucher, payment and advance action buttons are hidden for Super Admin. |
| Remove Super Admin from normal mutation service permissions | IMPLEMENTED | Claim, voucher, SAP, payment and advance service guards now use centralized helpers. |
| Targeted role tests added | IMPLEMENTED | Added `src/permissions/permissions.test.ts`. |
| Lint passes | NOT STARTED | To be run during phase verification. |
| All tests pass | NOT STARTED | To be run during phase verification. |
| Build passes | NOT STARTED | To be run during phase verification. |
| Production audit passes | NOT STARTED | To be run during phase verification. |
| Local Supabase migration list | NOT STARTED | To be run if Supabase CLI is available. |
| Local Supabase reset | LIVE TEST PENDING | Must not run against production; only run when a local/test Supabase environment is confirmed. |
