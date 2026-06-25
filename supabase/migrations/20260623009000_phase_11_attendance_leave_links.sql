-- Phase 11: final attendance statuses and leave type links.

alter type public.attendance_status add value if not exists 'travelling';
alter type public.attendance_status add value if not exists 'holiday_present';
alter type public.attendance_status add value if not exists 'week_off_present';
alter type public.attendance_status add value if not exists 'night_shift';
alter type public.attendance_status add value if not exists 'missed_correction';

alter table public.dpr_activities
  add column if not exists custom_machines jsonb not null default '[]'::jsonb;

insert into public.leave_types (
  id,
  code,
  name,
  annual_allowance,
  carry_forward,
  requires_document,
  status
)
values
  ('00000000-0000-4000-8000-000000000505', 'PL', 'Privilege Leave', 18, true, false, 'active'),
  ('00000000-0000-4000-8000-000000000506', 'LWP', 'Leave Without Pay', 365, false, false, 'active'),
  ('00000000-0000-4000-8000-000000000507', 'CO', 'Comp Off', 0, true, false, 'active')
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  annual_allowance = excluded.annual_allowance,
  carry_forward = excluded.carry_forward,
  requires_document = excluded.requires_document,
  status = excluded.status;
