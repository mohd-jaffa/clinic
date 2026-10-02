-- ============================================================
-- 0007 · The clinic's own catalogues (plan §9, §28.2; tracker R1.8).
--
-- The price list, appointment types (D32) and expense categories (D40): each
-- clinic's own, seeded at registration (0008, from src/constants/seeds.ts) and
-- changed by whoever holds `settings.manage` (plan §9). Archived, never
-- deleted — a bill, an appointment or an expense keeps pointing at what it
-- used — so a name is unique only among the active ones, whatever its case.
--
-- Every member reads them (the pickers need them); a write needs
-- `settings.manage` and a clinic that is not read-only (plan §27.4).
-- ============================================================

create table public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null check (public.is_clean_line(name, 100)),
  category text not null check (category in ('CONSULTATION', 'PROCEDURE', 'INVESTIGATION', 'MEDICINE', 'OTHER')),
  price_paise integer not null check (price_paise between 0 and 100000000),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index services_clinic_name_unique on public.services (clinic_id, lower(name)) where active;
create index services_clinic_id_idx on public.services (clinic_id, active);

create table public.appointment_types (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null check (public.is_clean_line(name, 60)),
  default_minutes integer not null check (default_minutes between 5 and 480),
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index appointment_types_clinic_name_unique on public.appointment_types (clinic_id, lower(name)) where active;
create index appointment_types_clinic_id_idx on public.appointment_types (clinic_id, position);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null check (public.is_clean_line(name, 60)),
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index expense_categories_clinic_name_unique on public.expense_categories (clinic_id, lower(name)) where active;
create index expense_categories_clinic_id_idx on public.expense_categories (clinic_id, position);

create trigger set_services_updated_at before update on public.services
for each row execute function public.set_updated_at();
create trigger set_services_actor before insert or update on public.services
for each row execute function public.set_actor();
create trigger set_appointment_types_updated_at before update on public.appointment_types
for each row execute function public.set_updated_at();
create trigger set_expense_categories_updated_at before update on public.expense_categories
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Policies (plan §27.4)
-- ------------------------------------------------------------

alter table public.services enable row level security;
alter table public.appointment_types enable row level security;
alter table public.expense_categories enable row level security;

create policy services_select on public.services
for select to authenticated
using (clinic_id = (select public.current_clinic_id()));

create policy services_insert on public.services
for insert to authenticated
with check (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('settings.manage'))
  and (select public.clinic_can_write())
);

create policy services_update on public.services
for update to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('settings.manage'))
  and (select public.clinic_can_write())
)
with check (clinic_id = (select public.current_clinic_id()));

create policy appointment_types_select on public.appointment_types
for select to authenticated
using (clinic_id = (select public.current_clinic_id()));

create policy appointment_types_insert on public.appointment_types
for insert to authenticated
with check (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('settings.manage'))
  and (select public.clinic_can_write())
);

create policy appointment_types_update on public.appointment_types
for update to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('settings.manage'))
  and (select public.clinic_can_write())
)
with check (clinic_id = (select public.current_clinic_id()));

create policy expense_categories_select on public.expense_categories
for select to authenticated
using (clinic_id = (select public.current_clinic_id()));

create policy expense_categories_insert on public.expense_categories
for insert to authenticated
with check (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('settings.manage'))
  and (select public.clinic_can_write())
);

create policy expense_categories_update on public.expense_categories
for update to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('settings.manage'))
  and (select public.clinic_can_write())
)
with check (clinic_id = (select public.current_clinic_id()));

-- No DELETE: an entry is archived (active = false), never removed.
grant select, insert, update on public.services, public.appointment_types, public.expense_categories to authenticated;
