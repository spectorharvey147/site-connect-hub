-- Casual labour headers must use the same production vendor master as
-- contracts, rosters, attendance items, allocations and bills.
alter table public.casual_labour_attendance
  drop constraint if exists casual_labour_attendance_vendor_id_fkey;

alter table public.casual_labour_attendance
  add constraint casual_labour_attendance_vendor_id_fkey
  foreign key (vendor_id) references public.vendors(id);
