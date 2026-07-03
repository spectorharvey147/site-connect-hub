-- The initial schema made departments.name mandatory. Newer application code
-- uses department_name, so keep both fields compatible for upgraded projects.
update public.departments
set name = department_name
where department_name is not null
  and name is distinct from department_name;

create or replace function public.sync_department_names()
returns trigger
language plpgsql
as $$
begin
  new.department_name := coalesce(nullif(trim(new.department_name), ''), nullif(trim(new.name), ''));
  new.name := new.department_name;
  return new;
end;
$$;

drop trigger if exists sync_department_names_trigger on public.departments;
create trigger sync_department_names_trigger
before insert or update of name, department_name on public.departments
for each row execute function public.sync_department_names();
