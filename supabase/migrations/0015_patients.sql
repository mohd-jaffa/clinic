-- ============================================================
-- 0015 · Patients (plan §10, §27.2, §27.3, §28.3; tracker R4.1, D98 – D104).
--
-- 1. Adding or editing a patient needs seeing them (D102): the permission
--    catalogue's dependencies (0003) gain patients.create → patients.view and
--    patients.edit → patients.view, and a membership holding either without
--    it is given it.
-- 2. `patients`, numbered from 1001 by the clinic's own counter
--    (`patient_counters`, under a row lock — never max() + 1) and never
--    renumbered. The mobile is required and not unique: families share one
--    (Q7). A date of birth is required, estimated when an age was given
--    (D33, D100). Archived, never deleted; an archived patient is read-only
--    until restored (D103).
-- 3. The doctor scope (D3, §27.3): `patient_doctors`, the doctors who may see
--    a patient — the assigned doctor, and the doctor who added them (D99);
--    the appointments, visits and treatments migrations add theirs. It only
--    grows, through triggers, and no client reads or writes it.
--    `can_see_patient()` and the patients policies read it.
-- 4. `patient_alerts`: allergies, conditions and current medications (§10.4),
--    read with visits.view and changed with visits.edit, within the doctor
--    scope.
-- 5. `create_patient`: the number, the patient and the access list in one
--    transaction (AGENTS.md §25); `import_patients`, one batch of the owner's
--    import (§10.5, D51), the same way. A change is the table's own, under
--    its policies — archiving and restoring too, stamped by check_patient.
-- 6. `search_patients` (§10.2, D98, D104): by name (trigram), the mobile's
--    digits or the number, best match first; newest first with nothing typed.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Adding or editing a patient needs seeing them (D102)
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
        ('patients.create', 'patients.view'),
        ('patients.edit', 'patients.view'),
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

-- A CHECK is not asked again of the rows already there when its function
-- changes: anyone who could add or edit without seeing is given seeing.
update public.clinic_members
   set permissions = array_prepend('patients.view', permissions)
 where permissions && array['patients.create', 'patients.edit']::text[]
   and not 'patients.view' = any (permissions);

-- ------------------------------------------------------------
-- 2. Patients
-- ------------------------------------------------------------

-- Each clinic's last patient number (FIRST_PATIENT_NUMBER in seeds.ts).
create table public.patient_counters (
  clinic_id uuid primary key references public.clinics (id) on delete cascade,
  last_number integer not null check (last_number >= 1001)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  -- Shown as P-1001; given by number_patient(), never by a client.
  patient_number integer not null,
  full_name text not null check (public.is_clean_line(full_name, 100)),
  -- Required, and not unique: families share one (Q7).
  phone text not null check (public.is_indian_mobile(phone)),
  alt_phone text check (public.is_phone_number(alt_phone)),
  email extensions.citext check (public.is_email(email::text)),
  -- Estimated when an age was given instead: today, that many years ago (D100).
  date_of_birth date not null,
  dob_is_estimated boolean not null default false,
  gender text not null check (gender in ('MALE', 'FEMALE', 'OTHER')),
  address text check (public.is_clean_text(address, 500)),
  emergency_contact_name text check (public.is_clean_line(emergency_contact_name, 100)),
  emergency_contact_phone text check (public.is_phone_number(emergency_contact_phone)),
  assigned_doctor_id uuid,
  -- Not clinical: "prefers mornings", "comes with her daughter".
  notes text check (public.is_clean_text(notes, 1000)),
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, patient_number),
  -- What a patient-linked table's composite foreign key points at.
  unique (id, clinic_id),
  -- Only a doctor of the same clinic; the patient keeps no doctor if theirs is ever removed.
  foreign key (assigned_doctor_id, clinic_id) references public.doctors (id, clinic_id)
    on delete set null (assigned_doctor_id),
  constraint patients_archived_by check (archived_by is null or archived_at is not null)
);

-- The list, newest first (D104), is the (clinic_id, patient_number) unique index.
create index patients_clinic_id_archived_at_idx on public.patients (clinic_id, archived_at);
-- "Already here?" (plan §10.1): the patients with a mobile.
create index patients_clinic_id_phone_idx on public.patients (clinic_id, phone);
-- The search (plan §10.2): a name, or a mobile's digits, anywhere in it.
create index patients_full_name_trgm_idx on public.patients using gist (clinic_id, full_name extensions.gist_trgm_ops);
create index patients_phone_trgm_idx on public.patients using gist (clinic_id, phone extensions.gist_trgm_ops);
create index patients_assigned_doctor_id_idx on public.patients (assigned_doctor_id);

-- The doctors who may see a patient (§27.3).
create table public.patient_doctors (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null,
  doctor_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (patient_id, doctor_id),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete cascade,
  foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id) on delete cascade
);

create index patient_doctors_clinic_id_doctor_id_idx on public.patient_doctors (clinic_id, doctor_id, patient_id);

-- ------------------------------------------------------------
-- What the shape alone cannot say
-- ------------------------------------------------------------

-- A new patient's number, from the clinic's counter: the upsert locks the
-- counter's row, so two patients added at once never share a number.
create or replace function public.number_patient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.patient_counters as counter (clinic_id, last_number)
  values (new.clinic_id, 1001)
  on conflict (clinic_id) do update set last_number = counter.last_number + 1
  returning counter.last_number into new.patient_number;
  return new;
end;
$$;

-- An archived patient is read-only until restored (D103): any change to one
-- that stays archived is refused, and archiving or restoring stamps when and
-- by whom, whatever a client sent. A date of birth given is today or before
-- and at most 120 years ago in the clinic's timezone (MAX_PATIENT_AGE) —
-- asked only when it is given, so a patient who turns 121 can still be
-- edited. An assigned doctor chosen is one of the clinic's active doctors.
create or replace function public.check_patient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.clinic_today(new.clinic_id);
  born_given boolean := true;
  doctor_given boolean := true;
begin
  if tg_op = 'UPDATE' then
    if old.archived_at is not null and new.archived_at is not null then
      raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
    end if;
    if new.archived_at is distinct from old.archived_at then
      new.archived_at := case when new.archived_at is not null then now() end;
      new.archived_by := case when new.archived_at is not null then auth.uid() end;
    end if;
    born_given := new.date_of_birth is distinct from old.date_of_birth;
    doctor_given := new.assigned_doctor_id is distinct from old.assigned_doctor_id;
  end if;

  if born_given and (new.date_of_birth > today or new.date_of_birth < (today - interval '120 years')::date) then
    raise exception 'Born today or before, at most 120 years ago' using hint = 'PATIENT_BIRTH_DATE_INVALID';
  end if;

  if doctor_given and new.assigned_doctor_id is not null and not exists (
    select 1
      from public.doctors as doctor
      join public.clinic_members as member on member.id = doctor.member_id
     where doctor.id = new.assigned_doctor_id and doctor.active and member.status = 'ACTIVE'
  ) then
    raise exception 'Not one of the clinic''s active doctors' using hint = 'DOCTOR_INACTIVE';
  end if;
  return new;
end;
$$;

-- The access list grows with the patient (§27.3): their assigned doctor, and
-- the doctor who added them (D99), so a patient a doctor has just saved never
-- leaves their view. Never shrinks: changing the assigned doctor adds one.
create or replace function public.add_patient_doctors()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.patient_doctors (clinic_id, patient_id, doctor_id)
  select new.clinic_id, new.id, doctor.id
    from unnest(array[
      new.assigned_doctor_id,
      case when tg_op = 'INSERT' then public.current_doctor_id() end
    ]) as doctor (id)
   where doctor.id is not null
  on conflict do nothing;
  return null;
end;
$$;

revoke all on function public.number_patient() from public, anon, authenticated;
revoke all on function public.check_patient() from public, anon, authenticated;
revoke all on function public.add_patient_doctors() from public, anon, authenticated;

create trigger number_patient before insert on public.patients
for each row execute function public.number_patient();
create trigger check_patient before insert or update on public.patients
for each row execute function public.check_patient();
create trigger set_patients_actor before insert or update on public.patients
for each row execute function public.set_actor();
create trigger set_patients_updated_at before update on public.patients
for each row execute function public.set_updated_at();
create trigger add_patient_doctors after insert or update of assigned_doctor_id on public.patients
for each row execute function public.add_patient_doctors();

-- ------------------------------------------------------------
-- 3. The doctor scope (plan §27.2, §27.3)
-- ------------------------------------------------------------

-- The owner and staff see every patient of the clinic (with patients.view);
-- a doctor sees only their own (D3).
create or replace function public.sees_every_patient()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select member.role <> 'DOCTOR' from public.current_member() as member), false);
$$;

-- The patients on the caller's access list, as a doctor.
create or replace function public.doctor_patient_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select access.patient_id
    from public.patient_doctors as access
   where access.clinic_id = (select public.current_clinic_id())
     and access.doctor_id = (select public.current_doctor_id());
$$;

-- Whether the caller may see this patient: one of their clinic's, with
-- patients.view, and — for a doctor — on their access list. What a
-- patient-linked function asks of one patient; a policy asks the same of
-- every row at once, as `(select sees_every_patient()) or patient_id in
-- (select doctor_patient_ids())`, so it is asked once per statement.
create or replace function public.can_see_patient(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('patients.view')
     and exists (
       select 1 from public.patients as patient
        where patient.id = p_patient_id and patient.clinic_id = public.current_clinic_id()
     )
     and (
       public.sees_every_patient()
       or exists (
         select 1 from public.patient_doctors as access
          where access.patient_id = p_patient_id and access.doctor_id = public.current_doctor_id()
       )
     );
$$;

revoke all on function public.sees_every_patient() from public, anon;
revoke all on function public.doctor_patient_ids() from public, anon;
revoke all on function public.can_see_patient(uuid) from public, anon;
grant execute on function public.sees_every_patient() to authenticated, service_role;
grant execute on function public.doctor_patient_ids() to authenticated, service_role;
grant execute on function public.can_see_patient(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- 4. Alerts (plan §10.4)
-- ------------------------------------------------------------

create table public.patient_alerts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null,
  kind text not null check (kind in ('ALLERGY', 'CONDITION', 'MEDICATION')),
  -- "Penicillin", "Diabetes", "Metformin 500 mg".
  label text not null check (public.is_clean_line(label, 100)),
  note text check (public.is_clean_line(note, 200)),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete cascade
);

-- One active alert of a kind per label, whatever its case.
create unique index patient_alerts_label_unique on public.patient_alerts (patient_id, kind, lower(label)) where active;
create index patient_alerts_clinic_id_patient_id_idx on public.patient_alerts (clinic_id, patient_id);

-- An archived patient's alerts are read-only too (D103).
create or replace function public.check_patient_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.patients as patient
     where patient.id = new.patient_id and patient.archived_at is not null
  ) then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;
  return new;
end;
$$;

revoke all on function public.check_patient_alert() from public, anon, authenticated;

create trigger check_patient_alert before insert or update on public.patient_alerts
for each row execute function public.check_patient_alert();
create trigger set_patient_alerts_actor before insert or update on public.patient_alerts
for each row execute function public.set_actor();
create trigger set_patient_alerts_updated_at before update on public.patient_alerts
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 5. Adding a patient (plan §10.1)
-- ------------------------------------------------------------

-- Needs patients.create and a clinic that can write. Only the fields of a
-- patient are read from `p_patient`; the number, the clinic and who added
-- them are the database's. Each column's CHECK, and check_patient, are the
-- last word on the values. Hands back the patient.
create or replace function public.create_patient(p_patient jsonb)
returns public.patients
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  patient public.patients;
begin
  if clinic is null or not public.has_permission('patients.create') then
    raise exception 'Adding a patient needs patients.create' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);

  insert into public.patients (
    clinic_id, full_name, phone, alt_phone, email, date_of_birth, dob_is_estimated, gender,
    address, emergency_contact_name, emergency_contact_phone, assigned_doctor_id, notes
  )
  select clinic, given.full_name, given.phone, given.alt_phone, given.email, given.date_of_birth,
         coalesce(given.dob_is_estimated, false), given.gender, given.address,
         given.emergency_contact_name, given.emergency_contact_phone, given.assigned_doctor_id, given.notes
    from jsonb_populate_record(null::public.patients, p_patient) as given
  returning * into patient;
  return patient;
end;
$$;

revoke all on function public.create_patient(jsonb) from public, anon;
grant execute on function public.create_patient(jsonb) to authenticated;

-- One batch of an import (plan §10.5, D51): the owner's alone, while the
-- clinic can write. Each row is a patient as create_patient adds one —
-- without an assigned doctor, which an import does not carry — numbered from
-- the same counter in the order given; a row refused refuses the batch. The
-- rows were checked in the browser and again by the route; each column's
-- CHECK and check_patient are the last word. Hands back the patients added.
create or replace function public.import_patients(p_patients jsonb)
returns setof public.patients
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
begin
  if clinic is null or not public.is_clinic_owner() then
    raise exception 'Importing patients is the owner''s' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);

  return query
  with added as (
    insert into public.patients (
      clinic_id, full_name, phone, alt_phone, email, date_of_birth, dob_is_estimated, gender,
      address, emergency_contact_name, emergency_contact_phone, notes
    )
    select clinic, given.full_name, given.phone, given.alt_phone, given.email, given.date_of_birth,
           coalesce(given.dob_is_estimated, false), given.gender, given.address,
           given.emergency_contact_name, given.emergency_contact_phone, given.notes
      from jsonb_populate_recordset(null::public.patients, p_patients) with ordinality as given
     order by given.ordinality
    returning *
  )
  select * from added order by added.patient_number;
end;
$$;

revoke all on function public.import_patients(jsonb) from public, anon;
grant execute on function public.import_patients(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 6. The search (plan §10.2; D98, D104)
-- ------------------------------------------------------------

-- The caller's patients, active or archived, a page at a time. It runs as
-- the caller, so the patients policy applies: a doctor finds only their own.
-- With nothing to look for, newest first. With words, best match first: the
-- number, then the mobile's digits, then names that start with the words,
-- contain them, or come close (trigram word similarity: a letter typed
-- wrong) — newest first among equals. The app reads the words, the digits and
-- the number out of what was typed, wildcards dropped (src/lib/supabase/search.ts).
create or replace function public.search_patients(
  p_words text,
  p_digits text,
  p_number integer,
  p_archived boolean,
  p_offset integer,
  p_limit integer
)
returns setof public.patients
language sql
stable
set search_path = ''
as $$
  select patient.*
    from public.patients as patient
   where patient.clinic_id = (select public.current_clinic_id())
     and (patient.archived_at is not null) = p_archived
     and (
       p_words is null
       or patient.patient_number = p_number
       or patient.phone like '%' || p_digits || '%'
       or patient.full_name ilike '%' || p_words || '%'
       or p_words operator(extensions.<%) patient.full_name
     )
   order by
     coalesce(patient.patient_number = p_number, false) desc,
     coalesce(patient.phone like '%' || p_digits || '%', false) desc,
     coalesce(patient.full_name ilike p_words || '%', false) desc,
     coalesce(patient.full_name ilike '%' || p_words || '%', false) desc,
     coalesce(extensions.word_similarity(p_words, patient.full_name), 0) desc,
     patient.patient_number desc
  offset p_offset
   limit p_limit;
$$;

revoke all on function public.search_patients(text, text, integer, boolean, integer, integer) from public, anon;
grant execute on function public.search_patients(text, text, integer, boolean, integer, integer) to authenticated;

-- ------------------------------------------------------------
-- Policies (plan §27.4)
-- ------------------------------------------------------------

alter table public.patient_counters enable row level security;
alter table public.patients enable row level security;
alter table public.patient_doctors enable row level security;
alter table public.patient_alerts enable row level security;

create policy patients_select on public.patients
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('patients.view'))
  and ((select public.sees_every_patient()) or id in (select public.doctor_patient_ids()))
);

create policy patients_update on public.patients
for update to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('patients.edit'))
  and ((select public.sees_every_patient()) or id in (select public.doctor_patient_ids()))
  and (select public.clinic_can_write())
)
with check (clinic_id = (select public.current_clinic_id()));

create policy patient_alerts_select on public.patient_alerts
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('visits.view'))
  and ((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))
);

create policy patient_alerts_insert on public.patient_alerts
for insert to authenticated
with check (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('visits.edit'))
  and (select public.clinic_can_write())
  and ((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))
);

create policy patient_alerts_update on public.patient_alerts
for update to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('visits.edit'))
  and (select public.clinic_can_write())
  and ((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))
)
with check (clinic_id = (select public.current_clinic_id()));

-- A patient is added through create_patient or import_patients, and changed — archived and
-- restored too — column by column; never deleted. The counter and the access
-- list are the database's alone. An alert is added and changed (its label,
-- note, whether it is active); never deleted.
grant select on public.patients, public.patient_alerts to authenticated;
grant update (
  full_name, phone, alt_phone, email, date_of_birth, dob_is_estimated, gender, address,
  emergency_contact_name, emergency_contact_phone, assigned_doctor_id, notes, archived_at
) on public.patients to authenticated;
grant insert (clinic_id, patient_id, kind, label, note) on public.patient_alerts to authenticated;
grant update (label, note, active) on public.patient_alerts to authenticated;
