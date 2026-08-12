# Site Connect Supabase Reset

These scripts are intentionally destructive. Run them only against the project
you intend to rebuild.

They never read, modify, replace, or delete `.env.local`.

## Preferred full rebuild

The safest complete reset is the Supabase CLI reset because it rebuilds the
schema from every migration and then runs `supabase/seed.sql`.

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<personal-access-token>"
$env:SUPABASE_DB_PASSWORD = "<database-password>"
supabase link --project-ref "<project-ref>"
supabase db reset --linked --yes
```

This clears application data and Auth users. Storage objects may survive a
database reset. Hosted Supabase protects direct deletion from
`storage.objects`, so run `002_wipe_storage.ps1` with `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` set when a completely empty file store is required.

## Staged SQL reset

Run the files in this order with `psql` or the Supabase SQL editor:

1. `001_wipe_app_data.sql`
2. `002_wipe_storage.ps1` (uses the supported Storage API)
3. `003_optional_wipe_auth_users.sql` only when Auth accounts must be removed
4. `004_fresh_seed.sql` through `psql`

For a blank first-run state, complete step 4 before using `/setup-admin` so the
required production-safe static role records exist. Step 4 never creates Auth
users, organizations, profiles, or operational data. For optional local demo data, run
`supabase/seed.demo.sql` explicitly against a disposable local project.

`004_fresh_seed.sql` uses the `psql` `\ir` command. In the SQL editor, run
`supabase/seed.sql` directly instead.

After a reset, open `/setup-admin` to create the first organization and Super
Admin. Never load `seed.demo.sql` in production and never place service-role keys,
database passwords, or personal access tokens in these files.
