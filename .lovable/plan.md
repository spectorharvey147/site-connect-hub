# Site Connect — Codebase Audit Report

Read-only review. No files modified. Findings grouped by severity with file refs and recommended fixes.

## Inventory
- 95 page files across 18 modules; ~120 routes in `src/routes/AppRoutes.tsx`
- 42 service/repository files; 21 test files (services only — no page/component tests)
- 4 edge functions; 37 SQL migrations; 104 tables (82 with RLS, **22 without**)

---

## 🔴 Critical

**C-1 — 22 tables ship without RLS.** Tables include `casual_labour_attendance_items`, `casual_labour_bills`, `casual_labour_work_allocations`, `dpr_reports`, `fuel_cash_expenses`, `fuel_contracts`, `fuel_stock_ledger`, `fuel_vendor_deposits`, `fuel_vendor_ledger`, `labour_advance_deductions`, `labour_contract_terms`, `labour_payees`, `labour_rosters`, `machine_breakdowns`, `machinery_contract_machines`, `machinery_contract_terms`, `material_consumption`, `material_damage_wastage`, `material_stock_ledger`, `vendor_bill_items`, `vendor_contract_rate_cards`, `vendor_ledgers`. Any authenticated user can read/write cross-org. **Fix:** `ENABLE ROW LEVEL SECURITY` + org-scoped policies + explicit GRANTs.

**C-2 — Hardcoded demo password in client bundle.** `src/constants/demoData.ts:8` exports `DEMO_PASSWORD = "SiteConnect@123"` plus full `DEMO_USERS` (roles, UUIDs). If `VITE_SUPABASE_URL` is ever unset in prod, app falls through to demo auth with known credentials. **Fix:** gate behind explicit `VITE_DEMO_MODE` flag; tree-shake from prod builds.

**C-3 — Edge functions use `Access-Control-Allow-Origin: *`.** `supabase/functions/setup-initial-admin/index.ts:5-8` (also `provision-user`, `send-notification`) — these run with `service_role`. **Fix:** restrict to app domain via env var.

**C-4 — `role_id` trusted from `user_profiles` without write protection.** `src/services/authService.ts:199`, `supabase/functions/provision-user/index.ts:36`. If a row-update RLS hole exists, users can self-escalate to super_admin. **Fix:** add RLS `WITH CHECK` or `BEFORE UPDATE` trigger forbidding self-changes to `role_id`.

**C-5 — `retry-notification-emails` uses non-null assertions on env vars and has no CORS.** `supabase/functions/retry-notification-emails/index.ts:13-16`. Crashes silently if secrets missing. **Fix:** guard checks + CORS headers.

---

## 🟠 High

**H-1 — Password reset accepts any access token.** `src/services/authService.ts:396-408` parses `access_token`/`refresh_token` from hash but does not require `type=recovery`. **Fix:** add `hashParams.get("type") === "recovery"` guard before `setSession`.

**H-2 — Session JSON (incl. access token & role) persisted in `localStorage`.** `authService.ts:61-63`. XSS-stealable; client-set `expiresAt` not tied to JWT expiry. **Fix:** rely on Supabase SDK session storage in Supabase mode.

**H-3 — Demo `localStorage` data bleeds into Supabase mode.** `vendorsService.ts:71-91`, `machineryService.ts:79-99`, `leaveService.ts:305-322`, `fuelService.ts:85-105`, `fieldOperationsService.ts:247-269`, `taskService.ts:276-293`. `runtimeBootstrap` cleanup runs once and only when project marker changes. **Fix:** ensure `prepareRuntimeStorage()` always runs before first read; clear demo keys when entering Supabase mode.

**H-4 — `provision-user` does not whitelist `role` input.** `supabase/functions/provision-user/index.ts:66` writes raw `input.role` into `role_id`. **Fix:** validate against allowed enum.

**H-5 — `auditService` swallows Supabase errors.** `src/services/auditService.ts:38-44` — insert result never destructured. **Fix:** check `{ error }` and log.

**H-6 — `window.location.href` / `.assign()` bypasses React Router.** `src/pages/claims/ClaimsLandingPage.tsx:90`, `src/pages/vendors/VendorBillsWorkflowPage.tsx:68`. Causes full reloads. **Fix:** `useNavigate()`.

**H-7 — `UserFormPage` has no schema validation.** `src/pages/users/UserFormPage.tsx` accepts empty employee codes/malformed emails on create. **Fix:** `react-hook-form` + `zod`.

**H-8 — `VendorBillsWorkflowPage` fetches 4 collections every mount.** `VendorBillsWorkflowPage.tsx:32-42` regardless of `section`. Same anti-pattern in `AccountsSectionPage`. **Fix:** lazy-load per section.

---

## 🟡 Medium

- **M-1** Tables in C-1 likely also missing explicit GRANTs to `authenticated`/`service_role`.
- **M-2** `tasks/:taskId` declared before `tasks/create` in `AppRoutes.tsx:450,453`. Works today but fragile.
- **M-3** `/dpr/:reportId` (`AppRoutes.tsx:536-544`) renders detail directly instead of redirecting to `/field-operations/:reportId`.
- **M-4** `fuel/receipts` and `fuel/issues` (`AppRoutes.tsx:647-648`) render `FuelLandingPage` instead of `FuelSectionPage`.
- **M-5** `casual-labour/reports` (`AppRoutes.tsx:589`) renders `LabourRegisterPage` (mislabeled).
- **M-6** `vendors/bills/new` and `vendors/bills/:billId/edit` (`AppRoutes.tsx:726,729`) render `VendorsLandingPage` — no form wired.
- **M-7** `AccountsSectionPage` fires 5+ service calls in one `Promise.all` regardless of section.
- **M-8** No pagination on list pages (`UsersPage`, `ProjectsPage`, `VendorContractsPage`, …).
- **M-9** `index` used as React `key` in `VendorBillsWorkflowPage.tsx:83`, `VendorSectionPage.tsx:51`, `MaterialsSectionPage.tsx:58`.
- **M-10** `/setup-admin` (`AppRoutes.tsx:295`) accessible to logged-in users; no route-level guard.
- **M-11** `AuthContext` never subscribes to `supabase.auth.onAuthStateChange`. Token refreshes/cross-tab logins not reflected.
- **M-12** Hardcoded hex colors in core layout: `MobileNav.tsx:11`, `TopBar.tsx:11`, `Button.tsx:23,29` (`#00264D`, `#0052A3`). Should use design tokens.
- **M-13** `offlineQueueService` has `enqueue`/`list`/`remove` but no `flush()` wired to `online` event. Queue grows forever.
- **M-14** Zero tests for `authService`, `profileService`, `dashboardService`, `notificationService`, `auditService`, `organizationService`, `approvalMatrixService`.

---

## 🔵 Low

- **L-1** Hardcoded `border-[#D0D0D0]` in `UserFormPage.tsx:23` — use `border-surface-border`.
- **L-2** `FuelSectionPage` returns `null` while loading (blank page).
- **L-3** `VendorBillsWorkflowPage` no loading state — table flashes empty.
- **L-4** `AppRoutes.tsx:1-70` imports auth/dashboard/home/tasks/claims/attendance/leave eagerly; only some modules are `lazy()`.
- **L-5** `UserFormPage` renders nothing while fetching.
- **L-6** `capacitor.config.ts` missing `iosScheme: "https"` — can break Supabase cookies on iOS.
- **L-7** `.env.example` missing optional `VITE_APP_URL`/`SITE_URL` for non-browser redirect overrides.
- **L-8** `CRON_SECRET` referenced in `retry-notification-emails/index.ts:4` but not in `.env.example`.
- **L-9** `ApprovalMatrixPage.tsx:224` uses `key={index}`; delete-level action not implemented.
- **L-10** No standalone `typecheck` script in `package.json` — CI must run full build to catch TS errors.

---

## Top 10 priorities

| # | Issue | Severity |
|---|---|---|
| 1 | Add RLS + GRANTs to 22 unprotected tables (C-1) | Critical |
| 2 | Gate demo mode behind explicit env flag; strip from prod (C-2) | Critical |
| 3 | Restrict edge-function CORS to app domain (C-3) | Critical |
| 4 | Lock down `role_id` writes on `user_profiles` (C-4) | Critical |
| 5 | Validate `role` input in `provision-user` (H-4) | High |
| 6 | Add `type=recovery` guard to reset flow (H-1) | High |
| 7 | Subscribe to `onAuthStateChange` in `AuthProvider` (M-11) | Med-High |
| 8 | Replace `window.location.*` with `useNavigate()` (H-6) | High |
| 9 | Wire correct targets for `fuel/receipts`, `fuel/issues`, `casual-labour/reports`, `vendors/bills/new`/`edit` (M-4/5/6) | Medium |
| 10 | Surface errors in `auditService` (H-5) | High |

---

**Next step:** approve this plan to switch to build mode, then tell me which severity tier (or specific items) to start fixing. I recommend tackling C-1 through C-4 first as a single hardening pass.
