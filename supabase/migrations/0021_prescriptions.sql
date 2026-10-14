-- ============================================================
-- 0021 · Prescriptions (plan §13, §8.2 rule 4; tracker R6.3, D45,
-- D210 – D217).
--
-- 1. `prescriptions`: one per visit, always in the visit doctor's name, with
--    the advice and whether the diagnosis prints (off until the doctor ticks
--    it, D216). `entered_by` is who typed it as it stands: the doctor, or a
--    member typing for them (D45).
-- 2. `prescription_items`: its medicines, in order — the name, strength,
--    dose, frequency (a chip's or typed, D214), timing, days (D217) and
--    instructions.
-- 3. save_prescription: the whole prescription at once (D210), by the visit's
--    doctor or a member with `prescriptions.write`, open or done alike (D215),
--    and only once the doctor has a registration number (D213). Refused when
--    saved from an older copy (D206), as each section of the visit is.
-- 4. medicine_suggestions: this clinic's medicines beginning with what is
--    typed, each with its strength and the line as last written — by this
--    doctor, or anyone in the clinic if they never have (D211).
-- 5. A prescription counts as something recorded: Back to waiting keeps a
--    visit with one, and removes an empty one with its visit (D197).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Prescriptions and their medicines
-- ------------------------------------------------------------

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null,
  -- One per visit (plan §13).
  visit_id uuid not null unique,
  -- The visit's doctor, in whose name it is (plan §8.2 rule 4); set by save_prescription.
  doctor_id uuid not null,
  advice text check (public.is_clean_text(advice, 2000)),
  -- Whether the printout carries the visit's diagnosis (D216).
  print_diagnosis boolean not null default false,
  -- Who typed it as it stands (D45).
  entered_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- What the medicines' composite foreign key points at.
  unique (id, clinic_id),
  foreign key (visit_id, clinic_id) references public.visits (id, clinic_id),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id),
  foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id)
);

-- Every read leads with the clinic (plan §37.1): a patient's prescriptions,
-- newest first (their timeline and Repeat last, R6.5, R6.7); a doctor's.
create index prescriptions_clinic_id_patient_id_idx on public.prescriptions (clinic_id, patient_id, created_at desc);
create index prescriptions_clinic_id_doctor_id_idx on public.prescriptions (clinic_id, doctor_id);
create index prescriptions_entered_by_idx on public.prescriptions (entered_by);
create index prescriptions_created_by_idx on public.prescriptions (created_by);
create index prescriptions_updated_by_idx on public.prescriptions (updated_by);

create trigger set_prescriptions_actor before insert or update on public.prescriptions
for each row execute function public.set_actor();
create trigger set_prescriptions_updated_at before update on public.prescriptions
for each row execute function public.set_updated_at();

-- A medicine (plan §13): free text, no drug database; each bound as
-- TEXT_LIMITS holds it, the days as PRESCRIPTION_DAYS, the timing one of
-- PRESCRIPTION_TIMINGS, at most PRESCRIPTION_MAX_ITEMS a prescription.
create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  prescription_id uuid not null,
  position smallint not null check (position between 1 and 30),
  medicine text not null check (public.is_clean_line(medicine, 120)),
  strength text check (public.is_clean_line(strength, 40)),
  dose text check (public.is_clean_line(dose, 40)),
  frequency text check (public.is_clean_line(frequency, 40)),
  timing text check (timing in ('BEFORE_FOOD', 'AFTER_FOOD', 'WITH_FOOD', 'EMPTY_STOMACH', 'BEDTIME')),
  duration_days smallint check (duration_days between 1 and 365),
  instructions text check (public.is_clean_line(instructions, 200)),
  -- When this line was written as it is: the newest is what a suggestion fills (D211).
  created_at timestamptz not null default now(),
  -- In order, and the prescription's own index.
  unique (prescription_id, position),
  foreign key (prescription_id, clinic_id) references public.prescriptions (id, clinic_id) on delete cascade
);

-- The suggestions (D211): the clinic's medicines beginning with what is typed.
create index prescription_items_clinic_id_medicine_idx
  on public.prescription_items (clinic_id, lower(medicine) text_pattern_ops);

-- ------------------------------------------------------------
-- 2. What counts as recorded (D197)
-- ------------------------------------------------------------

-- Whether a visit holds nothing recorded: no complaint, diagnosis, notes or
-- follow-up, no reading taken, and no prescription with a medicine or advice.
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
  )
  and not exists (
    select 1
      from public.prescriptions as prescription
     where prescription.visit_id = p_visit_id
       and (prescription.advice is not null
            or exists (select 1 from public.prescription_items as item where item.prescription_id = prescription.id))
  );
$$;

-- Back to waiting (plan §11.4, D197), as 0020's — and an emptied
-- prescription goes with its empty visit.
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
    delete from public.prescriptions where visit_id = visit;
    delete from public.vitals where visit_id = visit;
    delete from public.visits where id = visit;
    moves := moves || jsonb_build_object('entity', 'VISIT', 'id', visit, 'from', 'OPEN', 'to', null);
  end if;
  return jsonb_build_object('moves', moves);
end;
$$;

-- ------------------------------------------------------------
-- 3. Saving a prescription (D210, D213, D215, D206)
-- ------------------------------------------------------------

-- A visit's prescription as the screen holds it — none until one is saved:
-- the advice, whether the diagnosis prints, and the medicines in order.
create or replace function public.prescription_of(p_visit_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'advice', prescription.advice,
    'print_diagnosis', prescription.print_diagnosis,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'medicine', item.medicine, 'strength', item.strength, 'dose', item.dose, 'frequency', item.frequency,
        'timing', item.timing, 'duration_days', item.duration_days, 'instructions', item.instructions
      ) order by item.position)
        from public.prescription_items as item
       where item.prescription_id = prescription.id
    ), '[]'::jsonb)
  )
    from public.prescriptions as prescription
   where prescription.visit_id = p_visit_id;
$$;

revoke all on function public.prescription_of(uuid) from public, anon, authenticated;

-- The prescription, whole (D210): the medicines in the order given, the
-- advice and the diagnosis tick, replacing what was there. Written by the
-- visit's doctor, or typed for them with `prescriptions.write` (plan §8.2
-- rule 4) — while the visit is open or after it is done (D215) — within the
-- doctor scope, while the clinic can write and the patient is not archived,
-- and only once the doctor has a registration number (D213). Refused when
-- `p_seen` is not what is there now (D206). Hands back the prescription,
-- whether this made it, and it before and after.
create or replace function public.save_prescription(p_visit_id uuid, p_prescription jsonb, p_seen jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  visit public.visits;
  items jsonb := coalesce(p_prescription -> 'items', '[]'::jsonb);
  before jsonb;
  saved uuid;
begin
  if clinic is null then
    raise exception 'Writing a prescription needs a clinic' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  select * into visit
    from public.visits as found
   where found.id = p_visit_id and found.clinic_id = clinic
   for update;
  if visit.id is null or not public.can_see_patient(visit.patient_id) then
    raise exception 'No such visit' using hint = 'RECORD_NOT_FOUND';
  end if;
  if public.current_doctor_id() is distinct from visit.doctor_id
     and not public.has_permission('prescriptions.write') then
    raise exception 'Only the doctor, or whoever types for them' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  if exists (
    select 1 from public.patients as patient where patient.id = visit.patient_id and patient.archived_at is not null
  ) then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;
  if not exists (
    select 1 from public.doctors as doctor where doctor.id = visit.doctor_id and doctor.registration_number is not null
  ) then
    raise exception 'The doctor has no registration number' using hint = 'PRESCRIPTION_NEEDS_REGISTRATION';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 30 then
    raise exception 'Not a list of medicines' using hint = 'VALIDATION_ERROR';
  end if;

  before := public.prescription_of(visit.id);
  if before is distinct from p_seen then
    raise exception 'The prescription changed meanwhile' using hint = 'VISIT_CHANGED';
  end if;

  insert into public.prescriptions (clinic_id, patient_id, visit_id, doctor_id, advice, print_diagnosis, entered_by)
  values (
    visit.clinic_id, visit.patient_id, visit.id, visit.doctor_id, p_prescription ->> 'advice',
    coalesce((p_prescription ->> 'print_diagnosis')::boolean, false), auth.uid()
  )
  on conflict (visit_id) do update
     set advice = excluded.advice, print_diagnosis = excluded.print_diagnosis, entered_by = excluded.entered_by
  returning id into saved;

  -- The medicines are written again only when they changed, so each keeps when it was written (D211).
  if before is null or before -> 'items' is distinct from items then
    delete from public.prescription_items where prescription_id = saved;
    insert into public.prescription_items (
      clinic_id, prescription_id, position, medicine, strength, dose, frequency, timing, duration_days, instructions
    )
    select visit.clinic_id, saved, line.position::smallint, line.item ->> 'medicine', line.item ->> 'strength',
           line.item ->> 'dose', line.item ->> 'frequency', line.item ->> 'timing',
           (line.item ->> 'duration_days')::smallint, line.item ->> 'instructions'
      from jsonb_array_elements(items) with ordinality as line(item, position);
  end if;

  return jsonb_build_object(
    'prescription_id', saved, 'created', before is null,
    'before', before, 'after', public.prescription_of(visit.id)
  );
end;
$$;

revoke all on function public.save_prescription(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_prescription(uuid, jsonb, jsonb) to authenticated;

-- ------------------------------------------------------------
-- 4. Medicine suggestions (D211)
-- ------------------------------------------------------------

-- This clinic's medicines beginning with `p_search` (no drug database, plan
-- §13), for whoever writes prescriptions: a doctor, or a member with
-- `prescriptions.write`. One for each medicine and strength, as last written
-- — by `p_doctor_id` when they ever have, else by anyone in the clinic —
-- theirs first, the most recent first, then by name. Only the medicine's
-- line: nothing of whose prescription it was.
create or replace function public.medicine_suggestions(p_search text, p_doctor_id uuid)
returns table (
  medicine text,
  strength text,
  dose text,
  frequency text,
  timing text,
  duration_days smallint,
  instructions text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  -- What is typed, its LIKE wildcards taken literally.
  prefix text := replace(replace(replace(lower(btrim(coalesce(p_search, ''))), '\', '\\'), '%', '\%'), '_', '\_');
begin
  if clinic is null or (public.current_doctor_id() is null and not public.has_permission('prescriptions.write')) then
    raise exception 'Suggestions are for whoever writes prescriptions' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  if prefix = '' then
    return;
  end if;
  return query
  select line.medicine, line.strength, line.dose, line.frequency, line.timing, line.duration_days, line.instructions
    from (
      select distinct on (lower(item.medicine), lower(coalesce(item.strength, '')))
             item.medicine, item.strength, item.dose, item.frequency, item.timing, item.duration_days,
             item.instructions, prescription.doctor_id = p_doctor_id as own, item.created_at as written
        from public.prescription_items as item
        join public.prescriptions as prescription on prescription.id = item.prescription_id
       where item.clinic_id = clinic and lower(item.medicine) like prefix || '%'
       order by lower(item.medicine), lower(coalesce(item.strength, '')),
                prescription.doctor_id = p_doctor_id desc, item.created_at desc
    ) as line
   order by line.own desc, line.written desc, lower(line.medicine), lower(coalesce(line.strength, ''))
   limit 8;
end;
$$;

revoke all on function public.medicine_suggestions(text, uuid) from public, anon;
grant execute on function public.medicine_suggestions(text, uuid) to authenticated;

-- ------------------------------------------------------------
-- Policies (plan §27.4)
-- ------------------------------------------------------------

alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;

-- visits.view, within the doctor scope (D3), worked out once a statement
-- (plan §37.1).
create policy prescriptions_select on public.prescriptions
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('visits.view'))
  and ((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))
);

-- A prescription's medicines, where the prescription itself can be read.
create policy prescription_items_select on public.prescription_items
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and exists (select 1 from public.prescriptions as prescription where prescription.id = prescription_id)
);

-- Written only through save_prescription; never deleted, but for an empty
-- one sent back to waiting with its visit (D197).
grant select on public.prescriptions to authenticated;
grant select on public.prescription_items to authenticated;
