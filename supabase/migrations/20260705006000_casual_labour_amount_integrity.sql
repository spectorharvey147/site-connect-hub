update public.casual_labour_attendance_items
set net_amount = normal_amount + overtime_amount + allowance - deduction
where net_amount is distinct from normal_amount + overtime_amount + allowance - deduction;

alter table public.casual_labour_attendance_items
  drop constraint if exists casual_labour_attendance_items_amounts_nonnegative,
  drop constraint if exists casual_labour_attendance_items_net_reconciles;

alter table public.casual_labour_attendance_items
  add constraint casual_labour_attendance_items_amounts_nonnegative check (
    worked_hours >= 0 and normal_hours >= 0 and overtime_hours >= 0
    and normal_rate >= 0 and overtime_rate >= 0
    and allowance >= 0 and deduction >= 0
    and normal_amount >= 0 and overtime_amount >= 0
  ),
  add constraint casual_labour_attendance_items_net_reconciles check (
    net_amount = normal_amount + overtime_amount + allowance - deduction
  );

alter table public.casual_labour_bills
  drop constraint if exists casual_labour_bills_net_reconciles;
alter table public.casual_labour_bills
  add constraint casual_labour_bills_net_reconciles check (
    net_amount = normal_amount + overtime_amount + allowance_amount - deduction_amount
  );
