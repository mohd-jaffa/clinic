-- ============================================================
-- 0018 · Visits and the queue's moves (plan §11.4, §12.1, §28.5; tracker
-- R6.1, D43, D46, D192 – D198).
--
-- 1. `visits`: one consultation — a patient, their doctor, at most one
--    appointment — opened by Send in and closed by Done or Next patient,
--    whatever was or was not recorded (D43). Its day in the clinic's
--    timezone is the database's to set. A closed visit carries its billing
--    state (D46): To bill until billing settles it (R8).
-- 2. `vitals`: one set per visit, each reading within VITAL_LIMITS. Recorded
--    from the visit screen (R6.2).
-- 3. The queue's moves are functions, each taking the doctor's queue lock
--    before the appointment's row, so two desks never cross:
--    - send_in: an arrived patient goes in, and their visit opens — or the
--      one kept for them continues (D197). While the doctor has someone in,
--      it asks: mark them done, or keep both in (D192).
--    - mark_done: they are done, and the visit closes as To bill.
--    - next_patient: the patient it is for is done, and the doctor's lowest
--      waiting token goes in, skipping anyone stepped out (D196, D198).
--    - back_to_waiting: the patient waits again; an empty visit is removed,
--      one with anything recorded kept (D197).
--    - mark_stepped_out: a waiting patient is away, or back (D198).
--    Each hands back what it moved, for the audit trail.
-- 4. An appointment whose visit is kept ends only with Done: it is not
--    cancelled, marked a no-show or scheduled again (D197).
-- 5. The doctor scope grows (plan §27.3): a visit's doctor sees its patient.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Visits
-- ------------------------------------------------------------

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null,
  doctor_id uuid not null,
  -- The appointment it was opened for: one visit each (plan §12.1).
  appointment_id uuid unique,
  status text not null default 'OPEN' check (status in ('OPEN', 'COMPLETED')),
  -- The day it was opened in the clinic's timezone; set by check_visit.
  visit_date date not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Clinical text (VISIT_TEXT_LIMITS), recorded from the visit screen (R6.2).
  complaint text check (public.is_clean_text(complaint, 1000)),
  diagnosis text check (public.is_clean_text(diagnosis, 1000)),
  notes text check (public.is_clean_text(notes, 4000)),
  follow_up_on date,
  -- Set when it closes (plan §15.6, D46); settled by billing (R8).
  billing_status text check (billing_status in ('TO_BILL', 'BILLED', 'NO_CHARGE')),
  no_charge_reason text check (no_charge_reason in ('REVIEW', 'COURTESY', 'OTHER')),
  no_charge_note text check (public.is_clean_line(no_charge_note, 200)),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- What a later table's composite foreign key points at (vitals, the prescription, the bill).
  unique (id, clinic_id),
  -- The clinic's own patient, doctor and appointment; a visit is a record, so
  -- none of them is removed while it names them.
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id),
  foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id),
  foreign key (appointment_id, clinic_id) references public.appointments (id, clinic_id),
  -- Closed when it was, with its billing state; open with neither.
  constraint visits_closed check (
    (status = 'COMPLETED') = (completed_at is not null)
    and (status = 'COMPLETED') = (billing_status is not null)
  ),
  -- No charge, with its reason — and a note for Other.
  constraint visits_no_charge check (
    coalesce(billing_status = 'NO_CHARGE', false) = (no_charge_reason is not null)
    and (no_charge_note is null or no_charge_reason is not null)
    and (no_charge_reason is distinct from 'OTHER' or no_charge_note is not null)
  )
);

-- Every read leads with the clinic, in the order it is read (plan §37.1):
-- a patient's visits, newest first (their timeline, R6.5); a doctor's.
create index visits_clinic_id_patient_id_idx on public.visits (clinic_id, patient_id, visit_date desc);
create index visits_clinic_id_doctor_id_idx on public.visits (clinic_id, doctor_id, visit_date desc);
create index visits_created_by_idx on public.visits (created_by);
create index visits_updated_by_idx on public.visits (updated_by);

-- The day a visit falls on, in the clinic's timezone (AGENTS.md §15); who it
-- is for never changes, and a closed visit is not opened again.
create or replace function public.check_visit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    select (new.started_at at time zone clinic.timezone)::date into new.visit_date
      from public.clinics as clinic
     where clinic.id = new.clinic_id;
  else
    if new.patient_id <> old.patient_id or new.doctor_id <> old.doctor_id
       or new.appointment_id is distinct from old.appointment_id or new.visit_date <> old.visit_date then
      raise exception 'Whose visit it is does not change' using hint = 'VALIDATION_ERROR';
    end if;
    if old.status = 'COMPLETED' and new.status = 'OPEN' then
      raise exception 'A closed visit stays closed' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
    end if;
  end if;
  return new;
end;
$$;

-- The doctor of a visit sees its patient from then on (plan §27.3).
create or replace function public.add_visit_doctor()
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

revoke all on function public.check_visit() from public, anon, authenticated;
revoke all on function public.add_visit_doctor() from public, anon, authenticated;

create trigger check_visit before insert or update on public.visits
for each row execute function public.check_visit();
create trigger set_visits_actor before insert or update on public.visits
for each row execute function public.set_actor();
create trigger set_visits_updated_at before update on public.visits
for each row execute function public.set_updated_at();
create trigger add_visit_doctor after insert on public.visits
for each row execute function public.add_visit_doctor();

-- ------------------------------------------------------------
-- 2. Vitals
-- ------------------------------------------------------------

-- Each reading within VITAL_LIMITS (src/constants/clinical.ts); temperature in °F (D31).
create table public.vitals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null,
  visit_id uuid not null unique,
  systolic smallint check (systolic between 50 and 260),
  diastolic smallint check (diastolic between 30 and 160),
  pulse smallint check (pulse between 20 and 250),
  temperature_f numeric(4, 1) check (temperature_f between 90 and 110),
  spo2 smallint check (spo2 between 50 and 100),
  respiratory_rate smallint check (respiratory_rate between 5 and 70),
  weight_kg numeric(5, 2) check (weight_kg between 0.5 and 350),
  height_cm numeric(5, 1) check (height_cm between 20 and 250),
  recorded_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (visit_id, clinic_id) references public.visits (id, clinic_id),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id),
  -- Blood pressure is both readings or neither, the lower one lower.
  constraint vitals_blood_pressure check ((systolic is null) = (diastolic is null) and diastolic < systolic)
);

create index vitals_clinic_id_patient_id_idx on public.vitals (clinic_id, patient_id);
create index vitals_recorded_by_idx on public.vitals (recorded_by);
create index vitals_updated_by_idx on public.vitals (updated_by);

create trigger set_vitals_updated_at before update on public.vitals
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3. The queue's moves (plan §11.4)
-- ------------------------------------------------------------

-- Away from the desk for a moment, still waiting (D198): only while arrived.
alter table public.appointments add column stepped_out_at timestamptz;
alter table public.appointments
  add constraint appointments_stepped_out check (stepped_out_at is null or status = 'ARRIVED');

-- Whether a visit holds nothing recorded (D197). Vitals, notes and a
-- follow-up so far; the prescription joins them with 0020.
create or replace function public.visit_is_empty(p_visit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
      from public.visits as visit
     where visit.id = p_visit_id
       and (visit.complaint is not null or visit.diagnosis is not null
            or visit.notes is not null or visit.follow_up_on is not null)
  )
  and not exists (select 1 from public.vitals as vital where vital.visit_id = p_visit_id);
$$;

-- An appointment the caller moves in the queue: appointments.edit, while the
-- clinic can write. Its doctor's queue is held first — every move takes the
-- lock before the row, so two desks moving one doctor's patients wait in turn
-- and never cross.
create or replace function public.queue_appointment(p_appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  doctor uuid;
  found public.appointments;
begin
  select appointment.doctor_id into doctor
    from public.appointments as appointment
   where appointment.id = p_appointment_id and appointment.clinic_id = public.current_clinic_id();
  if doctor is not null then
    perform public.hold_doctor(doctor);
  end if;
  found := public.appointment_for_change(p_appointment_id, 'appointments.edit');
  if found.doctor_id <> doctor then
    raise exception 'It moved to another doctor meanwhile' using hint = 'CONFLICT';
  end if;
  return found;
end;
$$;

-- Sends a held appointment in: it goes in progress, and its visit opens — or
-- the one kept for it continues (D197). Hands back what moved, and the visit.
create or replace function public.start_appointment(p_appointment public.appointments)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  visit uuid;
  moves jsonb := jsonb_build_array(jsonb_build_object(
    'entity', 'APPOINTMENT', 'id', p_appointment.id, 'from', p_appointment.status, 'to', 'IN_PROGRESS'
  ));
begin
  update public.appointments
     set status = 'IN_PROGRESS', started_at = now(), stepped_out_at = null
   where id = p_appointment.id;
  select kept.id into visit
    from public.visits as kept
   where kept.appointment_id = p_appointment.id and kept.status = 'OPEN';
  if visit is null then
    insert into public.visits (clinic_id, patient_id, doctor_id, appointment_id)
    values (p_appointment.clinic_id, p_appointment.patient_id, p_appointment.doctor_id, p_appointment.id)
    returning id into visit;
    moves := moves || jsonb_build_object('entity', 'VISIT', 'id', visit, 'from', null, 'to', 'OPEN');
  end if;
  return jsonb_build_object('moves', moves, 'visit_id', visit);
end;
$$;

-- Marks a held appointment in progress done, and closes its visit as To bill
-- (D46) — opening one first should it have none. Hands back what moved.
create or replace function public.finish_appointment(p_appointment public.appointments)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  visit uuid;
  moves jsonb := jsonb_build_array(jsonb_build_object(
    'entity', 'APPOINTMENT', 'id', p_appointment.id, 'from', 'IN_PROGRESS', 'to', 'COMPLETED'
  ));
begin
  update public.appointments set status = 'COMPLETED', completed_at = now() where id = p_appointment.id;
  update public.visits
     set status = 'COMPLETED', completed_at = now(), billing_status = 'TO_BILL'
   where appointment_id = p_appointment.id and status = 'OPEN'
  returning id into visit;
  if visit is null then
    insert into public.visits (
      clinic_id, patient_id, doctor_id, appointment_id, started_at, status, completed_at, billing_status
    )
    values (
      p_appointment.clinic_id, p_appointment.patient_id, p_appointment.doctor_id, p_appointment.id,
      coalesce(p_appointment.started_at, now()), 'COMPLETED', now(), 'TO_BILL'
    )
    returning id into visit;
    moves := moves || jsonb_build_object('entity', 'VISIT', 'id', visit, 'from', null, 'to', 'COMPLETED');
  else
    moves := moves || jsonb_build_object('entity', 'VISIT', 'id', visit, 'from', 'OPEN', 'to', 'COMPLETED');
  end if;
  return moves;
end;
$$;

-- What a patient going in must still be: not archived (D103), with a doctor
-- still on the team.
create or replace function public.check_sent_in(p_appointment public.appointments)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.patients as patient where patient.id = p_appointment.patient_id and patient.archived_at is not null
  ) then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;
  if not exists (
    select 1
      from public.doctors as doctor
      join public.clinic_members as member on member.id = doctor.member_id
     where doctor.id = p_appointment.doctor_id and doctor.active and member.status = 'ACTIVE'
  ) then
    raise exception 'Not one of the clinic''s active doctors' using hint = 'DOCTOR_INACTIVE';
  end if;
end;
$$;

revoke all on function public.visit_is_empty(uuid) from public, anon, authenticated;
revoke all on function public.queue_appointment(uuid) from public, anon, authenticated;
revoke all on function public.start_appointment(public.appointments) from public, anon, authenticated;
revoke all on function public.finish_appointment(public.appointments) from public, anon, authenticated;
revoke all on function public.check_sent_in(public.appointments) from public, anon, authenticated;

-- Send in (plan §11.4): any waiting patient, not only the lowest token. While
-- the doctor has someone in, `p_others` says what becomes of them (D192):
-- FINISH marks them done first, KEEP leaves them in; without it, the move is
-- refused, so the desk is asked. Sent in twice — a double tap — the second
-- changes nothing. Hands back what moved and the visit.
create or replace function public.send_in(p_appointment_id uuid, p_others text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.appointments := public.queue_appointment(p_appointment_id);
  moves jsonb := '[]'::jsonb;
  started jsonb;
  other public.appointments;
begin
  if p_others is not null and p_others not in ('FINISH', 'KEEP') then
    raise exception 'Not a choice for those already in' using hint = 'VALIDATION_ERROR';
  end if;
  if was.status = 'IN_PROGRESS' then
    return jsonb_build_object(
      'moves', moves,
      'visit_id', (select visit.id from public.visits as visit where visit.appointment_id = was.id)
    );
  end if;
  if was.status <> 'ARRIVED' then
    raise exception 'Only a waiting patient is sent in' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
  end if;
  perform public.check_sent_in(was);

  for other in
    select *
      from public.appointments as appointment
     where appointment.clinic_id = was.clinic_id
       and appointment.doctor_id = was.doctor_id
       and appointment.status = 'IN_PROGRESS'
     order by appointment.started_at
       for update
  loop
    if p_others is null then
      raise exception 'Someone is already with the doctor' using hint = 'DOCTOR_ROOM_TAKEN';
    end if;
    exit when p_others = 'KEEP';
    moves := moves || public.finish_appointment(other);
  end loop;

  started := public.start_appointment(was);
  return jsonb_build_object('moves', moves || (started -> 'moves'), 'visit_id', started -> 'visit_id');
end;
$$;

-- Done (plan §11.4): the patient in is done, and their visit closes — whatever
-- was or was not recorded (D43). Done twice changes nothing more.
create or replace function public.mark_done(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.appointments := public.queue_appointment(p_appointment_id);
begin
  if was.status = 'COMPLETED' then
    return jsonb_build_object('moves', '[]'::jsonb);
  end if;
  if was.status <> 'IN_PROGRESS' then
    raise exception 'Only a patient in is marked done' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
  end if;
  return jsonb_build_object('moves', public.finish_appointment(was));
end;
$$;

-- Next patient (plan §11.4; D193, D196): the patient it is for — when one is
-- named — is done, then the doctor's lowest waiting token goes in, skipping
-- anyone stepped out (D198). Pressed twice for the same patient, the second
-- sends no one; with no one named, it sends someone in only while the room
-- is free, and otherwise names who is in. Hands back what moved, and who went
-- in — or no one, when no one is waiting.
create or replace function public.next_patient(p_doctor_id uuid, p_appointment_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  was public.appointments;
  next_one public.appointments;
  moves jsonb := '[]'::jsonb;
  started jsonb;
begin
  if p_appointment_id is not null then
    was := public.queue_appointment(p_appointment_id);
    if was.doctor_id <> p_doctor_id then
      raise exception 'Not this doctor''s patient' using hint = 'RECORD_NOT_FOUND';
    end if;
    if was.status = 'COMPLETED' then
      return jsonb_build_object('moves', moves, 'sent', null);
    end if;
    if was.status <> 'IN_PROGRESS' then
      raise exception 'Only a patient in is marked done' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
    end if;
    moves := public.finish_appointment(was);
  else
    if clinic is null or not public.has_permission('appointments.edit') then
      raise exception 'Moving the queue needs its permission' using hint = 'AUTH_PERMISSION_DENIED';
    end if;
    perform public.require_clinic_write(clinic);
    if not exists (select 1 from public.doctors as doctor where doctor.id = p_doctor_id and doctor.clinic_id = clinic) then
      raise exception 'No such doctor' using hint = 'RECORD_NOT_FOUND';
    end if;
    perform public.hold_doctor(p_doctor_id);
    select * into next_one
      from public.appointments as appointment
     where appointment.clinic_id = clinic
       and appointment.doctor_id = p_doctor_id
       and appointment.status = 'IN_PROGRESS'
     order by appointment.started_at desc
     limit 1;
    if next_one.id is not null then
      return jsonb_build_object('moves', moves, 'sent', public.sent_in(next_one));
    end if;
  end if;

  select * into next_one
    from public.appointments as appointment
   where appointment.clinic_id = coalesce(was.clinic_id, clinic)
     and appointment.doctor_id = p_doctor_id
     and appointment.status = 'ARRIVED'
     and appointment.stepped_out_at is null
     and appointment.local_date = public.clinic_today(coalesce(was.clinic_id, clinic))
   order by appointment.token_number, appointment.arrived_at
   limit 1
     for update;
  if next_one.id is null or not public.can_see_patient(next_one.patient_id) then
    return jsonb_build_object('moves', moves, 'sent', null);
  end if;
  perform public.check_sent_in(next_one);
  started := public.start_appointment(next_one);
  return jsonb_build_object(
    'moves', moves || (started -> 'moves'),
    'sent', public.sent_in(next_one) || jsonb_build_object('visit_id', started -> 'visit_id')
  );
end;
$$;

-- Who went in, as Next patient's card and screen say it.
create or replace function public.sent_in(p_appointment public.appointments)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'appointment_id', p_appointment.id,
    'visit_id', (select visit.id from public.visits as visit where visit.appointment_id = p_appointment.id),
    'token', p_appointment.token_number,
    'patient_name', (select patient.full_name from public.patients as patient where patient.id = p_appointment.patient_id)
  );
$$;

-- Back to waiting (plan §11.4, D197): the patient waits again with their
-- token. The visit Send in opened is removed while it holds nothing, so the
-- booking can still be cancelled; anything recorded keeps it open, to
-- continue. Twice changes nothing more.
create or replace function public.back_to_waiting(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.appointments := public.queue_appointment(p_appointment_id);
  visit uuid;
  moves jsonb := '[]'::jsonb;
begin
  if was.status = 'ARRIVED' then
    return jsonb_build_object('moves', moves);
  end if;
  if was.status <> 'IN_PROGRESS' then
    raise exception 'Only a patient in goes back to waiting' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
  end if;
  update public.appointments set status = 'ARRIVED', started_at = null where id = was.id;
  moves := moves || jsonb_build_object('entity', 'APPOINTMENT', 'id', was.id, 'from', 'IN_PROGRESS', 'to', 'ARRIVED');
  select kept.id into visit from public.visits as kept where kept.appointment_id = was.id;
  if visit is not null and public.visit_is_empty(visit) then
    delete from public.visits where id = visit;
    moves := moves || jsonb_build_object('entity', 'VISIT', 'id', visit, 'from', 'OPEN', 'to', null);
  end if;
  return jsonb_build_object('moves', moves);
end;
$$;

-- Stepped out, or back (D198): a waiting patient keeps their token and place,
-- and Next patient skips them while they are away. Hands back when, and when
-- before, for the audit row.
create or replace function public.mark_stepped_out(p_appointment_id uuid, p_out boolean)
returns table (stepped_out_at timestamptz, previously timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.appointments := public.queue_appointment(p_appointment_id);
  stamped timestamptz;
begin
  if was.status <> 'ARRIVED' then
    raise exception 'Only a waiting patient steps out' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
  end if;
  stamped := case when p_out then coalesce(was.stepped_out_at, now()) end;
  update public.appointments as appointment
     set stepped_out_at = stamped
   where appointment.id = was.id;
  return query select stamped, was.stepped_out_at;
end;
$$;

revoke all on function public.sent_in(public.appointments) from public, anon, authenticated;
revoke all on function public.send_in(uuid, text) from public, anon;
revoke all on function public.mark_done(uuid) from public, anon;
revoke all on function public.next_patient(uuid, uuid) from public, anon;
revoke all on function public.back_to_waiting(uuid) from public, anon;
revoke all on function public.mark_stepped_out(uuid, boolean) from public, anon;
grant execute on function public.send_in(uuid, text) to authenticated;
grant execute on function public.mark_done(uuid) to authenticated;
grant execute on function public.next_patient(uuid, uuid) to authenticated;
grant execute on function public.back_to_waiting(uuid) to authenticated;
grant execute on function public.mark_stepped_out(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- 4. An appointment with a kept visit ends with Done (D197)
-- ------------------------------------------------------------

-- As 0017's, and: an appointment whose visit was kept is not cancelled,
-- marked a no-show or scheduled again; a patient stepped out who leaves is
-- no longer stepped out.
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
  if exists (select 1 from public.visits as visit where visit.appointment_id = was.id) then
    raise exception 'Their visit has notes: send them in and mark them done' using hint = 'APPOINTMENT_HAS_VISIT';
  end if;

  return query
  update public.appointments as appointment
     set status = p_status,
         cancel_reason = case when p_status = 'CANCELLED' then p_reason else appointment.cancel_reason end,
         arrived_at = case when p_status in ('SCHEDULED', 'CONFIRMED') then null else appointment.arrived_at end,
         stepped_out_at = null
   where appointment.id = was.id
  returning appointment.*;
end;
$$;

-- ------------------------------------------------------------
-- Policies (plan §27.4)
-- ------------------------------------------------------------

alter table public.visits enable row level security;
alter table public.vitals enable row level security;

-- visits.view, within the doctor scope (D3), worked out once a statement
-- (plan §37.1).
create policy visits_select on public.visits
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('visits.view'))
  and ((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))
);

create policy vitals_select on public.vitals
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('visits.view'))
  and ((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))
);

-- Opened and closed by the queue's functions above; recorded through the
-- visit screen's (R6.2). Never deleted, but for an empty one sent back to
-- waiting (D197).
grant select on public.visits to authenticated;
grant select on public.vitals to authenticated;
