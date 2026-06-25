do $$
begin
  create type public.material_priority as enum (
    'urgent',
    'high',
    'medium',
    'low'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.material_request_status as enum (
    'draft',
    'submitted',
    'approved',
    'received',
    'rejected'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.material_receipt_status as enum (
    'draft',
    'received',
    'verified',
    'rejected'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.material_condition as enum (
    'good',
    'damaged',
    'partial'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.materials (
  id text primary key,
  name text not null,
  uom text not null,
  category text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_vendors (
  id text primary key,
  name text not null,
  contact_person text,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  project_id uuid not null references public.projects(id),
  request_date date not null,
  required_date date not null,
  priority public.material_priority not null default 'medium',
  status public.material_request_status not null default 'draft',
  requested_by uuid not null references public.user_profiles(id),
  submitted_at timestamptz,
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint material_request_required_date_check check (required_date >= request_date)
);

create table if not exists public.material_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.material_requests(id) on delete cascade,
  material_id text not null references public.materials(id),
  quantity numeric(12, 2) not null default 0,
  uom text not null,
  specification text,
  estimated_cost numeric(12, 2) not null default 0,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_request_quantity_check check (quantity >= 0),
  constraint material_request_estimated_cost_check check (estimated_cost >= 0)
);

create table if not exists public.material_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.material_requests(id) on delete cascade,
  file_name text not null,
  file_url text,
  uploaded_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.material_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  linked_request_id uuid references public.material_requests(id),
  project_id uuid not null references public.projects(id),
  vendor_id text not null references public.material_vendors(id),
  receipt_date date not null,
  invoice_number text,
  invoice_date date,
  delivery_challan_number text,
  materials_checked boolean not null default false,
  quantities_match_invoice boolean not null default false,
  quality_acceptable boolean not null default false,
  invoice_matched boolean not null default false,
  inspector_name text,
  signature_name text,
  status public.material_receipt_status not null default 'draft',
  received_by uuid not null references public.user_profiles(id),
  received_at timestamptz,
  verified_by uuid references public.user_profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.material_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.material_receipts(id) on delete cascade,
  material_id text not null references public.materials(id),
  qty_ordered numeric(12, 2) not null default 0,
  qty_received numeric(12, 2) not null default 0,
  uom text not null,
  condition public.material_condition not null default 'good',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_receipt_qty_ordered_check check (qty_ordered >= 0),
  constraint material_receipt_qty_received_check check (qty_received >= 0)
);

create table if not exists public.material_receipt_attachments (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.material_receipts(id) on delete cascade,
  file_name text not null,
  file_url text,
  uploaded_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_material_requests_project_id on public.material_requests(project_id);
create index if not exists idx_material_requests_requested_by on public.material_requests(requested_by);
create index if not exists idx_material_requests_status on public.material_requests(status);
create index if not exists idx_material_request_items_request_id on public.material_request_items(request_id);
create index if not exists idx_material_receipts_project_id on public.material_receipts(project_id);
create index if not exists idx_material_receipts_vendor_id on public.material_receipts(vendor_id);
create index if not exists idx_material_receipts_status on public.material_receipts(status);
create index if not exists idx_material_receipt_items_receipt_id on public.material_receipt_items(receipt_id);

drop trigger if exists set_materials_updated_at on public.materials;
create trigger set_materials_updated_at
before update on public.materials
for each row execute function public.set_updated_at();

drop trigger if exists set_material_vendors_updated_at on public.material_vendors;
create trigger set_material_vendors_updated_at
before update on public.material_vendors
for each row execute function public.set_updated_at();

drop trigger if exists set_material_requests_updated_at on public.material_requests;
create trigger set_material_requests_updated_at
before update on public.material_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_material_request_items_updated_at on public.material_request_items;
create trigger set_material_request_items_updated_at
before update on public.material_request_items
for each row execute function public.set_updated_at();

drop trigger if exists set_material_receipts_updated_at on public.material_receipts;
create trigger set_material_receipts_updated_at
before update on public.material_receipts
for each row execute function public.set_updated_at();

drop trigger if exists set_material_receipt_items_updated_at on public.material_receipt_items;
create trigger set_material_receipt_items_updated_at
before update on public.material_receipt_items
for each row execute function public.set_updated_at();

alter table public.materials enable row level security;
alter table public.material_vendors enable row level security;
alter table public.material_requests enable row level security;
alter table public.material_request_items enable row level security;
alter table public.material_request_attachments enable row level security;
alter table public.material_receipts enable row level security;
alter table public.material_receipt_items enable row level security;
alter table public.material_receipt_attachments enable row level security;

drop policy if exists "materials visible to field roles" on public.materials;
create policy "materials visible to field roles"
on public.materials for select
to authenticated
using (public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin'));

drop policy if exists "material vendors visible to field roles" on public.material_vendors;
create policy "material vendors visible to field roles"
on public.material_vendors for select
to authenticated
using (public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin'));

drop policy if exists "material requests visible to owner manager or admin" on public.material_requests;
create policy "material requests visible to owner manager or admin"
on public.material_requests for select
to authenticated
using (
  deleted_at is null
  and (
    requested_by = auth.uid()
    or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
  )
);

drop policy if exists "material requests created by field roles" on public.material_requests;
create policy "material requests created by field roles"
on public.material_requests for insert
to authenticated
with check (
  requested_by = auth.uid()
  and public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin')
);

drop policy if exists "material requests updated by owner manager or admin" on public.material_requests;
create policy "material requests updated by owner manager or admin"
on public.material_requests for update
to authenticated
using (
  requested_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
)
with check (
  requested_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
);

drop policy if exists "material request children visible with request" on public.material_request_items;
create policy "material request children visible with request"
on public.material_request_items for select
to authenticated
using (
  exists (
    select 1
    from public.material_requests r
    where r.id = request_id
      and r.deleted_at is null
      and (
        r.requested_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "material request children inserted with request" on public.material_request_items;
create policy "material request children inserted with request"
on public.material_request_items for insert
to authenticated
with check (
  exists (
    select 1
    from public.material_requests r
    where r.id = request_id
      and (
        r.requested_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "material receipts visible to owner manager or admin" on public.material_receipts;
create policy "material receipts visible to owner manager or admin"
on public.material_receipts for select
to authenticated
using (
  deleted_at is null
  and (
    received_by = auth.uid()
    or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
  )
);

drop policy if exists "material receipts created by field roles" on public.material_receipts;
create policy "material receipts created by field roles"
on public.material_receipts for insert
to authenticated
with check (
  received_by = auth.uid()
  and public.current_user_role() in ('site_staff', 'manager', 'admin_hr', 'super_admin')
);

drop policy if exists "material receipts updated by owner manager or admin" on public.material_receipts;
create policy "material receipts updated by owner manager or admin"
on public.material_receipts for update
to authenticated
using (
  received_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
)
with check (
  received_by = auth.uid()
  or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
);

drop policy if exists "material receipt children visible with receipt" on public.material_receipt_items;
create policy "material receipt children visible with receipt"
on public.material_receipt_items for select
to authenticated
using (
  exists (
    select 1
    from public.material_receipts r
    where r.id = receipt_id
      and r.deleted_at is null
      and (
        r.received_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

drop policy if exists "material receipt children inserted with receipt" on public.material_receipt_items;
create policy "material receipt children inserted with receipt"
on public.material_receipt_items for insert
to authenticated
with check (
  exists (
    select 1
    from public.material_receipts r
    where r.id = receipt_id
      and (
        r.received_by = auth.uid()
        or public.current_user_role() in ('manager', 'admin_hr', 'super_admin')
      )
  )
);

insert into public.materials (id, name, uom, category, status)
values
  ('material-cement-opc', 'OPC Cement', 'Bags', 'Cement', 'active'),
  ('material-tmt-16mm', 'TMT Steel 16mm', 'KG', 'Steel', 'active'),
  ('material-river-sand', 'River Sand', 'CFT', 'Aggregates', 'active'),
  ('material-aggregate-20mm', '20mm Aggregate', 'CFT', 'Aggregates', 'active'),
  ('material-admixture', 'Concrete Admixture', 'L', 'Chemicals', 'active')
on conflict (id) do update set
  name = excluded.name,
  uom = excluded.uom,
  category = excluded.category,
  status = excluded.status;

insert into public.material_vendors (id, name, contact_person, phone, status)
values
  ('vendor-buildmart', 'BuildMart Supplies', 'Sanjay Bhat', '+91 98765 50101', 'active'),
  ('vendor-steelhouse', 'Steelhouse Traders', 'Divya Nair', '+91 98765 50102', 'active'),
  ('vendor-aggregate-hub', 'Aggregate Hub', 'Mahesh Gowda', '+91 98765 50103', 'active')
on conflict (id) do update set
  name = excluded.name,
  contact_person = excluded.contact_person,
  phone = excluded.phone,
  status = excluded.status;
