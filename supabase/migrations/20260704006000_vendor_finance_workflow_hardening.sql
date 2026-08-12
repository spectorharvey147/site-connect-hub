-- One active payment voucher per vendor bill.
create unique index if not exists vendor_payment_vouchers_bill_uidx
  on public.vendor_payment_vouchers(vendor_bill_id);

drop policy if exists "vendor bills visible to office roles" on public.vendor_bills;
create policy "vendor bills visible by workflow scope"
on public.vendor_bills for select to authenticated
using (
  deleted_at is null
  and organization_id = public.current_organization_id()
  and (
    public.current_user_role() in ('admin_hr','super_admin','accounts_officer')
    or (public.current_user_role() = 'hod' and department_id = (select department_id from public.user_profiles where id=auth.uid()))
    or (public.current_user_role() = 'manager' and exists (
      select 1 from public.user_project_assignments a
      where a.user_id=auth.uid() and a.project_id=vendor_bills.project_id and a.status='active'
    ))
  )
);

drop policy if exists "vendor bills created by office roles" on public.vendor_bills;
create policy "vendor bills created by workflow roles"
on public.vendor_bills for insert to authenticated
with check (
  organization_id = public.current_organization_id()
  and submitted_by = auth.uid()
  and created_by = auth.uid()
  and public.current_user_role() in ('manager','hod','admin_hr','super_admin')
);

create or replace function public.validate_vendor_bill_status_transition()
returns trigger language plpgsql security definer set search_path=public as $$
declare actor_role text := public.current_user_role();
begin
  if new.status = old.status then return new; end if;
  if old.status='draft' and new.status='submitted' and new.submitted_by=auth.uid() then return new; end if;
  if old.status='submitted' and new.status in ('verified','rejected') and actor_role in ('admin_hr','super_admin') then return new; end if;
  if old.status='verified' and new.status in ('approved','rejected') and actor_role='super_admin' then return new; end if;
  if old.status='approved' and new.status='voucher_generated' and actor_role in ('accounts_officer','super_admin') then return new; end if;
  if old.status in ('voucher_generated','partially_paid') and new.status in ('partially_paid','paid') and actor_role in ('accounts_officer','super_admin') then return new; end if;
  raise exception 'Invalid vendor bill status transition from % to % for role %',old.status,new.status,actor_role using errcode='23514';
end $$;

drop trigger if exists validate_vendor_bill_status_transition on public.vendor_bills;
create trigger validate_vendor_bill_status_transition before update of status on public.vendor_bills
for each row execute function public.validate_vendor_bill_status_transition();
