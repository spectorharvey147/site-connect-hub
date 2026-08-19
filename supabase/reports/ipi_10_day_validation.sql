-- Read-only reconciliation after seed.ipi-production.sql is applied.
select 'users' metric, count(*)::numeric value from public.user_profiles
union all select 'projects', count(*) from public.projects
union all select 'customers', count(*) from public.customers
union all select 'reviewed_dprs', count(*) from public.daily_progress_reports where report_date between '2026-08-10' and '2026-08-19'
union all select 'attendance_headers', count(*) from public.casual_labour_attendance where date between '2026-08-10' and '2026-08-19'
union all select 'attendance_items', count(*) from public.casual_labour_attendance_items i join public.casual_labour_attendance a on a.id=i.attendance_id where a.date between '2026-08-10' and '2026-08-19'
union all select 'labour_net_amount', coalesce(sum(i.net_amount),0) from public.casual_labour_attendance_items i join public.casual_labour_attendance a on a.id=i.attendance_id where a.date between '2026-08-10' and '2026-08-19'
union all select 'machine_logs', count(*) from public.machine_logs where log_date between '2026-08-10' and '2026-08-19'
union all select 'machine_hours', coalesce(sum(total_meter_hours),0) from public.machine_logs where log_date between '2026-08-10' and '2026-08-19'
union all select 'machine_accrual', coalesce(sum(calculated_cost),0) from public.machine_logs where log_date between '2026-08-10' and '2026-08-19'
union all select 'fuel_received_litres', coalesce(sum(quantity),0) from public.fuel_receipts where receipt_date between '2026-08-10' and '2026-08-19'
union all select 'fuel_invoice_value', coalesce(sum(total_amount),0) from public.fuel_receipts where receipt_date between '2026-08-10' and '2026-08-19'
union all select 'fuel_issued_litres', coalesce(sum(total_issued),0) from public.fuel_issues where issue_date between '2026-08-10' and '2026-08-19'
order by metric;
