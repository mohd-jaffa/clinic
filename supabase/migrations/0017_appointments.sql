-- ============================================================
-- 0017 · Appointments (plan §11, §27.3, §28.4; tracker R5.1, D87, D103,
-- D137 – D143).
--
-- 1. `appointments`: a patient, a doctor, one of the clinic's appointment
--    types, a start and a length (5 – 480 minutes). Booked ahead on the
--    clinic's 5-minute steps, or a walk-in at the desk now. Its day in the
--    clinic's timezone (`local_date`) is the database's to set.
-- 2. No double-booking (D7): a booked appointment's time may not overlap
--    another live booked one of the same doctor — an exclusion constraint,
--    never a read-then-write check. A walk-in holds no slot, so never clashes.
-- 3. Statuses move only as APPOINTMENT_STATUS_TRANSITIONS says
--    (appointment_status_next(), kept equal by tests/db); a patient who
--    arrived and left before being seen becomes a no-show (D138). In progress
--    and completed are the queue's to reach (0018).
-- 4. Tokens (plan §11.3): each patient who arrives takes the next number of
--    the doctor's day from `daily_tokens`, under a row lock — never max() + 1.
--    They keep it for the day if they go back and arrive again (D141).
-- 5. Booking, moving, arriving and walk-ins are functions (AGENTS.md §25),
--    each checking its permission, the doctor scope and that the clinic can
--    write: create_appointment, update_appointment, change_appointment_status,
--    mark_arrived, add_walk_in. Nothing is booked for an archived patient
--    (D103), on a closed day (D139), in the past, or with a doctor no longer
--    active. A confirmed appointment moved is scheduled again (D142); a
--    patient arrives only on the appointment's own day (D143).
-- 6. The doctor scope grows (plan §27.3): a doctor with an appointment sees
--    its patient.
-- 7. A patient with appointments to come is not archived until they are
--    cancelled or moved (D140).
-- 8. closure_appointments: the appointments on the days of a holiday or leave
--    being added, for its sheet (D87, D137).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Appointments
-- ------------------------------------------------------------

-- What an appointment's composite foreign key points at, so it can only ever
-- name a type of the same clinic.
alter table public.appointment_types add constraint appointment_types_id_clinic_unique unique (id, clinic_id);

-- The time an appointment holds, its start included and its end not, so
-- back-to-back appointments do not overlap. Minutes are minutes in every
-- timezone, so it is immutable, as an exclusion constraint needs; its
-- search_path keeps it from being inlined into the stable sum it wraps.
create or replace function public.appointment_slot(p_starts_at timestamptz, p_minutes integer)
returns tstzrange
language sql
immutable
parallel safe
set search_path = ''
as $$
  select tstzrange(p_starts_at, p_starts_at + make_interval(mins => p_minutes), '[)');
$$;

revoke all on function public.appointment_slot(timestamptz, integer) from public, anon, authenticated;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null,
  doctor_id uuid not null,
  source text not null check (source in ('BOOKED', 'WALK_IN')),
  appointment_type_id uuid not null,
  scheduled_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  -- The day it falls on in the clinic's timezone; set by check_appointment.
  local_date date not null,
  status text not null default 'SCHEDULED'
    check (status in ('SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  -- The doctor's day's number (#7), taken on arrival and kept for the day (D141).
  token_number integer check (token_number >= 1),
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  -- Not clinical: "first visit", "bring the X-ray".
  notes text check (public.is_clean_text(notes, 1000)),
  cancel_reason text check (public.is_clean_line(cancel_reason, 200)),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  reminded_at timestamptz,
  -- The key the booking or walk-in was sent with: sent twice, it makes one (plan §26).
  idempotency_key uuid,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, idempotency_key),
  -- What a later table's composite foreign key points at (the visit, the bill).
  unique (id, clinic_id),
  -- A token is the doctor's day's, given once.
  unique (doctor_id, local_date, token_number),
  -- The clinic's own patient, doctor and type; an appointment is a record, so
  -- none of them is removed while it names them.
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id),
  foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id),
  foreign key (appointment_type_id, clinic_id) references public.appointment_types (id, clinic_id),
  -- A booking starts on the clinic's 5-minute steps (APPOINTMENT_STEP_MINUTES); a walk-in at now.
  constraint appointments_on_the_step check (source = 'WALK_IN' or extract(epoch from scheduled_at) % 300 = 0),
  -- Cancelled with a reason, stamped when it was.
  constraint appointments_cancelled check (
    (status = 'CANCELLED') = (cancelled_at is not null) and (cancelled_at is null or cancel_reason is not null)
  ),
  constraint appointments_no_double_booking exclude using gist (
    doctor_id with =,
    public.appointment_slot(scheduled_at, duration_minutes) with &&
  ) where (source = 'BOOKED' and status not in ('CANCELLED', 'NO_SHOW'))
);

-- Every read below leads with the clinic, in the order it is read (plan §37.1).
-- The calendar's day and today's queue, by time (plan §11.4, §11.5); a closure's days (D137).
create index appointments_clinic_id_local_date_idx on public.appointments (clinic_id, local_date, scheduled_at);
-- One doctor's days and week (plan §11.5); also the doctor's foreign key.
create index appointments_clinic_id_doctor_id_idx on public.appointments (clinic_id, doctor_id, local_date, scheduled_at);
-- A patient's appointments, latest first, and what is still to come (D101, D140); also the patient's foreign key.
create index appointments_clinic_id_patient_id_idx on public.appointments (clinic_id, patient_id, scheduled_at desc);
-- The other foreign keys, followed when a type or an account goes.
create index appointments_appointment_type_id_idx on public.appointments (appointment_type_id);
create index appointments_created_by_idx on public.appointments (created_by);
create index appointments_updated_by_idx on public.appointments (updated_by);
create index appointments_cancelled_by_idx on public.appointments (cancelled_by) where cancelled_by is not null;

-- ------------------------------------------------------------
-- 2. Tokens (plan §11.3)
-- ------------------------------------------------------------

-- Each doctor's last token of a day; a day's first arrival starts it at 1.
create table public.daily_tokens (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  doctor_id uuid not null,
  day date not null,
  last_token integer not null check (last_token >= 1),
  primary key (doctor_id, day),
  foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id) on delete cascade
);

create index daily_tokens_clinic_id_idx on public.daily_tokens (clinic_id);

-- The doctor's next token of the day: the upsert locks the counter's row, so
-- two patients arriving at once never share a number.
create or replace function public.next_token(p_clinic_id uuid, p_doctor_id uuid, p_day date)
returns integer
language sql
security definer
set search_path = ''
as $$
  insert into public.daily_tokens as counter (clinic_id, doctor_id, day, last_token)
  values (p_clinic_id, p_doctor_id, p_day, 1)
  on conflict (doctor_id, day) do update set last_token = counter.last_token + 1
  returning counter.last_token;
$$;

revoke all on function public.next_token(uuid, uuid, date) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3. Statuses (plan §11.2, D138)
-- ------------------------------------------------------------

-- Where a status may go next: APPOINTMENT_STATUS_TRANSITIONS, kept equal by tests/db.
create or replace function public.appointment_status_next(p_status text)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_status
    when 'SCHEDULED' then array['CONFIRMED', 'ARRIVED', 'CANCELLED', 'NO_SHOW']
    when 'CONFIRMED' then array['ARRIVED', 'SCHEDULED', 'CANCELLED', 'NO_SHOW']
    when 'ARRIVED' then array['IN_PROGRESS', 'SCHEDULED', 'CANCELLED', 'NO_SHOW']
    when 'IN_PROGRESS' then array['COMPLETED', 'ARRIVED']
    when 'NO_SHOW' then array['ARRIVED']
    when 'COMPLETED' then array[]::text[]
    when 'CANCELLED' then array[]::text[]
  end;
$$;

revoke all on function public.appointment_status_next(text) from public, anon;
grant execute on function public.appointment_status_next(text) to authenticated;

-- ------------------------------------------------------------
-- What the shape alone cannot say
-- ------------------------------------------------------------

-- The day an appointment falls on, in the clinic's timezone (AGENTS.md §15);
-- a status moves only where it may; a token is given back when the
-- appointment moves to another day or doctor (D141); a cancellation is
-- stamped with when and by whom, whatever a function was handed.
create or replace function public.check_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select (new.scheduled_at at time zone clinic.timezone)::date into new.local_date
    from public.clinics as clinic
   where clinic.id = new.clinic_id;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status and not new.status = any (public.appointment_status_next(old.status)) then
      raise exception 'Not a move its status allows' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
    end if;
    if new.doctor_id is distinct from old.doctor_id or new.local_date is distinct from old.local_date then
      new.token_number := null;
    end if;
    if new.status = 'CANCELLED' and old.status <> 'CANCELLED' then
      new.cancelled_at := now();
      new.cancelled_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

-- The doctor of an appointment sees its patient from then on (plan §27.3).
-- Never shrinks: moving it to another doctor adds them.
create or replace function public.add_appointment_doctor()
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

revoke all on function public.check_appointment() from public, anon, authenticated;
revoke all on function public.add_appointment_doctor() from public, anon, authenticated;

create trigger check_appointment before insert or update on public.appointments
for each row execute function public.check_appointment();
create trigger set_appointments_actor before insert or update on public.appointments
for each row execute function public.set_actor();
create trigger set_appointments_updated_at before update on public.appointments
for each row execute function public.set_updated_at();
create trigger add_appointment_doctor after insert or update of doctor_id on public.appointments
for each row execute function public.add_appointment_doctor();

-- ------------------------------------------------------------
-- 4. What every booking asks (plan §11.1)
-- ------------------------------------------------------------

-- The patient is one the caller may see, and not archived (D103); the doctor
-- one of the clinic's active doctors; the type, when one is chosen, one of
-- its active types. A booking starts no earlier than the 5-minute step it is
-- made in; a walk-in is now. Neither falls on a clinic holiday or the
-- doctor's leave (D139) — named in the refusal's detail, never a patient.
create or replace function public.check_booking(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_doctor_id uuid,
  p_type_id uuid,
  p_starts_at timestamptz,
  p_booked boolean
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  day date;
  closure public.clinic_closures;
begin
  if p_patient_id is null or not public.can_see_patient(p_patient_id) then
    raise exception 'No such patient' using hint = 'RECORD_NOT_FOUND';
  end if;
  if exists (select 1 from public.patients as patient where patient.id = p_patient_id and patient.archived_at is not null) then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;
  if not exists (
    select 1
      from public.doctors as doctor
      join public.clinic_members as member on member.id = doctor.member_id
     where doctor.id = p_doctor_id and doctor.clinic_id = p_clinic_id and doctor.active and member.status = 'ACTIVE'
  ) then
    raise exception 'Not one of the clinic''s active doctors' using hint = 'DOCTOR_INACTIVE';
  end if;
  if p_type_id is not null and not exists (
    select 1 from public.appointment_types as type
     where type.id = p_type_id and type.clinic_id = p_clinic_id and type.active
  ) then
    raise exception 'Not one of the clinic''s appointment types' using hint = 'APPOINTMENT_TYPE_INACTIVE';
  end if;
  if p_booked and p_starts_at < to_timestamp(floor(extract(epoch from now()) / 300) * 300) then
    raise exception 'A booking is for now or later' using hint = 'APPOINTMENT_IN_PAST';
  end if;

  select (p_starts_at at time zone clinic.timezone)::date into day
    from public.clinics as clinic
   where clinic.id = p_clinic_id;
  select * into closure
    from public.clinic_closures as c
   where c.clinic_id = p_clinic_id
     and day between c.starts_on and c.ends_on
     and (c.doctor_id is null or c.doctor_id = p_doctor_id)
   order by c.doctor_id nulls first
   limit 1;
  if closure.id is not null then
    raise exception 'Closed that day' using
      hint = 'APPOINTMENT_ON_CLOSED_DAY',
      detail = json_build_object('reason', closure.reason, 'wholeClinic', closure.doctor_id is null)::text;
  end if;
end;
$$;

-- What a clash answers (D7): the time it clashed with, never whose it is. The
-- exclusion constraint refused the write; this only names the time.
create or replace function public.raise_slot_taken(
  p_doctor_id uuid,
  p_starts_at timestamptz,
  p_minutes integer,
  p_except uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clash public.appointments;
begin
  select * into clash
    from public.appointments as appointment
   where appointment.doctor_id = p_doctor_id
     and appointment.source = 'BOOKED'
     and appointment.status not in ('CANCELLED', 'NO_SHOW')
     and public.appointment_slot(appointment.scheduled_at, appointment.duration_minutes)
         && public.appointment_slot(p_starts_at, p_minutes)
     and appointment.id is distinct from p_except
   order by appointment.scheduled_at
   limit 1;
  raise exception 'That time is taken' using
    hint = 'APPOINTMENT_SLOT_TAKEN',
    detail = json_build_object(
      'startsAt', clash.scheduled_at,
      'endsAt', clash.scheduled_at + make_interval(mins => clash.duration_minutes)
    )::text;
end;
$$;

-- An appointment the caller may change: one of their clinic's, of a patient
-- they may see, with the permission named, while the clinic can write.
-- Locked until the change is done.
create or replace function public.appointment_for_change(p_appointment_id uuid, p_permission text)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  found public.appointments;
begin
  if clinic is null or not public.has_permission(p_permission) then
    raise exception 'Changing an appointment needs its permission' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  select * into found
    from public.appointments as appointment
   where appointment.id = p_appointment_id and appointment.clinic_id = clinic
   for update;
  if found.id is null or not public.can_see_patient(found.patient_id) then
    raise exception 'No such appointment' using hint = 'RECORD_NOT_FOUND';
  end if;
  return found;
end;
$$;

revoke all on function public.check_booking(uuid, uuid, uuid, uuid, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.raise_slot_taken(uuid, timestamptz, integer, uuid) from public, anon, authenticated;
revoke all on function public.appointment_for_change(uuid, text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 5. Booking, moving, arriving, walk-ins
-- ------------------------------------------------------------

-- A booking (plan §11.1): appointments.create, while the clinic can write.
-- Only an appointment's own fields are read from `p_appointment`; the
-- clinic, the source and the status are the database's. The same key sent
-- again finds the appointment the first made and books none (plan §26).
-- Hands back the appointment, and whether this call booked it.
create or replace function public.create_appointment(p_appointment jsonb, p_idempotency_key uuid)
returns table (appointment_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  given public.appointments;
  booked uuid;
begin
  if clinic is null or not public.has_permission('appointments.create') then
    raise exception 'Booking needs appointments.create' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  if p_idempotency_key is null then
    raise exception 'A booking needs its idempotency key' using hint = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  perform public.require_clinic_write(clinic);

  perform pg_advisory_xact_lock(hashtextextended(clinic::text || ':' || p_idempotency_key::text, 0));
  select appointment.id into booked
    from public.appointments as appointment
   where appointment.clinic_id = clinic and appointment.idempotency_key = p_idempotency_key;
  if booked is not null then
    return query select booked, false;
    return;
  end if;

  given := jsonb_populate_record(null::public.appointments, p_appointment);
  perform public.check_booking(
    clinic, given.patient_id, given.doctor_id, given.appointment_type_id, given.scheduled_at, true
  );
  insert into public.appointments (
    clinic_id, patient_id, doctor_id, source, appointment_type_id, scheduled_at, duration_minutes, notes,
    idempotency_key
  )
  values (
    clinic, given.patient_id, given.doctor_id, 'BOOKED', given.appointment_type_id, given.scheduled_at,
    given.duration_minutes, given.notes, p_idempotency_key
  )
  returning id into booked;
  return query select booked, true;
exception
  when exclusion_violation then
    perform public.raise_slot_taken(given.doctor_id, given.scheduled_at, given.duration_minutes, null);
end;
$$;

-- A change to a booking (plan §11.5): appointments.edit. Only the fields
-- named in `p_changes` change. Its time, length, doctor or type change only
-- while it is booked and not yet arrived, under every rule a new booking
-- keeps; a confirmed one moved to another time or doctor is scheduled again,
-- to be confirmed anew (D142). Its notes change at any time.
create or replace function public.update_appointment(p_appointment_id uuid, p_changes jsonb)
returns setof public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.appointments := public.appointment_for_change(p_appointment_id, 'appointments.edit');
  now_is public.appointments;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or exists (
    select 1 from jsonb_object_keys(p_changes) as name
     where name <> all (array['doctor_id', 'appointment_type_id', 'scheduled_at', 'duration_minutes', 'notes'])
  ) then
    raise exception 'Only an appointment''s own fields change' using errcode = '22023';
  end if;
  now_is := jsonb_populate_record(was, p_changes);

  if (now_is.doctor_id, now_is.appointment_type_id, now_is.scheduled_at, now_is.duration_minutes)
     is distinct from (was.doctor_id, was.appointment_type_id, was.scheduled_at, was.duration_minutes) then
    if was.source <> 'BOOKED' or was.status not in ('SCHEDULED', 'CONFIRMED') then
      raise exception 'Only a booking not yet arrived is moved' using hint = 'APPOINTMENT_NOT_MOVABLE';
    end if;
    perform public.check_booking(
      was.clinic_id, was.patient_id, now_is.doctor_id,
      case when now_is.appointment_type_id is distinct from was.appointment_type_id then now_is.appointment_type_id end,
      now_is.scheduled_at, true
    );
    if was.status = 'CONFIRMED'
       and (now_is.scheduled_at, now_is.doctor_id) is distinct from (was.scheduled_at, was.doctor_id) then
      now_is.status := 'SCHEDULED';
    end if;
  end if;

  return query
  update public.appointments as appointment
     set doctor_id = now_is.doctor_id,
         appointment_type_id = now_is.appointment_type_id,
         scheduled_at = now_is.scheduled_at,
         duration_minutes = now_is.duration_minutes,
         notes = now_is.notes,
         status = now_is.status
   where appointment.id = was.id
  returning appointment.*;
exception
  when exclusion_violation then
    perform public.raise_slot_taken(now_is.doctor_id, now_is.scheduled_at, now_is.duration_minutes, was.id);
end;
$$;

-- Confirmed, back to scheduled, cancelled, or a no-show (plan §11.2):
-- appointments.cancel to cancel, with a reason; appointments.edit for the
-- rest. Arriving takes a token (mark_arrived); in progress and completed are
-- the queue's (0018). A walk-in was never booked, so it is cancelled rather
-- than scheduled. Going back to scheduled keeps its token for the day (D141).
create or replace function public.change_appointment_status(
  p_appointment_id uuid,
  p_status text,
  p_reason text default null
)
returns setof public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.appointments := public.appointment_for_change(
    p_appointment_id,
    case when p_status = 'CANCELLED' then 'appointments.cancel' else 'appointments.edit' end
  );
begin
  if p_status is null or p_status not in ('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'NO_SHOW')
     or (was.source = 'WALK_IN' and p_status in ('SCHEDULED', 'CONFIRMED')) then
    raise exception 'Not a status changed here' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
  end if;
  if p_status = 'CANCELLED' and p_reason is null then
    raise exception 'A cancellation takes a reason' using hint = 'APPOINTMENT_CANCEL_REASON_REQUIRED';
  end if;
  -- The same change sent twice — a double tap — changes nothing more.
  if was.status = p_status then
    return next was;
    return;
  end if;

  return query
  update public.appointments as appointment
     set status = p_status,
         cancel_reason = case when p_status = 'CANCELLED' then p_reason else appointment.cancel_reason end,
         arrived_at = case when p_status in ('SCHEDULED', 'CONFIRMED') then null else appointment.arrived_at end
   where appointment.id = was.id
  returning appointment.*;
end;
$$;

-- A booked patient at the desk (plan §11.3): appointments.edit, on the
-- appointment's own day (D143), for a patient not archived and a doctor
-- still active. They take the doctor's next token of the day — or the one
-- they already hold from earlier today (D141). A no-show coming back late
-- into a time booked meanwhile is refused as a clash: add them as a walk-in.
create or replace function public.mark_arrived(p_appointment_id uuid)
returns setof public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.appointments := public.appointment_for_change(p_appointment_id, 'appointments.edit');
  token integer := was.token_number;
begin
  if not 'ARRIVED' = any (public.appointment_status_next(was.status)) or was.status = 'IN_PROGRESS' then
    raise exception 'Not a move its status allows' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
  end if;
  if was.local_date <> public.clinic_today(was.clinic_id) then
    raise exception 'A patient arrives on the appointment''s own day' using hint = 'APPOINTMENT_NOT_TODAY';
  end if;
  if exists (select 1 from public.patients as patient where patient.id = was.patient_id and patient.archived_at is not null) then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;
  if not exists (
    select 1
      from public.doctors as doctor
      join public.clinic_members as member on member.id = doctor.member_id
     where doctor.id = was.doctor_id and doctor.active and member.status = 'ACTIVE'
  ) then
    raise exception 'Not one of the clinic''s active doctors' using hint = 'DOCTOR_INACTIVE';
  end if;

  if token is null then
    token := public.next_token(was.clinic_id, was.doctor_id, was.local_date);
  end if;
  return query
  update public.appointments as appointment
     set status = 'ARRIVED', token_number = token, arrived_at = now()
   where appointment.id = was.id
  returning appointment.*;
exception
  when exclusion_violation then
    perform public.raise_slot_taken(was.doctor_id, was.scheduled_at, was.duration_minutes, was.id);
end;
$$;

-- A walk-in (plan §11.3): appointments.create, while the clinic can write,
-- for a patient the caller may see and a doctor and type of the clinic's —
-- refused on a clinic holiday or the doctor's leave like a booking (D139).
-- Arrived at now, the type's own length, the doctor's next token of the day;
-- it holds no slot. Once per idempotency key. Hands back the appointment,
-- and whether this call added it.
create or replace function public.add_walk_in(p_walk_in jsonb, p_idempotency_key uuid)
returns table (appointment_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  given public.appointments;
  minutes integer;
  added uuid;
begin
  if clinic is null or not public.has_permission('appointments.create') then
    raise exception 'Adding a walk-in needs appointments.create' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  if p_idempotency_key is null then
    raise exception 'A walk-in needs its idempotency key' using hint = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  perform public.require_clinic_write(clinic);

  perform pg_advisory_xact_lock(hashtextextended(clinic::text || ':' || p_idempotency_key::text, 0));
  select appointment.id into added
    from public.appointments as appointment
   where appointment.clinic_id = clinic and appointment.idempotency_key = p_idempotency_key;
  if added is not null then
    return query select added, false;
    return;
  end if;

  given := jsonb_populate_record(null::public.appointments, p_walk_in);
  perform public.check_booking(clinic, given.patient_id, given.doctor_id, given.appointment_type_id, now(), false);
  select type.default_minutes into minutes
    from public.appointment_types as type
   where type.id = given.appointment_type_id;
  if minutes is null then
    raise exception 'Not one of the clinic''s appointment types' using hint = 'APPOINTMENT_TYPE_INACTIVE';
  end if;
  insert into public.appointments (
    clinic_id, patient_id, doctor_id, source, appointment_type_id, scheduled_at, duration_minutes, status,
    token_number, arrived_at, notes, idempotency_key
  )
  values (
    clinic, given.patient_id, given.doctor_id, 'WALK_IN', given.appointment_type_id, now(), minutes, 'ARRIVED',
    public.next_token(clinic, given.doctor_id, public.clinic_today(clinic)), now(), given.notes, p_idempotency_key
  )
  returning id into added;
  return query select added, true;
end;
$$;

revoke all on function public.create_appointment(jsonb, uuid) from public, anon;
revoke all on function public.update_appointment(uuid, jsonb) from public, anon;
revoke all on function public.change_appointment_status(uuid, text, text) from public, anon;
revoke all on function public.mark_arrived(uuid) from public, anon;
revoke all on function public.add_walk_in(jsonb, uuid) from public, anon;
grant execute on function public.create_appointment(jsonb, uuid) to authenticated;
grant execute on function public.update_appointment(uuid, jsonb) to authenticated;
grant execute on function public.change_appointment_status(uuid, text, text) to authenticated;
grant execute on function public.mark_arrived(uuid) to authenticated;
grant execute on function public.add_walk_in(jsonb, uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. Archiving a patient with appointments to come (D140)
-- ------------------------------------------------------------

-- As 0015's, and one rule more: a patient is not archived while an
-- appointment of theirs is still to come today or later, or under way —
-- cancelled or moved first; the refusal names when the first of them is.
-- One left unmarked on a past day does not count.
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
-- 7. The appointments on a closure's days (D87, D137)
-- ------------------------------------------------------------

-- For the holiday-or-leave sheet, as its days are picked: the appointments
-- still to happen on those days — the whole clinic's, or the one doctor's —
-- by time, the first `p_limit` of them, each with how many there are in all.
-- settings.manage, which adding a closure needs. A patient's name only for
-- someone who may see that patient (appointments.view, within the doctor
-- scope); anyone else reads "a patient".
create or replace function public.closure_appointments(
  p_doctor_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_limit integer
)
returns table (
  appointment_id uuid,
  scheduled_at timestamptz,
  doctor_name text,
  patient_name text,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  names_seen boolean := public.has_permission('appointments.view');
  every_patient boolean := public.sees_every_patient();
begin
  if clinic is null or not public.has_permission('settings.manage') then
    raise exception 'Reading a closure''s appointments needs settings.manage' using hint = 'AUTH_PERMISSION_DENIED';
  end if;

  return query
  select appointment.id,
         appointment.scheduled_at,
         profile.full_name,
         case
           when names_seen and (every_patient or appointment.patient_id in (select public.doctor_patient_ids()))
           then patient.full_name
         end,
         count(*) over ()
    from public.appointments as appointment
    join public.patients as patient on patient.id = appointment.patient_id
    join public.doctors as doctor on doctor.id = appointment.doctor_id
    join public.clinic_members as member on member.id = doctor.member_id
    join public.profiles as profile on profile.id = member.user_id
   where appointment.clinic_id = clinic
     and appointment.local_date between p_starts_on and p_ends_on
     and (p_doctor_id is null or appointment.doctor_id = p_doctor_id)
     and appointment.status in ('SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS')
   order by appointment.scheduled_at
   limit p_limit;
end;
$$;

revoke all on function public.closure_appointments(uuid, date, date, integer) from public, anon;
grant execute on function public.closure_appointments(uuid, date, date, integer) to authenticated;

-- ------------------------------------------------------------
-- Policies (plan §27.4)
-- ------------------------------------------------------------

alter table public.appointments enable row level security;
alter table public.daily_tokens enable row level security;

-- appointments.view, within the doctor scope: a doctor reads the appointments
-- of their own patients (D3), worked out once a statement (plan §37.1).
create policy appointments_select on public.appointments
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('appointments.view'))
  and ((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))
);

-- Booked, changed, arrived and added at the desk only through the functions
-- above; never deleted — cancelled. The token counter is the database's alone.
grant select on public.appointments to authenticated;
