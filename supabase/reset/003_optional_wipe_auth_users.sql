\set ON_ERROR_STOP on

-- Optional: this permanently removes every Supabase Auth account.
begin;
delete from auth.users;
commit;
