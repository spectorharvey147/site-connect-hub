-- Production-safe reset seed.
-- Keep this file free of organizations, profiles, Auth users, and operational data.
-- Optional local demonstration data lives in seed.demo.sql and must be loaded explicitly.

begin;

insert into public.roles (id, name, short_name, description, rank) values
  ('site_staff', 'Site Staff / User', 'User', 'Users who submit operational records.', 10),
  ('manager', 'Reporting Manager', 'Manager', 'Assigned manager approval authority.', 30),
  ('hod', 'Department Head', 'HOD', 'Normal final operational approver.', 35),
  ('admin_hr', 'Administration and HR', 'Admin', 'Administration and verification authority.', 40),
  ('accounts_officer', 'Accounts Officer', 'Accounts', 'Accounts verification, vouchers, SAP, and payments.', 50),
  ('super_admin', 'Super Administrator', 'Super Admin', 'Organization owner, system configuration, audit, and exceptional intervention authority.', 100)
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  description = excluded.description,
  rank = excluded.rank;

commit;
