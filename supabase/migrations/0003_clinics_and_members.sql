-- ============================================================
-- 0003 · Clinics and members (plan §3, §8, §27, §28.1; tracker R1.2, R1.3).
--
-- 1. `clinics`, the tenant. Every clinic-owned table hangs from it with
--    `on delete cascade` (AGENTS.md §7, §28).
-- 2. The permission catalogue as the database knows it:
--    `permissions_are_valid()`, the CHECK on every membership's permissions —
--    the names in src/constants/permissions.ts and their dependencies
--    (PERMISSION_DEPENDENCIES), kept equal by tests/db.
-- 3. `clinic_members`: a person's access to a clinic (plan §3.1). One OWNER
--    per clinic (D24); one invited or active membership per person (D23).
-- 4. `doctors`: a doctor profile on an OWNER or DOCTOR membership, in the same
--    clinic as the membership (a composite foreign key, not a hope).
-- 5. The RLS helpers (plan §27.2), each asked once per statement as
--    `(select fn())`, and the policies that read them. `clinic_can_write()`
--    arrives with the subscription (0005), `can_see_patient()` with patients
--    (0012).
--
-- Writes to these tables go through SQL functions (register_clinic, the team
-- functions), never straight from a client: there is no INSERT, UPDATE or
-- DELETE policy here.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Clinics
-- ------------------------------------------------------------

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (public.is_clean_line(name, 100)),
  clinic_type text not null check (clinic_type in ('DENTAL', 'GENERAL', 'PHYSIOTHERAPY', 'DERMATOLOGY', 'OTHER')),
  phone text check (public.is_phone_number(phone)),
  email extensions.citext check (public.is_email(email::text)),
  address text not null check (public.is_clean_text(address, 500)),
  city text not null check (public.is_clean_line(city, 60)),
  -- Asia/Kolkata in V1 (D9); the column exists so a clinic's day is always
  -- counted in its own timezone (AGENTS.md §15). CLINIC_TIME_ZONE in TS.
  timezone text not null default 'Asia/Kolkata' check (timezone in ('Asia/Kolkata')),
  -- The GST number's own shape: state code, PAN, entity, Z, check character.
  gstin text check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  paper_size text not null default 'A4' check (paper_size in ('A4', 'A5')),
  fee_timing text not null default 'AFTER_CONSULTATION' check (fee_timing in ('AT_ARRIVAL', 'AFTER_CONSULTATION')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_clinics_updated_at
before update on public.clinics
for each row
execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. The permission catalogue
-- ------------------------------------------------------------

create or replace function public.permissions_are_valid(permissions text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    -- Only names from the catalogue (plan §8.1), each once.
    permissions <@ array[
      'patients.view', 'patients.create', 'patients.edit',
      'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.cancel',
      'visits.view', 'visits.create', 'visits.edit',
      'prescriptions.write',
      'payments.view', 'payments.create', 'payments.discount', 'payments.edit',
      'expenses.view', 'expenses.create', 'expenses.edit',
      'reports.view',
      'team.manage',
      'settings.manage'
    ]::text[]
    and cardinality(permissions) = (select count(distinct held) from unnest(permissions) as held)
    -- And with everything each one needs (plan §8.2 rule 2).
    and not exists (
      select 1
      from (values
        ('appointments.view', 'patients.view'),
        ('appointments.create', 'patients.view'),
        ('appointments.edit', 'patients.view'),
        ('appointments.cancel', 'patients.view'),
        ('visits.view', 'patients.view'),
        ('visits.create', 'patients.view'),
        ('visits.edit', 'patients.view'),
        ('prescriptions.write', 'patients.view'),
        ('prescriptions.write', 'visits.view'),
        ('payments.view', 'patients.view'),
        ('payments.create', 'patients.view'),
        ('payments.discount', 'patients.view'),
        ('payments.discount', 'payments.create'),
        ('payments.edit', 'patients.view')
      ) as dependency (permission, needs)
      where dependency.permission = any (permissions)
        and not dependency.needs = any (permissions)
    );
$$;

grant execute on function public.permissions_are_valid(text[]) to authenticated;

-- ------------------------------------------------------------
-- 3. Members
-- ------------------------------------------------------------

create table public.clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('OWNER', 'DOCTOR', 'STAFF')),
  status text not null default 'INVITED' check (status in ('INVITED', 'ACTIVE', 'INACTIVE')),
  job_title text check (public.is_clean_line(job_title, 60)),
  permissions text[] not null default '{}' check (public.permissions_are_valid(permissions)),
  invited_by uuid references public.profiles (id) on delete set null,
  invited_at timestamptz,
  invite_expires_at timestamptz,
  joined_at timestamptz,
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, user_id),
  -- What a doctor profile's composite foreign key points at.
  unique (id, clinic_id),
  -- The owner holds every permission implicitly and stores none, and is always
  -- active: never restricted, deactivated or removed (plan §3.1, §8.2).
  constraint clinic_members_owner_is_whole check (role <> 'OWNER' or (permissions = '{}' and status = 'ACTIVE')),
  constraint clinic_members_invite_expires check (status <> 'INVITED' or invite_expires_at is not null),
  constraint clinic_members_joined check (status = 'INVITED' or joined_at is not null),
  constraint clinic_members_deactivated check ((status = 'INACTIVE') = (deactivated_at is not null))
);

-- Exactly one owner per clinic (D24).
create unique index clinic_members_one_owner on public.clinic_members (clinic_id) where role = 'OWNER';

-- One clinic per person in V1 (D23): one membership invited or active at a time.
create unique index clinic_members_one_clinic on public.clinic_members (user_id) where status in ('INVITED', 'ACTIVE');

create index clinic_members_clinic_id_status_idx on public.clinic_members (clinic_id, status);

create trigger set_clinic_members_updated_at
before update on public.clinic_members
for each row
execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4. Doctors
-- ------------------------------------------------------------

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  member_id uuid not null unique,
  specialization text check (public.is_clean_line(specialization, 100)),
  qualifications text check (public.is_clean_line(qualifications, 100)),
  -- Needed before a doctor's prescription can be saved (plan §8.2 rule 4).
  registration_number text check (public.is_clean_line(registration_number, 50)),
  -- The doctor's own fee; null takes the price list's Consultation (D26).
  consultation_fee_paise integer check (consultation_fee_paise between 0 and 100000000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, clinic_id) references public.clinic_members (id, clinic_id) on delete cascade
);

create index doctors_clinic_id_idx on public.doctors (clinic_id);

create trigger set_doctors_updated_at
before update on public.doctors
for each row
execute function public.set_updated_at();

-- ------------------------------------------------------------
-- What the shape alone cannot say
-- ------------------------------------------------------------

-- Only an owner or a doctor has a doctor profile: staff never see patients as
-- a doctor, and never write a prescription in their own name (plan §3.1).
create or replace function public.check_doctor_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.clinic_members
    where id = new.member_id and role in ('OWNER', 'DOCTOR')
  ) then
    raise exception 'Only an owner or a doctor has a doctor profile'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger doctors_member_sees_patients
before insert or update of member_id on public.doctors
for each row
execute function public.check_doctor_member();

-- The platform admin belongs to no clinic (plan §3.2): never a member, and
-- never made DEV while one.
create or replace function public.refuse_developer_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where id = new.user_id and platform_role is not null) then
    raise exception 'A platform developer belongs to no clinic'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger clinic_members_not_developer
before insert or update of user_id on public.clinic_members
for each row
execute function public.refuse_developer_membership();

create or replace function public.refuse_member_developer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.platform_role is not null and exists (select 1 from public.clinic_members where user_id = new.id) then
    raise exception 'A clinic member cannot be a platform developer'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_developer_has_no_clinic
before insert or update of platform_role on public.profiles
for each row
execute function public.refuse_member_developer();

-- ------------------------------------------------------------
-- 5. The RLS helpers (plan §27.2)
--
-- Security definer, so each reads clinic_members without the caller's own
-- policies in the way (and without a policy that calls one recursing); stable,
-- so `(select fn())` is asked once per statement. Every one counts only an
-- ACTIVE membership: a deactivated member's next request reaches nothing
-- (plan §8.2 rule 6).
-- ------------------------------------------------------------

-- The caller's active membership (one clinic per person in V1).
create or replace function public.current_member()
returns public.clinic_members
language sql
stable
security definer
set search_path = ''
as $$
  select member.*
  from public.clinic_members as member
  where member.user_id = (select auth.uid()) and member.status = 'ACTIVE';
$$;

create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select member.clinic_id
  from public.clinic_members as member
  where member.user_id = (select auth.uid()) and member.status = 'ACTIVE';
$$;

create or replace function public.is_clinic_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clinic_members as member
    where member.user_id = (select auth.uid()) and member.status = 'ACTIVE' and member.role = 'OWNER'
  );
$$;

-- The owner holds every permission (plan §8.2 rule 1); anyone else what is stored.
create or replace function public.has_permission(permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clinic_members as member
    where member.user_id = (select auth.uid())
      and member.status = 'ACTIVE'
      and (member.role = 'OWNER' or permission = any (member.permissions))
  );
$$;

-- The caller's own doctor profile, while it is active.
create or replace function public.current_doctor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select doctor.id
  from public.doctors as doctor
  join public.clinic_members as member on member.id = doctor.member_id
  where member.user_id = (select auth.uid()) and member.status = 'ACTIVE' and doctor.active;
$$;

revoke all on function public.current_member() from public, anon;
revoke all on function public.current_clinic_id() from public, anon;
revoke all on function public.is_clinic_owner() from public, anon;
revoke all on function public.has_permission(text) from public, anon;
revoke all on function public.current_doctor_id() from public, anon;
grant execute on function public.current_member() to authenticated, service_role;
grant execute on function public.current_clinic_id() to authenticated, service_role;
grant execute on function public.is_clinic_owner() to authenticated, service_role;
grant execute on function public.has_permission(text) to authenticated, service_role;
grant execute on function public.current_doctor_id() to authenticated, service_role;

-- ------------------------------------------------------------
-- Policies: a member reads their own clinic, its team and its doctors — the
-- names every picker and every "who did it" needs — and nothing of any other
-- clinic. The platform admin, a member of none, reads none of it.
-- ------------------------------------------------------------

alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.doctors enable row level security;

create policy clinics_select_own
on public.clinics
for select
to authenticated
using (id = (select public.current_clinic_id()));

create policy clinic_members_select_own_clinic
on public.clinic_members
for select
to authenticated
using (clinic_id = (select public.current_clinic_id()));

create policy doctors_select_own_clinic
on public.doctors
for select
to authenticated
using (clinic_id = (select public.current_clinic_id()));

-- A teammate's profile — name, email, mobile — beside one's own (0002).
create policy profiles_select_teammates
on public.profiles
for select
to authenticated
using (
  id in (
    select member.user_id from public.clinic_members as member
    where member.clinic_id = (select public.current_clinic_id())
  )
);

grant select on public.clinics, public.clinic_members, public.doctors to authenticated;
