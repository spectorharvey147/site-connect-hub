# Site Connect

Site Connect is a React, TypeScript, Tailwind and Supabase construction site management app. The current build includes Phase 1 core infrastructure through Reports, Settings and User Management.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test
```

## Environment

Copy `.env.example` to `.env.local` and add the production Supabase keys:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

The application does not provide demo or fallback authentication. Login remains disabled until these variables are configured.

## Phase 1 Scope

- Vite + React 18 + TypeScript scaffold
- Tailwind design tokens matching the Site Connect specification
- Supabase-only production authentication
- Login, forgot password, reset password and first admin setup pages
- Local session handling, remember-me support and logout
- Role-based protected routes and module visibility
- Desktop sidebar, sticky header, user menu and mobile bottom navigation
- Home module launcher and role-based dashboard
- Initial Supabase migration for roles, profiles, sessions, projects, notifications and audit logs

## Claims & Finance Scope

- Claims landing page, history, detail and reports
- Multi-step claim submission with items, attachments, draft and submit actions
- Admin verification, manager approval and final approval queues
- Approve, reduce, reject and request-change decisions with timeline entries
- Payment voucher generation, PDF voucher export and mark-paid flow
- User balance, employee ledger statement, transaction register and CSV exports
- Claims Supabase migration with RLS for claims, items, attachments, approvals, vouchers, payments and ledgers
- Supabase-backed claim CRUD, approval review, voucher/payment, ledger, transaction and balance service paths with demo fallback

## Attendance Scope

- Attendance landing page with today status and monthly metrics
- Quick check-in/check-out with GPS capture UI and fallback location
- Manual attendance submission with validation
- Attendance register calendar with PDF and Excel exports
- Admin console for attendance corrections with audit logging
- Monthly summary dashboard with charts
- Supabase migration for shifts and attendance with RLS
- Supabase-backed attendance register, quick check-in/out, manual corrections, summaries and user list loading with demo fallback

## Leave Management Scope

- Leave landing page with balances and quick actions
- Apply leave form with working-day calculation, document upload and validation
- Leave history with leave slip PDF export
- Manager/Super Admin approval queue with comments
- Holiday calendar used by leave day calculation
- Leave policy master view
- Supabase migration for leave types, holidays, applications, attachments and approval history
- Supabase-backed leave listing, balances, application submission, approval decisions and approval history with demo fallback

## Task Management Scope

- Task landing page with open, overdue, completed and priority metrics
- Manager/Admin task creation with assignee, project, priority, due date, estimated hours and attachments
- Filterable task list by search, status, priority, assignee, project and overdue state
- Task detail page with description, attachments, comments, status updates and progress tracking
- Tracking dashboard with status distribution, priority mix, team workload and overdue task list
- Local activity/audit log for created tasks, comments and status changes
- Supabase migration for tasks, comments, attachments, activity history and RLS policies
- Supabase-backed task list/detail, creation, status updates, comments, activity history and assignable-user loading with demo fallback

## Messaging Scope

- Inbox with conversation search, unread/group/archive tabs and summary metrics
- 1:1, group and project conversation creation with participant selection
- Conversation view with message search, member count, project context and side conversation list
- File/image attachments in initial and follow-up messages
- Quote replies, message reactions and sent/read receipt labels
- Conversation mute, pin and archive controls per participant
- Supabase migration for conversations, members, messages, attachments, read receipts, reactions and RLS policies

## Field Operations Scope

- Field Operations landing page with DPR, issue, photo and monthly metrics
- DPR submission form with project/date/shift, weather, repeatable activities, labour counts, machinery and comments
- Issue/challenge capture with type, severity, status, description and resolution notes
- Next-day plan, planned manpower/equipment and site photo upload metadata
- DPR history with month/project/status/search filters plus PDF and CSV exports
- DPR detail page with labour summary, activity breakdown, issue list, photos and manager/admin review actions
- Field reports dashboard with activity progress, issue mix and pending issue DPRs
- Supabase migration for DPR reports, activities, issues, photos and RLS policies

## Casual Labour Scope

- Casual Labour landing page with active workers, submitted records, monthly cost and pending approval metrics
- Labour master for creating contractor workers by category, vendor and default daily rate
- Attendance entry form with project, vendor, date, worker rows, attendance status, timing, daily rate and overtime
- Work allocation capture for area, description and planned male/female/supervisor counts
- Auto-calculated daily wage summary with base cost, overtime cost and total cost
- Wage register with month/project/vendor/status filters, CSV export and manager/admin approval action
- Supabase migration for labour vendors, worker master, attendance headers, attendance rows and RLS policies

## Machinery Scope

- Machinery landing page with active machine, contract, utilization and breakdown metrics
- Contract register with vendor, machine type, multi-machine selection, period, billing cycle, rate, fuel scope and driver cost scope
- Daily machine log form with project, date, machine auto-fill, usage sessions, meter readings, breakdown details and remarks
- Machine log register with status, vendor, ownership, billable hours and breakdown visibility
- Machinery reports for utilization by machine type, breakdown logs and active contract coverage
- Supabase migration for machinery vendors, assets, contracts, logs, usage sessions and RLS policies

## Fuel Management Scope

- Fuel landing page with diesel stock, monthly receipt, issue and purchase cost metrics
- Receipt purchase log with project, date, fuel type, vendor, source, quantity, unit, rate, total, reference and remarks
- Fuel issue form with opening stock, repeatable machine dispensing rows, total issues and auto closing stock
- Recent receipt and issue registers with status visibility
- Fuel reports with daily summary, machine-wise consumption and vendor purchase tracking data
- Supabase migration for fuel vendors, receipts, issues, issue rows and RLS policies

## Materials Scope

- Materials landing page with open requests, approved requests, received count, damaged receipt and estimate metrics
- Material request form with project, request date, required date, priority, repeatable material items, specifications, estimated cost and attachments
- Material receipt form with linked request support, supplier invoice, challan, received quantities, condition and inspection checklist
- Request and receipt registers with status and priority badges
- Inventory movement report comparing requested, received, damaged and open quantities by material
- Supabase migration for material masters, vendors, requests, request items, receipts, receipt items, attachments and RLS policies

## Vendor Management Scope

- Vendor landing page with active vendor, pending bill, outstanding balance and paid-this-month metrics
- Vendor master creation with code, type, contact, GST, address, payment terms and status
- Vendor bill entry with project, bill type, billing period, invoice, GST, other charges, additions/deductions and total calculation
- Bill lifecycle actions for verification, approval, voucher generation and payment processing by role
- Vendor balances and ledger movements for bill approval, voucher generation and payment settlement
- Supabase migration for vendors, vendor bills, vendor vouchers, vendor payments, vendor ledger entries and RLS policies

## Reports & Admin Scope

- Reports dashboard with cross-module finance, operations, attendance, approvals and exception summaries
- CSV export for the cross-module report view
- Settings page for company profile, workflow limits, notification rules and master defaults
- User Management page for invitations, role assignment, status updates and project access
- Supabase migration for app settings, report exports and user invitations with RLS policies
- Supabase-backed app settings load/save path with demo fallback

## Organization Hierarchy & Approval Matrix Scope

- Organization master with legal, GST/PAN, address, support, currency and timezone details
- Nested department master with per-department HOD assignment
- Designation master with optional department link and hierarchy rank
- HOD role separated from Super Admin / System Owner
- User profiles extended with organization, employee code, department, designation, reporting manager, HOD, employment type and project assignment fields
- User hierarchy tree at `/users/hierarchy` with department filter, search and CSV export
- Approval matrix page at `/settings/approval-matrix` for workflow, department, amount range and approver-level rules
- Approval delegation page at `/settings/delegations` for alternate approvers by workflow/date range
- Claims and leave now store organization/department/manager/HOD snapshots and resolved approval paths
- Supabase migration adds organizations, designations, user project assignments, approval matrices, delegations, hierarchy change logs, transaction snapshot columns, storage buckets and RLS policies
- Seed data includes one organization, Operations/Finance/Accounts/HR/Civil departments, designations and example approval rules

## Supabase

Apply migrations from `supabase/migrations`, then seed base company/project data with `supabase/seed.sql`.

The initial migration enables RLS on core tables and seeds the five required roles:

- Site Staff / User
- Manager
- HOD / Department Head
- Admin / HR
- Super Admin / Finance Head
- Accounts Officer

## Next Phase

All specified module phases are now scaffolded with working demo-mode flows. The next step is review, QA hardening and production Supabase integration.
