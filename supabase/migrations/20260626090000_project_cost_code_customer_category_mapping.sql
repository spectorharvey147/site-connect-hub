alter table public.project_cost_codes
  add column if not exists customer_ids jsonb not null default '[]'::jsonb,
  add column if not exists expense_category_ids jsonb not null default '[]'::jsonb;

create index if not exists idx_project_cost_codes_customer_ids
  on public.project_cost_codes using gin (customer_ids);

create index if not exists idx_project_cost_codes_expense_category_ids
  on public.project_cost_codes using gin (expense_category_ids);
