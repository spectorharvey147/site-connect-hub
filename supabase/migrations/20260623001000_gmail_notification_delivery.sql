alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_status_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_status_check
  check (status in ('pending', 'sent', 'failed'));

create index if not exists idx_notification_deliveries_retry
  on public.notification_deliveries(status, next_retry_at, attempts);

update public.app_settings
set notifications = notifications || jsonb_build_object(
  'emailEvents',
  jsonb_build_object(
    'claim_submitted', true,
    'claim_approved', true,
    'claim_rejected', true,
    'claim_changes_requested', true,
    'leave_submitted', true,
    'leave_approved', true,
    'leave_rejected', true,
    'task_assigned', true,
    'dpr_submitted', true,
    'material_request_submitted', true,
    'vendor_bill_submitted', true,
    'vendor_bill_approved', true,
    'voucher_generated', true,
    'payment_processed', true,
    'message_mention', true
  )
)
where id = 'default'
  and not (notifications ? 'emailEvents');
