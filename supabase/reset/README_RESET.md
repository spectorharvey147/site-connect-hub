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
database reset, so run `002_wipe_storage.sql` as well when a completely empty
file store is required.

## Staged SQL reset

Run the files in this order with `psql` or the Supabase SQL editor:

1. `001_wipe_app_data.sql`
2. `002_wipe_storage.sql`
3. `003_optional_wipe_auth_users.sql` only when Auth accounts must be removed
4. `004_fresh_seed.sql` through `psql`

For a truly blank first-run state, stop after step 3 and use `/setup-admin`.
Run step 4 only when demo/reference seed data is intentionally required.

`004_fresh_seed.sql` uses the `psql` `\ir` command. In the SQL editor, run
`supabase/seed.sql` directly instead.

After a reset, open `/setup-admin` to create the first organization and Super
Admin, or provision the standard demo accounts with an approved deployment
script. Never place service-role keys, database passwords, or personal access
tokens in these files.
