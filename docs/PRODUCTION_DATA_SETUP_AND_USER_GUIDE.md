# Site Connect Production Data Setup and User Guide

## 1. Purpose

This guide explains how to configure Site Connect from an empty database, enter master and operational data, assign users and projects, operate approvals, and diagnose rejected or incomplete workflows. It corresponds to the production-like validation dataset covering 123 application tables and 128 automated tests.

The downloadable `site-connect-complete-template.json` is a reference and phased-import workbook in JSON form. Create records in its numbered order. Never manually import generated approvals, ledgers, audit entries, notification deliveries, or stock movements.

## 2. First records to create

Use this dependency order:

1. Organisation and company settings
2. Departments and designations
3. Roles and permissions
4. Customers
5. Projects, project coordinates, and geofence radius
6. Common and project cost codes, work types, and expense categories
7. Super Admin, Admin/HR, Accounts, HOD, Project Managers, and site users
8. Reporting manager, HOD, department, and project assignments
9. Approval matrices and temporary delegations
10. Shifts, holidays, and leave types
11. Vendors and contracts
12. Labour, machinery, fuel, and material masters
13. SAP mappings and finance settings
14. Operational transactions

If a parent record is missing, stop. Do not create a child using a made-up ID.

## 3. Organisation and settings

Required fields: organisation code, organisation name, legal name, address, city, state, pincode, support email, currency, and timezone. GST and PAN should use the legal entity's registered values.

Example: `AIP`, `Aurelia Infrastructure & Projects`, currency `INR`, timezone `Asia/Kolkata`.

In Email Settings, enter the deployed HTTPS application URL as `approvalBaseUrl`. Approval emails use this URL. A corporate website URL is not a substitute. Configure email events only after SMTP status and a test email pass.

## 4. Departments, designations, roles, and users

Department fields: unique code, name, description, and status. Designation fields: unique code, name, owning department, hierarchy rank, and description.

Supported application roles:

| Role | Main responsibility |
|---|---|
| Super Admin | Final authority, settings, organisation-wide access |
| Admin/HR | User administration, verification, attendance and HR masters |
| Accounts Officer | Verification, vouchers, SAP export and payments |
| HOD | Department approval and oversight |
| Project Manager | Assigned-project approval and operations |
| Site Staff / Employee | Assigned-project entry and personal workflows |

User fields: employee code, first/last/full name, email, phone, role, department, designation, employment type, joining date, reporting manager, HOD, primary project, additional projects, and status.

Create managers before their reportees. Email and employee code must be unique. A user without an active project assignment cannot submit project attendance or project-scoped operational records. After a database reset, users must sign in again because old browser sessions are invalid.

## 5. Customers and projects

Customer fields include code, legal/customer name, contact, email, phone, GST, address, and payment terms.

Project fields include code, name, customer, location/address, dates, budget, primary department, latitude, longitude, geofence radius, and status. Latitude/longitude are mandatory before field attendance begins. Confirm coordinates at the actual check-in point.

Project assignment fields: employee, project, department, assignment type (`primary` or `secondary`), start/end date, and active status. RLS restricts site users to assigned projects. Admin, Super Admin, and authorised finance roles retain organisation-wide processing visibility.

## 6. Approval configuration

Configure matrices by module, department/project, amount range, sequence, and approver role/user. Avoid overlapping active amount ranges.

Typical claim flow:

`Draft → Submitted → Admin verification → Manager approval → Final/HOD approval → Accounts verification → Voucher pending → SAP export → Payment pending → Paid`

At any approval stage:

- Approve moves the record to the next configured stage.
- Reject closes the request with mandatory remarks.
- Request changes returns it to the submitter while preserving history.
- A query requests clarification or a missing attachment without losing the claim.
- Delegation temporarily substitutes an approver within its effective dates.

If no matching approval rule exists, do not bypass the workflow. Correct the matrix or project/department mapping and resubmit.

## 7. Attendance

Before use, configure shifts, project coordinates, geofence radius, and active project assignments.

Check-in requires assigned project, GPS coordinates, accuracy of 100 metres or better, current capture timestamp, and a live selfie. The server validates the geofence again; UI validation alone is not trusted. Selfies are private and visible only to the owner and authorised management roles.

Offline punches are stored on the device with a unique mutation ID and synchronised after connectivity returns. Duplicate synchronisation returns the original result instead of creating another punch.

Failure cases:

- Outside geofence: verify selected project and site coordinates; use an authorised correction workflow, not fake coordinates.
- Poor GPS accuracy: move outdoors and recapture.
- No selfie: capture a new live image.
- Already checked in/out: review today's record; Admin may correct with an audit reason.
- Offline item fails later: inspect the pending item because assignment, geofence, or date validity may have changed.

## 8. Leave

Create leave types and opening entitlements first. A request requires employee, leave type, dates, duration, and reason. Attachments are required when configured, for example medical leave.

Flow: `Draft/Submitted → Manager/HOD review → Approved or Rejected → Balance transaction`.

The system must reject overlapping leave, insufficient balance, invalid date order, or missing mandatory proof. Cancellation or adjustment should create a balance transaction rather than editing history silently.

## 9. Claims and expenses

Create expense categories, projects, cost codes, customer/work type mapping, and approval rules first.

Claim header fields: employee, project, department, title, period, customer, work type, remarks, and status. Item fields: expense date, category, description, cost code, bill type, claimed amount, tax data where applicable, and attachment/reference.

With-bill items require proof. Offline claim data can be queued; attachments should be uploaded when connectivity is restored. Accounts verifies approved versus payable amount, records deductions with reasons, generates the voucher, exports valid SAP mappings, and records payment references.

Query flow: reviewer raises a query → assignee receives notification/email → assignee responds and attaches the missing document → attachment is linked to the same claim → reviewer resolves the query. Do not create a second claim for missing evidence.

## 10. Vendors and contracts

Vendor fields: unique code/name, type, GST, PAN, contact, email, phone, full address, bank details, payment terms, and status. Verify bank changes separately.

Contract fields: number, vendor, project, department, type, title/scope, dates, value, billing cycle/basis, tax, retention, payment terms, rate cards, and status.

Contract types are separated by module: labour, machinery, fuel, material, service, and general vendor contracts. A labour page must not display machinery/fuel contracts. Bills must reference the correct vendor, project, contract, period, and source records. Admin/Accounts performs bill processing with full source detail.

## 11. Casual labour

Create vendor → labour contract/rates → payees → workers → roster/allocation. Worker fields include code, identity/contact information, trade, rate, joining date, project/vendor, bank/payee mapping, and status.

Daily flow: allocation → worker attendance → supervisor verification → approval → advances/deductions → bill generation → vendor/accounting processing.

Invalid scenarios include duplicate worker/date attendance, unapproved attendance in a bill, deduction exceeding payable amount, inactive worker/vendor, or a rate outside the active contract.

## 12. Machinery and fuel

Machinery requires vendor/contract, asset code, registration, ownership, project, billing basis/rate, and status. Operational records include opening/closing meter, working/idle/breakdown hours, operator, fuel consumption, and evidence. Bills derive from approved usage, not manually typed totals.

Fuel requires vendor/contract, project, fuel type, rate, deposits, opening stock, receipts, issues, and supporting invoice. Stock ledger is generated from approved receipts/issues. Reject negative stock, duplicate invoice, project mismatch, or issue to an invalid asset.

## 13. Materials and DPR

Material master fields: code, name, category, unit, reorder level, and status. Flow: request → approval → receipt/inspection → stock ledger → issue/consumption → damage/wastage with reason.

DPR fields include project, report date, weather, summary, manpower, activities, quantities, machinery, materials, issues, photos, delays, safety observations, and next-day plan. Only assigned site members should submit; manager/HOD reviews project-scoped data.

## 14. Tasks, documents, messaging, and notifications

Tasks require project, title, description, assignee, reporter, priority, due date, status, comments, attachments, and activity history.

Project broadcast conversations are created/synchronised from active project assignments. Direct and group conversations use explicit members. Message RLS restricts content to members; Admin access must follow policy rather than bypassing private conversations.

In-app realtime notifications and email are available. Browser/mobile push additionally requires HTTPS, a service worker, and VAPID or Firebase credentials. Enabling the setting alone cannot deliver push messages.

## 15. Import and export

Open **Settings → Organisation**:

- **Download Sample Template** downloads the complete dependency-ordered reference template.
- **Export Current Organisation** exports current organisation, departments, projects, users, and assignments.
- **Import JSON Package** imports supported master sections in dependency order.

Use stable business codes for references. Validate in a non-production organisation first. Operational examples in the template explain fields; they should be created through their screens/workflows so triggers, approvals, ledgers, notifications, and audits run correctly.

## 16. System-generated data—never import manually

Do not manually populate approval history, email action tokens, ledgers, stock ledgers, voucher items, payments, notifications, delivery attempts, read receipts, audit logs, or processed offline mutations. Their parent workflow creates them. Manual insertion can produce paid claims without approvals, stock without receipts, or bills without source attendance.

## 17. Validation checklist

After each module:

1. Confirm required fields and unique codes.
2. Test an authorised user and an unauthorised user.
3. Test valid, missing-field, duplicate, cross-project, and invalid-status inputs.
4. Confirm parent/child records and absence of orphans.
5. Confirm RLS visibility for site user, manager, HOD, Admin, Accounts, and Super Admin.
6. Confirm notifications and audit history.
7. Confirm dashboard totals equal detail records.
8. Confirm rejection/change/query paths before testing approval.
9. Confirm generated ledger/voucher/stock records reconcile to their sources.
10. Export and retain a configuration snapshot after acceptance.

## 18. Go-live rule

Do not mark a module ready merely because records can be inserted. It is ready only when the valid workflow, invalid inputs, every approval stage, role visibility, notifications, generated financial/stock records, and reversal/correction paths have all passed.
