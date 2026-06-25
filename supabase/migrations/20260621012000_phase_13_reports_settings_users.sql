create table if not exists public.app_settings (
  id text primary key default 'default',
  company jsonb not null default '{}'::jsonb,
  workflow jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  masters jsonb not null default '{}'::jsonb,
  updated_by uuid references public.user_profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(),
  report_name text not null,
  filters jsonb not null default '{}'::jsonb,
  exported_by uuid not null references public.user_profiles(id),
  exported_at timestamptz not null default now()
);

create table if not exists public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  phone text,
  role_id text not null default 'site_staff' references public.roles(id),
  department text,
  manager_id uuid references public.user_profiles(id),
  project_ids uuid[] not null default '{}',
  status text not null default 'invited',
  invited_by uuid not null references public.user_profiles(id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists idx_report_exports_exported_by on public.report_exports(exported_by);
create index if not exists idx_user_invitations_invited_by on public.user_invitations(invited_by);
create index if not exists idx_user_invitations_status on public.user_invitations(status);

alter table public.app_settings enable row level security;
alter table public.report_exports enable row level security;
alter table public.user_invitations enable row level security;

drop policy if exists "settings visible to authenticated users" on public.app_settings;
create policy "settings visible to authenticated users"
on public.app_settings for select
to authenticated
using (true);

drop policy if exists "settings managed by super admin" on public.app_settings;
create policy "settings managed by super admin"
on public.app_settings for all
to authenticated
using (public.current_user_role() = 'super_admin')
with check (public.current_user_role() = 'super_admin');

drop policy if exists "report exports visible to office roles" on public.report_exports;
create policy "report exports visible to office roles"
on public.report_exports for select
to authenticated
using (public.current_user_role() in ('manager', 'admin_hr', 'super_admin', 'accounts_officer'));

drop policy if exists "report exports created by office roles" on public.report_exports;
create policy "report exports created by office roles"
on public.report_exports for insert
to authenticated
with check (
  exported_by = auth.uid()
  and public.current_user_role() in ('manager', 'admin_hr', 'super_admin', 'accounts_officer')
);

drop policy if exists "user invitations visible to admin roles" on public.user_invitations;
create policy "user invitations visible to admin roles"
on public.user_invitations for select
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'));

drop policy if exists "user invitations managed by admin roles" on public.user_invitations;
create policy "user invitations managed by admin roles"
on public.user_invitations for all
to authenticated
using (public.current_user_role() in ('admin_hr', 'super_admin'))
with check (
  invited_by = auth.uid()
  and public.current_user_role() in ('admin_hr', 'super_admin')
);

insert into public.app_settings (id, company, workflow, notifications, masters)
values (
  'default',
  '{"companyName":"IPI Site Connect","supportEmail":"support@siteconnect.local","supportPhone":"+91 98765 10000","currency":"INR","timezone":"Asia/Kolkata","fiscalYearStart":"04-01","logoUrl":""}'::jsonb,
  '{"claimAdminVerificationRequired":true,"claimManagerApprovalLimit":50000,"claimFinalApprovalLimit":100000,"leaveManagerApprovalRequired":true,"vendorBillAutoVoucher":false,"attendanceGeoFenceMeters":250}'::jsonb,
  '{"emailEnabled":true,"pushEnabled":true,"dailyDigestTime":"18:00","escalationHours":24}'::jsonb,
  '{"defaultProjectId":"project-metro","defaultShiftId":"shift-general","defaultLeavePolicy":"standard","defaultPaymentTerms":"15 days"}'::jsonb
)
on conflict (id) do nothing;
