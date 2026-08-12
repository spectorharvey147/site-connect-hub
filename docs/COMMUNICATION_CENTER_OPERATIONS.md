# Communication Center operations

## Architecture and security boundary

The browser only configures organization-scoped records through Supabase Auth and RLS. DPR submission calls one transactional RPC. The outbox worker is a Supabase Edge Function using server-only secrets. The Baileys gateway is a separate long-running process/container and must never run in Vercel, a browser, or another short-lived frontend runtime.

No service-role key, worker secret, gateway token, private signing key, or Baileys credential may use a `VITE_` variable. Gateway session files stay in a protected persistent volume outside the web root and must not be uploaded to Supabase Storage. Logs redact authorization values and signed URLs.

## Migration order

Apply all existing master migrations first, in filename order. Then apply:

1. `20260811001000_attendance_production_hardening.sql`
2. `20260811002000_communication_center.sql`
3. `20260811003000_atomic_dpr_and_media.sql`

Use a staging database restored from production schema metadata before production. Do not run anything under `supabase/reset/`. Verify the live schema because repository state is not proof of production state. The new migrations are additive and do not delete production records.

## Production variables

Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_RUNTIME_MODE=production`, `VITE_ENABLE_DEMO_DATA=false`, and `VITE_SITE_CONNECT_URL`.

Edge Function secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `COMMUNICATION_WORKER_SECRET`, `WHATSAPP_GATEWAY_URL`, `WHATSAPP_GATEWAY_TOKEN`, and `SITE_CONNECT_URL`.

Gateway variables are listed in `services/baileys-gateway/.env.example`. Generate independent random values for worker and gateway tokens. Require HTTPS and restrict the gateway firewall to the worker egress/network where possible.

## Storage

The migration creates private `communication-media` storage with PNG/JPEG and 10 MB limits. DPR records store `storage_bucket` and `storage_path`; signed URLs are generated only for short-lived viewing/worker use. Generated cards use permanent paths under `<organization>/dpr/<dpr-id>/revision-<n>.png`.

Schedule the worker cleanup mode daily to remove only registry entries older than 24 hours that have no `dpr_photos` reference. The cleanup first queries `list_dpr_orphan_candidates`; it never deletes based solely on a client failure.

## Worker deployment and scheduler

Deploy `communication-worker`, configure its secrets, and call it every minute with `Authorization: Bearer <COMMUNICATION_WORKER_SECRET>`. Call the same endpoint daily with `{ "cleanup": true }` for orphan cleanup. Keep the global switch off until the pilot checks pass.

Outbox claiming uses `FOR UPDATE SKIP LOCKED`. Defaults are: 10-second minimum interval, 3/minute, 30/hour, 10/group/hour, three attempts, three consecutive failures before pause, ten-minute reconnect cooldown, and admin approval required.

## Gateway deployment and QR pairing

1. Use a dedicated, non-critical company WhatsApp number.
2. Build the container from `services/baileys-gateway/Dockerfile` or install with Node 20+.
3. Mount an encrypted/restricted persistent directory at `/data`; restrict it to the service account.
4. Configure HTTPS reverse proxy/tunnel and firewall rules.
5. Create the organization gateway row and use its UUID for `GATEWAY_ID`.
6. Start once with `PRINT_QR=true`; scan from WhatsApp **Linked devices → Link a device**.
7. Confirm `/health`, heartbeat, linked number, and group synchronization.
8. In Communication Center, map a project only to a synchronized `@g.us` group.
9. Queue a visibly labelled test, approve it, and confirm provider ID/audit attempt.
10. Enable `dpr.submitted`/`dpr.resubmitted`, then enable the project and global switch.

The gateway rejects personal chats, unmapped groups, unsupported/oversized media, duplicate idempotency keys, non-Supabase media URLs, and invalid bearer tokens. It does not implement typing/presence simulation, typo generation, fingerprint changes, proxy rotation, or detection evasion.

## Kill switches and troubleshooting

Disable in this order for the narrowest blast radius: event rule, project mapping, gateway pause, then organization global switch. Cancellation prevents an unsent outbox row from being claimed. Manual retry is limited to failed/cancelled items; approval is explicit.

After logout, authentication failure, suspected restriction, or three consecutive failures, the system pauses and requires administrator action. Do not repeatedly reconnect or automatically resume. Preserve sanitized logs, inspect WhatsApp status and number health, rotate a compromised gateway token, re-pair only after the cause is understood, then clear the pause deliberately.

If moving to an official WhatsApp provider later, retain the outbox/rules/templates/audit model and replace only the gateway adapter. Revalidate approved destination semantics and template rules for that provider.

## Pilot checklist

- Dedicated number and approved group ownership confirmed.
- HTTPS certificate and firewall verified.
- Session directory permissions and backup encryption verified.
- Global switch remains off during pairing and group mapping.
- Approval-required test succeeds once and duplicate replay returns the same provider ID.
- DPR first submission and returned/resubmitted revisions each create exactly one expected event.
- Signed URL expiry, generated card readability, missing-photo layout, and long-text clipping checked on a real phone.
- Rate limit, retry, circuit breaker, logout, restriction, cancellation, and kill-switch drills completed.

Attendance has no Communication Center event processing or WhatsApp delivery in this phase.
