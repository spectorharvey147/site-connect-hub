-- Enum values must commit before later migrations may safely reference them.
alter type public.claim_status add value if not exists 'hod_approval_pending';
alter type public.claim_status add value if not exists 'hod_approved';
alter type public.claim_status add value if not exists 'final_approved';
alter type public.claim_status add value if not exists 'accounts_verification_pending';
alter type public.claim_status add value if not exists 'accounts_verified';
alter type public.claim_status add value if not exists 'accounts_returned';
alter type public.claim_status add value if not exists 'voucher_pending';
alter type public.claim_status add value if not exists 'sap_export_pending';
alter type public.claim_status add value if not exists 'sap_exported';
alter type public.claim_status add value if not exists 'payment_pending';
alter type public.claim_status add value if not exists 'partially_paid';
alter type public.claim_status add value if not exists 'cancelled';
alter type public.claim_approval_stage add value if not exists 'hod_approval';
alter type public.claim_approval_stage add value if not exists 'accounts_verification';
