-- ============================================================
-- 0020 · What a visit records (plan §12.1, §12.2; tracker R6.2, D202 – D209).
--
-- 1. A visit opened before its patient goes in (D203): an assistant takes the
--    vitals of a patient still waiting, and their visit opens with them.
--    Such a visit has not started: `started_at` is empty until Send in, which
--    then continues it, as it continues one kept by Back to waiting (D197).
-- 2. A visit holds something once any reading is taken: a vitals row with
--    every reading cleared counts as nothing, and Back to waiting removes it
--    with its empty visit.
-- 3. Each section saves alone (D202), and a save made from an older copy of
--    its section is refused (D206) — `p_seen` is the section as the screen
--    last read it — so two people never overwrite each other unseen:
--    - save_vitals: the readings, whole; for a visit, or for a waiting
--      patient's appointment, opening its visit (D203). `visits.create`
--      while the visit is open.
--    - update_visit: complaint, diagnosis and notes, or the follow-up date.
--      `visits.edit`.
--    Once a visit is done, any change is a correction and needs
--    `visits.edit` (D208).
-- 4. New visit (D204): from a patient's profile, for `visits.create`, with a
--    doctor; a patient already in with that doctor has theirs opened again.
--    finish_visit is its Done: a visit with no appointment closes as To bill.
-- Each hands back what it changed, before and after, for the audit row.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A visit opened before Send in (D203)
-- ------------------------------------------------------------

alter table public.visits alter column started_at drop not null;

-- The day a visit falls on, in the clinic's timezone (AGENTS.md §15) — the
-- day it opened, gone in or not; who it is for never changes, and a closed
-- visit is not opened again.
create or replace function public.check_visit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    select (coalesce(new.started_at, now()) at time zone clinic.timezone)::date into new.visit_date
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

-- Sends a held appointment in: it goes in progress, and its visit opens — or
-- the one kept for it continues (D197), or the one its vitals opened (D203),
-- which starts now. Hands back what moved, and the visit.
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
  update public.visits as kept
     set started_at = coalesce(kept.started_at, now())
   where kept.appointment_id = p_appointment.id and kept.status = 'OPEN'
  returning kept.id into visit;
  if visit is null then
    insert into public.visits (clinic_id, patient_id, doctor_id, appointment_id)
    values (p_appointment.clinic_id, p_appointment.patient_id, p_appointment.doctor_id, p_appointment.id)
    returning id into visit;
    moves := moves || jsonb_build_object('entity', 'VISIT', 'id', visit, 'from', null, 'to', 'OPEN');
  end if;
  return jsonb_build_object('moves', moves, 'visit_id', visit);
end;
$$;

-- ------------------------------------------------------------
-- 2. What counts as recorded
-- ------------------------------------------------------------

-- Whether a visit holds nothing recorded (D197): no complaint, diagnosis,
-- notes or follow-up, and no reading taken. The prescription joins them with
-- 0021.
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
  and not exists (
    select 1
      from public.vitals as vital
     where vital.visit_id = p_visit_id
       and (vital.systolic is not null or vital.diastolic is not null or vital.pulse is not null
            or vital.temperature_f is not null or vital.spo2 is not null or vital.respiratory_rate is not null
            or vital.weight_kg is not null or vital.height_cm is not null)
  );
$$;

-- Back to waiting (plan §11.4, D197): the patient waits again with their
-- token. The visit Send in opened is removed while it holds nothing — its
-- vitals row too, should every reading on it have been cleared — so the
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
    delete from public.vitals where visit_id = visit;
    delete from public.visits where id = visit;
    moves := moves || jsonb_build_object('entity', 'VISIT', 'id', visit, 'from', 'OPEN', 'to', null);
  end if;
  return jsonb_build_object('moves', moves);
end;
$$;

-- ------------------------------------------------------------
-- 3. Saving a section (D202, D206, D208)
-- ------------------------------------------------------------

-- A visit to write to, held until the transaction ends: the clinic's, within
-- the doctor scope, while the clinic can write and its patient is not
-- archived (D103). `p_permission` while it is open; once done, a change is a
-- correction and needs visits.edit (D208).
create or replace function public.visit_for_change(p_visit_id uuid, p_permission text)
returns public.visits
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  found public.visits;
begin
  if clinic is null or not (public.has_permission(p_permission) or public.has_permission('visits.edit')) then
    raise exception 'Writing a visit needs its permission' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  select * into found
    from public.visits as visit
   where visit.id = p_visit_id and visit.clinic_id = clinic
   for update;
  if found.id is null or not public.can_see_patient(found.patient_id) then
    raise exception 'No such visit' using hint = 'RECORD_NOT_FOUND';
  end if;
  if not public.has_permission(case when found.status = 'COMPLETED' then 'visits.edit' else p_permission end) then
    raise exception 'A done visit is corrected with visits.edit' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  if exists (
    select 1 from public.patients as patient where patient.id = found.patient_id and patient.archived_at is not null
  ) then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;
  return found;
end;
$$;

-- A visit's readings as the screen holds them: none until any are taken.
create or replace function public.vitals_of(p_visit_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'systolic', vital.systolic, 'diastolic', vital.diastolic, 'pulse', vital.pulse,
    'temperature_f', vital.temperature_f, 'spo2', vital.spo2, 'respiratory_rate', vital.respiratory_rate,
    'weight_kg', vital.weight_kg, 'height_cm', vital.height_cm
  )
    from public.vitals as vital
   where vital.visit_id = p_visit_id;
$$;

revoke all on function public.visit_for_change(uuid, text) from public, anon, authenticated;
revoke all on function public.vitals_of(uuid) from public, anon, authenticated;

-- The vitals (plan §12.2): every reading at once, each within VITAL_LIMITS
-- (the table's CHECKs). For a visit (`p_visit_id`) — or for a patient still
-- waiting or in (`p_appointment_id`), whose visit opens with the first
-- reading when it has none (D203). Refused when `p_seen` is not what is
-- there now (D206). Hands back the visit, whether it opened, the readings'
-- row, and the readings before and after.
create or replace function public.save_vitals(
  p_visit_id uuid,
  p_appointment_id uuid,
  p_vitals jsonb,
  p_seen jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  visit public.visits;
  appointment public.appointments;
  opened boolean := false;
  before jsonb;
  reading uuid;
  taken boolean := exists (
    select 1 from jsonb_each(p_vitals) as reading where jsonb_typeof(reading.value) = 'number'
  );
begin
  if p_visit_id is not null then
    visit := public.visit_for_change(p_visit_id, 'visits.create');
  else
    appointment := public.appointment_for_change(p_appointment_id, 'visits.create');
    if appointment.status not in ('ARRIVED', 'IN_PROGRESS') then
      raise exception 'Vitals come before a visit only while they wait' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
    end if;
    perform public.check_sent_in(appointment);
    select * into visit from public.visits as kept where kept.appointment_id = appointment.id for update;
    if visit.id is null then
      if not taken then
        raise exception 'No reading to save' using hint = 'VALIDATION_ERROR';
      end if;
      insert into public.visits (clinic_id, patient_id, doctor_id, appointment_id, started_at)
      values (appointment.clinic_id, appointment.patient_id, appointment.doctor_id, appointment.id, null)
      returning * into visit;
      opened := true;
    end if;
  end if;

  before := public.vitals_of(visit.id);
  if before is distinct from p_seen then
    raise exception 'The vitals changed meanwhile' using hint = 'VISIT_CHANGED';
  end if;

  insert into public.vitals (
    clinic_id, patient_id, visit_id, systolic, diastolic, pulse, temperature_f, spo2, respiratory_rate,
    weight_kg, height_cm, recorded_by, updated_by
  )
  values (
    visit.clinic_id, visit.patient_id, visit.id,
    (p_vitals ->> 'systolic')::smallint, (p_vitals ->> 'diastolic')::smallint, (p_vitals ->> 'pulse')::smallint,
    (p_vitals ->> 'temperature_f')::numeric, (p_vitals ->> 'spo2')::smallint,
    (p_vitals ->> 'respiratory_rate')::smallint, (p_vitals ->> 'weight_kg')::numeric,
    (p_vitals ->> 'height_cm')::numeric, auth.uid(), auth.uid()
  )
  on conflict (visit_id) do update
     set systolic = excluded.systolic, diastolic = excluded.diastolic, pulse = excluded.pulse,
         temperature_f = excluded.temperature_f, spo2 = excluded.spo2,
         respiratory_rate = excluded.respiratory_rate, weight_kg = excluded.weight_kg,
         height_cm = excluded.height_cm, updated_by = auth.uid()
  returning id into reading;

  return jsonb_build_object(
    'visit_id', visit.id, 'opened', opened, 'vitals_id', reading,
    'before', before, 'after', public.vitals_of(visit.id)
  );
end;
$$;

-- A visit's own section (D202): complaint, diagnosis and notes, or the
-- follow-up date — whichever `p_changes` names, compared with `p_seen` as
-- the screen last read them (D206). A follow-up falls after the visit's day.
-- Hands back the section before and after.
create or replace function public.update_visit(p_visit_id uuid, p_changes jsonb, p_seen jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  visit public.visits := public.visit_for_change(p_visit_id, 'visits.edit');
  fields text[] := array(select jsonb_object_keys(p_changes));
  before jsonb;
  saved public.visits;
begin
  if cardinality(fields) = 0
     or not fields <@ array['complaint', 'diagnosis', 'notes', 'follow_up_on'] then
    raise exception 'Not a section of a visit' using hint = 'VALIDATION_ERROR';
  end if;
  before := (select jsonb_object_agg(field, to_jsonb(visit) -> field) from unnest(fields) as field);
  if before is distinct from p_seen then
    raise exception 'The visit changed meanwhile' using hint = 'VISIT_CHANGED';
  end if;
  if (p_changes ->> 'follow_up_on')::date <= visit.visit_date then
    raise exception 'A follow-up falls after the visit' using hint = 'VALIDATION_ERROR';
  end if;

  update public.visits as changed
     set complaint = case when p_changes ? 'complaint' then p_changes ->> 'complaint' else changed.complaint end,
         diagnosis = case when p_changes ? 'diagnosis' then p_changes ->> 'diagnosis' else changed.diagnosis end,
         notes = case when p_changes ? 'notes' then p_changes ->> 'notes' else changed.notes end,
         follow_up_on = case
           when p_changes ? 'follow_up_on' then (p_changes ->> 'follow_up_on')::date else changed.follow_up_on
         end
   where changed.id = visit.id
  returning * into saved;

  return jsonb_build_object(
    'before', before,
    'after', (select jsonb_object_agg(field, to_jsonb(saved) -> field) from unnest(fields) as field)
  );
end;
$$;

revoke all on function public.save_vitals(uuid, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.update_visit(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_vitals(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.update_visit(uuid, jsonb, jsonb) to authenticated;

-- ------------------------------------------------------------
-- 4. New visit, and its Done (D204)
-- ------------------------------------------------------------

-- A visit from a patient's profile, with no appointment: `visits.create`,
-- the clinic's own patient and active doctor, while the clinic can write.
-- A patient with a visit open with that doctor — sent in, or started here —
-- has it opened again rather than a second. Under the doctor's queue lock,
-- so two taps start one. Hands back the visit, and whether this call
-- started it.
create or replace function public.start_visit(p_patient_id uuid, p_doctor_id uuid)
returns table (visit_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  patient public.patients;
  found uuid;
begin
  if clinic is null or not public.has_permission('visits.create') then
    raise exception 'Starting a visit needs its permission' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  select * into patient
    from public.patients as candidate
   where candidate.id = p_patient_id and candidate.clinic_id = clinic;
  if patient.id is null or not public.can_see_patient(patient.id) then
    raise exception 'No such patient' using hint = 'RECORD_NOT_FOUND';
  end if;
  if patient.archived_at is not null then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;
  if not exists (
    select 1
      from public.doctors as doctor
      join public.clinic_members as member on member.id = doctor.member_id
     where doctor.id = p_doctor_id and doctor.clinic_id = clinic and doctor.active and member.status = 'ACTIVE'
  ) then
    raise exception 'Not one of the clinic''s active doctors' using hint = 'DOCTOR_INACTIVE';
  end if;
  perform public.hold_doctor(p_doctor_id);

  select open.id into found
    from public.visits as open
   where open.clinic_id = clinic and open.patient_id = patient.id and open.doctor_id = p_doctor_id
     and open.status = 'OPEN' and open.started_at is not null
   order by open.started_at desc
   limit 1;
  if found is not null then
    return query select found, false;
    return;
  end if;
  insert into public.visits (clinic_id, patient_id, doctor_id)
  values (clinic, patient.id, p_doctor_id)
  returning id into found;
  return query select found, true;
end;
$$;

-- Done for a visit started from a profile (D204): it closes as To bill
-- (D46). A visit sent in from the queue is done there, with its
-- appointment. Twice changes nothing more. Hands back its status before.
create or replace function public.finish_visit(p_visit_id uuid)
returns table (previously text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  found public.visits;
begin
  if clinic is null or not public.has_permission('visits.create') then
    raise exception 'Closing a visit needs its permission' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  select * into found
    from public.visits as visit
   where visit.id = p_visit_id and visit.clinic_id = clinic
   for update;
  if found.id is null or not public.can_see_patient(found.patient_id) then
    raise exception 'No such visit' using hint = 'RECORD_NOT_FOUND';
  end if;
  if found.appointment_id is not null then
    raise exception 'A visit from the queue is done there' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
  end if;
  if found.status = 'OPEN' then
    update public.visits
       set status = 'COMPLETED', completed_at = now(), billing_status = 'TO_BILL'
     where id = found.id;
  end if;
  return query select found.status;
end;
$$;

revoke all on function public.start_visit(uuid, uuid) from public, anon;
revoke all on function public.finish_visit(uuid) from public, anon;
grant execute on function public.start_visit(uuid, uuid) to authenticated;
grant execute on function public.finish_visit(uuid) to authenticated;
