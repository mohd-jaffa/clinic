-- ============================================================
-- 0024 · Treatments (plan §14.1, §28.5; tracker R7.1, D248 – D255).
--
-- 1. `treatments`: a course of care that may span visits (a root canal over
--    three sittings) — the patient, their doctor, a name, a description, an
--    estimated cost (information only: money is billed through bills), and
--    the days it started, was completed and is next due. Started in a visit,
--    it names that visit and is its doctor's; from the profile, a doctor is
--    picked (D252). While it is open it may be handed to another doctor.
-- 2. Statuses move only as TREATMENT_STATUS_TRANSITIONS says
--    (treatment_status_next(), kept equal by tests/db). It starts on the day
--    it goes in progress; completing it stamps the day; cancelling it may
--    carry a reason (D250). Once closed — completed or cancelled — it has no
--    next due day, and its doctor stays.
-- 3. `treatment_sessions`: one per treatment and visit, with a note, so its
--    history reads visit by visit. Any visit of the patient may record one
--    (D249), and the first on a planned or on-hold treatment puts it in
--    progress (D248). Removed by mistake only while its visit is open (D254).
-- 4. Everything is written through functions, each checking `visits.edit`,
--    the doctor scope, an archived patient (D103) and that the clinic can
--    write: create_treatment, update_treatment, change_treatment_status,
--    record_treatment_session, remove_treatment_session. A change made from
--    an older copy is refused (D251), as a visit's sections are (D206).
--    Each hands back what it changed, for the audit row.
-- 5. Read with `visits.view`, within the doctor scope (D3), the estimated
--    cost included (D253). The doctor scope grows (plan §27.3): a
--    treatment's doctor sees its patient.
-- 6. A visit holds something once a treatment is started or worked on in
--    it: its row in the history says so, and Back to waiting keeps it (D197,
--    D226).
-- 7. A patient with an open treatment is not archived until it is completed
--    or cancelled (D255).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Treatments
-- ------------------------------------------------------------

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null,
  doctor_id uuid not null,
  -- Suggested from the price list's procedures (plan §14.1); TEXT_LIMITS.
  name text not null check (public.is_clean_line(name, 100)),
  description text check (public.is_clean_text(description, 1000)),
  status text not null default 'PLANNED'
    check (status in ('PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
  -- Information only (plan §14.1), within MAX_AMOUNT_PAISE.
  estimated_cost_paise integer check (estimated_cost_paise between 0 and 100000000),
  -- The day it went in progress, and the day it was completed; set by check_treatment.
  started_on date,
  completed_on date,
  -- When the patient is next due for it (plan §14.2): only while it is open.
  next_due_on date,
  -- Why it was cancelled, when someone said (D250).
  cancel_reason text check (public.is_clean_line(cancel_reason, 200)),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  -- The visit it was started in, if it was.
  started_visit_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- What the sessions' (and the bill lines', R8) composite foreign key points at.
  unique (id, clinic_id),
  -- The clinic's own patient, doctor and visit; a treatment is a record, so
  -- none of them is removed while it names them.
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id),
  foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id),
  foreign key (started_visit_id, clinic_id) references public.visits (id, clinic_id),
  -- Not started while planned; started once in progress or completed.
  constraint treatments_started check (
    (status <> 'PLANNED' or started_on is null)
    and (status not in ('IN_PROGRESS', 'COMPLETED') or started_on is not null)
  ),
  -- Completed on its day, never before it started.
  constraint treatments_completed check (
    (status = 'COMPLETED') = (completed_on is not null) and completed_on >= started_on
  ),
  -- Cancelled when it was; a reason only with it.
  constraint treatments_cancelled check (
    (status = 'CANCELLED') = (cancelled_at is not null) and (cancel_reason is null or status = 'CANCELLED')
  ),
  -- Due again only while open (plan §14.2).
  constraint treatments_next_due check (next_due_on is null or status in ('PLANNED', 'IN_PROGRESS', 'ON_HOLD'))
);

-- Every read leads with the clinic, in the order it is read (plan §37.1): a
-- patient's treatments, newest first (their profile, R7.2); a doctor's; the
-- visit one was started in.
create index treatments_clinic_id_patient_id_idx on public.treatments (clinic_id, patient_id, created_at desc);
create index treatments_clinic_id_doctor_id_idx on public.treatments (clinic_id, doctor_id);
create index treatments_clinic_id_started_visit_id_idx
  on public.treatments (clinic_id, started_visit_id) where started_visit_id is not null;
create index treatments_created_by_idx on public.treatments (created_by);
create index treatments_updated_by_idx on public.treatments (updated_by);
create index treatments_cancelled_by_idx on public.treatments (cancelled_by) where cancelled_by is not null;

-- Where a status may go next: TREATMENT_STATUS_TRANSITIONS, kept equal by tests/db.
create or replace function public.treatment_status_next(p_status text)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_status
    when 'PLANNED' then array['IN_PROGRESS', 'ON_HOLD', 'CANCELLED']
    when 'IN_PROGRESS' then array['ON_HOLD', 'COMPLETED', 'CANCELLED']
    when 'ON_HOLD' then array['IN_PROGRESS', 'CANCELLED']
    when 'COMPLETED' then array[]::text[]
    when 'CANCELLED' then array[]::text[]
  end;
$$;

revoke all on function public.treatment_status_next(text) from public, anon;
grant execute on function public.treatment_status_next(text) to authenticated;

-- What the shape alone cannot say: a treatment starts planned or in
-- progress; whose it is and where it started never change; a status moves
-- only where it may; it starts on the day it goes in progress, unless a
-- session gave its visit's day (D248); completing and cancelling are stamped
-- with when and by whom; once closed, its next due day goes and its doctor
-- stays (D252). Its doctor is one of the clinic's active doctors when given,
-- and a next due day is today or later when given.
create or replace function public.check_treatment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.clinic_today(new.clinic_id);
  doctor_given boolean := true;
  due_given boolean := true;
begin
  if tg_op = 'INSERT' then
    if new.status is null or new.status not in ('PLANNED', 'IN_PROGRESS') then
      raise exception 'A treatment starts planned or in progress' using hint = 'TREATMENT_STATUS_NOT_ALLOWED';
    end if;
  else
    if new.patient_id <> old.patient_id or new.started_visit_id is distinct from old.started_visit_id then
      raise exception 'Whose treatment it is does not change' using hint = 'VALIDATION_ERROR';
    end if;
    if new.status is distinct from old.status and not new.status = any (public.treatment_status_next(old.status)) then
      raise exception 'Not a move its status allows' using hint = 'TREATMENT_STATUS_NOT_ALLOWED';
    end if;
    doctor_given := new.doctor_id <> old.doctor_id;
    due_given := new.next_due_on is distinct from old.next_due_on;
    if old.status in ('COMPLETED', 'CANCELLED') and (doctor_given or due_given) then
      raise exception 'A closed treatment keeps its doctor and has no next due day' using hint = 'TREATMENT_CLOSED';
    end if;
    if new.status = 'COMPLETED' and old.status <> 'COMPLETED' then
      new.completed_on := today;
    end if;
    if new.status = 'CANCELLED' and old.status <> 'CANCELLED' then
      new.cancelled_at := now();
      new.cancelled_by := auth.uid();
    end if;
  end if;

  if new.status = 'PLANNED' then
    new.started_on := null;
  elsif new.status = 'IN_PROGRESS' and new.started_on is null then
    new.started_on := today;
  end if;
  if new.status in ('COMPLETED', 'CANCELLED') then
    new.next_due_on := null;
  elsif due_given and new.next_due_on < today then
    raise exception 'Next due today or later' using hint = 'VALIDATION_ERROR';
  end if;

  if doctor_given and not exists (
    select 1
      from public.doctors as doctor
      join public.clinic_members as member on member.id = doctor.member_id
     where doctor.id = new.doctor_id and doctor.clinic_id = new.clinic_id and doctor.active and member.status = 'ACTIVE'
  ) then
    raise exception 'Not one of the clinic''s active doctors' using hint = 'DOCTOR_INACTIVE';
  end if;
  return new;
end;
$$;

-- The doctor of a treatment sees its patient from then on (plan §27.3).
-- Never shrinks: handing it to another doctor adds them.
create or replace function public.add_treatment_doctor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.patient_doctors (clinic_id, patient_id, doctor_id)
  values (new.clinic_id, new.patient_id, new.doctor_id)
  on conflict do nothing;
  return null;
end;
$$;

revoke all on function public.check_treatment() from public, anon, authenticated;
revoke all on function public.add_treatment_doctor() from public, anon, authenticated;

create trigger check_treatment before insert or update on public.treatments
for each row execute function public.check_treatment();
create trigger set_treatments_actor before insert or update on public.treatments
for each row execute function public.set_actor();
create trigger set_treatments_updated_at before update on public.treatments
for each row execute function public.set_updated_at();
create trigger add_treatment_doctor after insert or update of doctor_id on public.treatments
for each row execute function public.add_treatment_doctor();

-- ------------------------------------------------------------
-- 2. Sessions
-- ------------------------------------------------------------

-- A visit that worked on a treatment (plan §14.1): one each, with a note.
create table public.treatment_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  treatment_id uuid not null,
  visit_id uuid not null,
  note text check (public.is_clean_text(note, 1000)),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (treatment_id, visit_id),
  foreign key (treatment_id, clinic_id) references public.treatments (id, clinic_id),
  foreign key (visit_id, clinic_id) references public.visits (id, clinic_id)
);

-- A treatment's sessions in the order they were recorded; a visit's sessions.
create index treatment_sessions_clinic_id_treatment_id_idx
  on public.treatment_sessions (clinic_id, treatment_id, created_at);
create index treatment_sessions_clinic_id_visit_id_idx on public.treatment_sessions (clinic_id, visit_id);
create index treatment_sessions_created_by_idx on public.treatment_sessions (created_by);
create index treatment_sessions_updated_by_idx on public.treatment_sessions (updated_by);

create trigger set_treatment_sessions_actor before insert or update on public.treatment_sessions
for each row execute function public.set_actor();
create trigger set_treatment_sessions_updated_at before update on public.treatment_sessions
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3. Writing a treatment (D248 – D252)
-- ------------------------------------------------------------

-- A treatment to change, held until the transaction ends: the clinic's,
-- within the doctor scope, with `visits.edit`, while the clinic can write and
-- its patient is not archived (D103).
create or replace function public.treatment_for_change(p_treatment_id uuid)
returns public.treatments
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  found public.treatments;
begin
  if clinic is null or not public.has_permission('visits.edit') then
    raise exception 'Changing a treatment needs visits.edit' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  select * into found
    from public.treatments as treatment
   where treatment.id = p_treatment_id and treatment.clinic_id = clinic
   for update;
  if found.id is null or not public.can_see_patient(found.patient_id) then
    raise exception 'No such treatment' using hint = 'RECORD_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.patients as patient where patient.id = found.patient_id and patient.archived_at is not null
  ) then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;
  return found;
end;
$$;

revoke all on function public.treatment_for_change(uuid) from public, anon, authenticated;

-- A new treatment (plan §14.1): `visits.edit`, while the clinic can write.
-- In a visit (`p_visit_id`), it is that visit's patient's and doctor's
-- (D252); from the profile, `p_treatment` names the patient and the doctor.
-- It starts planned, or in progress — and then, in a visit, that visit is
-- its first session, with the note given (D248). Only a treatment's own
-- fields are read from `p_treatment`; each column's CHECK and
-- check_treatment are the last word. Hands back the treatment and the
-- session it recorded, if any.
create or replace function public.create_treatment(p_treatment jsonb, p_visit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  visit public.visits;
  patient public.patients;
  doctor uuid := (p_treatment ->> 'doctor_id')::uuid;
  starting text := p_treatment ->> 'status';
  made public.treatments;
  session uuid;
begin
  if clinic is null or not public.has_permission('visits.edit') then
    raise exception 'Starting a treatment needs visits.edit' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  if p_visit_id is not null then
    visit := public.visit_for_change(p_visit_id, 'visits.edit');
    doctor := visit.doctor_id;
    select * into patient from public.patients as candidate where candidate.id = visit.patient_id;
  else
    select * into patient
      from public.patients as candidate
     where candidate.id = (p_treatment ->> 'patient_id')::uuid and candidate.clinic_id = clinic;
    if patient.id is null or not public.can_see_patient(patient.id) then
      raise exception 'No such patient' using hint = 'RECORD_NOT_FOUND';
    end if;
    if patient.archived_at is not null then
      raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
    end if;
  end if;

  insert into public.treatments (
    clinic_id, patient_id, doctor_id, name, description, status, estimated_cost_paise, next_due_on,
    started_on, started_visit_id
  )
  values (
    clinic, patient.id, doctor, p_treatment ->> 'name', p_treatment ->> 'description', starting,
    (p_treatment ->> 'estimated_cost_paise')::integer, (p_treatment ->> 'next_due_on')::date,
    case when starting = 'IN_PROGRESS' then visit.visit_date end, visit.id
  )
  returning * into made;

  if made.status = 'IN_PROGRESS' and visit.id is not null then
    insert into public.treatment_sessions (clinic_id, treatment_id, visit_id, note)
    values (clinic, made.id, visit.id, p_treatment ->> 'note')
    returning id into session;
  end if;
  return jsonb_build_object('treatment_id', made.id, 'session_id', session);
end;
$$;

-- A treatment's details (plan §14.1): its name, description, estimated
-- cost, next due day or doctor — whichever `p_changes` names, compared with
-- `p_seen` as the screen last read them (D251). A closed treatment's doctor
-- and next due day stay (D252). Hands back the details before and after.
create or replace function public.update_treatment(p_treatment_id uuid, p_changes jsonb, p_seen jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  treatment public.treatments := public.treatment_for_change(p_treatment_id);
  fields text[] := array(select jsonb_object_keys(p_changes));
  before jsonb;
  saved public.treatments;
begin
  if cardinality(fields) = 0
     or not fields <@ array['name', 'description', 'estimated_cost_paise', 'next_due_on', 'doctor_id'] then
    raise exception 'Not a detail of a treatment' using hint = 'VALIDATION_ERROR';
  end if;
  before := (select jsonb_object_agg(field, to_jsonb(treatment) -> field) from unnest(fields) as field);
  if before is distinct from p_seen then
    raise exception 'The treatment changed meanwhile' using hint = 'TREATMENT_CHANGED';
  end if;

  update public.treatments as changed
     set name = case when p_changes ? 'name' then p_changes ->> 'name' else changed.name end,
         description = case when p_changes ? 'description' then p_changes ->> 'description' else changed.description end,
         estimated_cost_paise = case
           when p_changes ? 'estimated_cost_paise' then (p_changes ->> 'estimated_cost_paise')::integer
           else changed.estimated_cost_paise
         end,
         next_due_on = case
           when p_changes ? 'next_due_on' then (p_changes ->> 'next_due_on')::date else changed.next_due_on
         end,
         doctor_id = case when p_changes ? 'doctor_id' then (p_changes ->> 'doctor_id')::uuid else changed.doctor_id end
   where changed.id = treatment.id
  returning * into saved;

  return jsonb_build_object(
    'before', before,
    'after', (select jsonb_object_agg(field, to_jsonb(saved) -> field) from unnest(fields) as field)
  );
end;
$$;

-- A treatment's status (plan §14.1), as TREATMENT_STATUS_TRANSITIONS allows,
-- from the status the screen last read (`p_seen`, D251); a cancellation may
-- carry a reason (D250). The same change sent twice — a double tap —
-- changes nothing more. Hands back the status before and after.
create or replace function public.change_treatment_status(
  p_treatment_id uuid,
  p_status text,
  p_seen text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.treatments := public.treatment_for_change(p_treatment_id);
begin
  if p_reason is not null and p_status is distinct from 'CANCELLED' then
    raise exception 'A reason goes only with a cancellation' using hint = 'VALIDATION_ERROR';
  end if;
  if was.status = p_status then
    return jsonb_build_object('before', was.status, 'after', was.status);
  end if;
  if was.status is distinct from p_seen then
    raise exception 'The treatment changed meanwhile' using hint = 'TREATMENT_CHANGED';
  end if;
  if p_status is null or not p_status = any (public.treatment_status_next(was.status)) then
    raise exception 'Not a move its status allows' using hint = 'TREATMENT_STATUS_NOT_ALLOWED';
  end if;

  update public.treatments
     set status = p_status, cancel_reason = p_reason
   where id = was.id;
  return jsonb_build_object('before', was.status, 'after', p_status);
end;
$$;

-- ------------------------------------------------------------
-- 4. Sessions (D248, D249, D254)
-- ------------------------------------------------------------

-- A visit's work on one of its patient's treatments (plan §14.1): any of
-- their visits (D249), `visits.edit` — once the visit is done, a correction
-- (D208). Recorded once, or its note changed, compared with `p_seen` — its
-- note as the screen last read it, or null for none yet (D206). A new
-- session needs an open treatment; on a planned or on-hold one it puts the
-- treatment in progress, started on the visit's day if not before (D248).
-- Hands back the session, whether this call recorded it, its note before
-- and after, and the treatment's status before, if it moved.
create or replace function public.record_treatment_session(
  p_treatment_id uuid,
  p_visit_id uuid,
  p_note text,
  p_seen jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  visit public.visits := public.visit_for_change(p_visit_id, 'visits.edit');
  treatment public.treatments;
  found public.treatment_sessions;
  before jsonb;
  saved public.treatment_sessions;
begin
  select * into treatment
    from public.treatments as candidate
   where candidate.id = p_treatment_id and candidate.clinic_id = visit.clinic_id
   for update;
  if treatment.id is null or treatment.patient_id <> visit.patient_id then
    raise exception 'No such treatment of the visit''s patient' using hint = 'RECORD_NOT_FOUND';
  end if;
  select * into found
    from public.treatment_sessions as session
   where session.treatment_id = treatment.id and session.visit_id = visit.id;
  before := case when found.id is not null then jsonb_build_object('note', found.note) end;
  if before is distinct from p_seen then
    raise exception 'The session changed meanwhile' using hint = 'VISIT_CHANGED';
  end if;

  if found.id is not null then
    update public.treatment_sessions set note = p_note where id = found.id returning * into saved;
  else
    if treatment.status in ('COMPLETED', 'CANCELLED') then
      raise exception 'A closed treatment takes no session' using hint = 'TREATMENT_CLOSED';
    end if;
    if treatment.status in ('PLANNED', 'ON_HOLD') then
      update public.treatments
         set status = 'IN_PROGRESS', started_on = coalesce(started_on, visit.visit_date)
       where id = treatment.id;
    end if;
    insert into public.treatment_sessions (clinic_id, treatment_id, visit_id, note)
    values (visit.clinic_id, treatment.id, visit.id, p_note)
    returning * into saved;
  end if;

  return jsonb_build_object(
    'session_id', saved.id,
    'created', found.id is null,
    'before', before,
    'after', jsonb_build_object('note', saved.note),
    'moved_from', case when found.id is null and treatment.status <> 'IN_PROGRESS' then treatment.status end
  );
end;
$$;

-- A session recorded by mistake (D254): removed while its visit is open,
-- `visits.edit`; once the visit is done it stays, and only its note is
-- corrected. A treatment it started stays started. Hands back what it was.
create or replace function public.remove_treatment_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  found public.treatment_sessions;
  visit public.visits;
begin
  if clinic is null or not public.has_permission('visits.edit') then
    raise exception 'Removing a session needs visits.edit' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  select * into found
    from public.treatment_sessions as session
   where session.id = p_session_id and session.clinic_id = clinic;
  if found.id is null then
    raise exception 'No such session' using hint = 'RECORD_NOT_FOUND';
  end if;
  visit := public.visit_for_change(found.visit_id, 'visits.edit');
  if visit.status <> 'OPEN' then
    raise exception 'A done visit keeps its sessions' using hint = 'TREATMENT_SESSION_KEPT';
  end if;
  delete from public.treatment_sessions where id = found.id;
  return jsonb_build_object('treatment_id', found.treatment_id, 'visit_id', found.visit_id);
end;
$$;

revoke all on function public.create_treatment(jsonb, uuid) from public, anon;
revoke all on function public.update_treatment(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.change_treatment_status(uuid, text, text, text) from public, anon;
revoke all on function public.record_treatment_session(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.remove_treatment_session(uuid) from public, anon;
grant execute on function public.create_treatment(jsonb, uuid) to authenticated;
grant execute on function public.update_treatment(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.change_treatment_status(uuid, text, text, text) to authenticated;
grant execute on function public.record_treatment_session(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.remove_treatment_session(uuid) to authenticated;

-- ------------------------------------------------------------
-- 5. What counts as recorded (D197, D226)
-- ------------------------------------------------------------

-- As 0022's — a complaint, diagnosis, notes or follow-up; a reading taken; a
-- prescription with a medicine or advice — and now a treatment started in
-- the visit, or a session of one. Runs as the caller, so it reads only what
-- the policies let them.
create or replace function public.visit_recorded(p_visit public.visits)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_visit.complaint is not null or p_visit.diagnosis is not null
      or p_visit.notes is not null or p_visit.follow_up_on is not null
      or exists (
        select 1
          from public.vitals as vital
         where vital.clinic_id = p_visit.clinic_id
           and vital.visit_id = p_visit.id
           and (vital.systolic is not null or vital.diastolic is not null or vital.pulse is not null
                or vital.temperature_f is not null or vital.spo2 is not null or vital.respiratory_rate is not null
                or vital.weight_kg is not null or vital.height_cm is not null)
      )
      or exists (
        select 1
          from public.prescriptions as prescription
         where prescription.clinic_id = p_visit.clinic_id
           and prescription.visit_id = p_visit.id
           and (prescription.advice is not null
                or exists (select 1 from public.prescription_items as item where item.prescription_id = prescription.id))
      )
      or exists (
        select 1
          from public.treatments as treatment
         where treatment.clinic_id = p_visit.clinic_id and treatment.started_visit_id = p_visit.id
      )
      or exists (
        select 1
          from public.treatment_sessions as session
         where session.clinic_id = p_visit.clinic_id and session.visit_id = p_visit.id
      );
$$;

-- ------------------------------------------------------------
-- 6. Archiving a patient with an open treatment (D255)
-- ------------------------------------------------------------

-- As 0017's, and one rule more: a patient is not archived while a treatment
-- of theirs is open — planned, in progress or on hold — completed or
-- cancelled first; the refusal names the first of them to whoever may read
-- treatments (`visits.view`), and to anyone else says only that there is one.
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
  upcoming timestamptz;
  open_treatment text;
begin
  if tg_op = 'UPDATE' then
    if old.archived_at is not null and new.archived_at is not null then
      raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
    end if;
    if old.archived_at is null and new.archived_at is not null then
      select appointment.scheduled_at into upcoming
        from public.appointments as appointment
       where appointment.clinic_id = new.clinic_id
         and appointment.patient_id = new.id
         and (
           (appointment.status in ('SCHEDULED', 'CONFIRMED', 'ARRIVED') and appointment.local_date >= today)
           or appointment.status = 'IN_PROGRESS'
         )
       order by appointment.scheduled_at
       limit 1;
      if upcoming is not null then
        raise exception 'Cancel or move their appointments first' using
          hint = 'PATIENT_HAS_APPOINTMENTS',
          detail = json_build_object('scheduledAt', upcoming)::text;
      end if;
      select treatment.name into open_treatment
        from public.treatments as treatment
       where treatment.clinic_id = new.clinic_id
         and treatment.patient_id = new.id
         and treatment.status in ('PLANNED', 'IN_PROGRESS', 'ON_HOLD')
       order by treatment.created_at
       limit 1;
      if open_treatment is not null then
        raise exception 'Complete or cancel their open treatments first' using
          hint = 'PATIENT_HAS_TREATMENTS',
          detail = json_build_object(
            'name', case when public.has_permission('visits.view') then open_treatment end
          )::text;
      end if;
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

-- ------------------------------------------------------------
-- Policies (plan §27.4)
-- ------------------------------------------------------------

alter table public.treatments enable row level security;
alter table public.treatment_sessions enable row level security;

-- visits.view, within the doctor scope (D3), worked out once a statement
-- (plan §37.1); the estimated cost with the rest (D253).
create policy treatments_select on public.treatments
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('visits.view'))
  and ((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))
);

-- A treatment's sessions, where the treatment itself can be read.
create policy treatment_sessions_select on public.treatment_sessions
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and exists (select 1 from public.treatments as treatment where treatment.id = treatment_id)
);

-- Written only through the functions above; a treatment is never deleted —
-- it is completed or cancelled — and a session only by mistake, while its
-- visit is open (D254).
grant select on public.treatments to authenticated;
grant select on public.treatment_sessions to authenticated;
