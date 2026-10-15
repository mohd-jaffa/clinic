-- ============================================================
-- 0023 · Prescription templates and Repeat (plan §13; tracker R6.7, D54,
-- D236 – D243).
--
-- 1. `prescription_templates`: a doctor's named sets of medicines and advice
--    ("Viral fever", "Post-extraction"), theirs alone (D240); archived and
--    restored, never deleted (D242); one active template a name for each
--    doctor (D243).
-- 2. `prescription_template_items`: its medicines, in order, each as a
--    prescription's medicine is.
-- 3. save_prescription_template: the doctor's own template, new or changed,
--    whole; a new one under a name in use replaces that one only once asked
--    (D243).
-- 4. previous_prescription(visit): what Repeat fills (D236) — the patient's
--    latest prescription with a medicine on it, from their visits before this
--    one, with its day and doctor. A computed field read with the visit, as
--    the member.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Templates and their medicines
-- ------------------------------------------------------------

create table public.prescription_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  -- Whose it is (D240): only they save, change, archive or restore it.
  doctor_id uuid not null,
  -- "Viral fever": a row's title, as TEXT_LIMITS.templateName holds it.
  name text not null check (public.is_clean_line(name, 60)),
  advice text check (public.is_clean_text(advice, 2000)),
  -- Archived, never deleted (D242).
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- What the medicines' composite foreign key points at.
  unique (id, clinic_id),
  foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id)
);

-- One active template a name for each doctor (D243) — the visit's sheet of
-- them, by name, too — and a doctor's whole list, archived ones with it (My
-- account, D242), which serves the foreign key (plan §37.1).
create unique index prescription_templates_doctor_name_key
  on public.prescription_templates (clinic_id, doctor_id, lower(name)) where active;
create index prescription_templates_clinic_id_doctor_id_idx on public.prescription_templates (clinic_id, doctor_id);
create index prescription_templates_created_by_idx on public.prescription_templates (created_by);
create index prescription_templates_updated_by_idx on public.prescription_templates (updated_by);

create trigger set_prescription_templates_actor before insert or update on public.prescription_templates
for each row execute function public.set_actor();
create trigger set_prescription_templates_updated_at before update on public.prescription_templates
for each row execute function public.set_updated_at();

-- A template's medicine: bound as a prescription's is (0021), at most
-- PRESCRIPTION_MAX_ITEMS a template.
create table public.prescription_template_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  template_id uuid not null,
  position smallint not null check (position between 1 and 30),
  medicine text not null check (public.is_clean_line(medicine, 120)),
  strength text check (public.is_clean_line(strength, 40)),
  dose text check (public.is_clean_line(dose, 40)),
  frequency text check (public.is_clean_line(frequency, 40)),
  timing text check (timing in ('BEFORE_FOOD', 'AFTER_FOOD', 'WITH_FOOD', 'EMPTY_STOMACH', 'BEDTIME')),
  duration_days smallint check (duration_days between 1 and 365),
  instructions text check (public.is_clean_line(instructions, 200)),
  -- In order, and the template's own index.
  unique (template_id, position),
  foreign key (template_id, clinic_id) references public.prescription_templates (id, clinic_id) on delete cascade
);

-- The clinic's foreign key, the clinic's lines by their template (plan §37.1);
-- a template's own are read in order by its unique index.
create index prescription_template_items_clinic_id_template_id_idx
  on public.prescription_template_items (clinic_id, template_id);

-- ------------------------------------------------------------
-- 2. Saving a template (D240, D242, D243)
-- ------------------------------------------------------------

-- A template as its screen holds it: the name, the advice and the medicines
-- in order — what the trail compares (plan §27.6) — and whether it is in use.
create or replace function public.prescription_template_of(p_template_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', template.name,
    'advice', template.advice,
    'active', template.active,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'medicine', item.medicine, 'strength', item.strength, 'dose', item.dose, 'frequency', item.frequency,
        'timing', item.timing, 'duration_days', item.duration_days, 'instructions', item.instructions
      ) order by item.position)
        from public.prescription_template_items as item
       where item.template_id = template.id
    ), '[]'::jsonb)
  )
    from public.prescription_templates as template
   where template.id = p_template_id;
$$;

revoke all on function public.prescription_template_of(uuid) from public, anon, authenticated;

-- The caller's own template, whole — its name, advice and medicines in the
-- order given, replacing what was there — for a doctor (D240), while the
-- clinic can write. With `p_template_id`, that one is changed, and a name
-- another of theirs holds is refused. Without it, a new one is made — or,
-- under a name in use, that one takes what is sent, only when `p_replace`
-- says it was asked (D243). It holds a medicine or advice (D242). Hands back
-- the template, whether this made it, and it before and after.
create or replace function public.save_prescription_template(
  p_template_id uuid,
  p_template jsonb,
  p_replace boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  doctor uuid := public.current_doctor_id();
  items jsonb := coalesce(p_template -> 'items', '[]'::jsonb);
  template_name text := p_template ->> 'name';
  template_advice text := p_template ->> 'advice';
  target uuid;
  namesake uuid;
  before jsonb;
begin
  if clinic is null or doctor is null then
    raise exception 'A template is a doctor''s own' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 30 then
    raise exception 'Not a list of medicines' using hint = 'VALIDATION_ERROR';
  end if;
  if jsonb_array_length(items) = 0 and template_advice is null then
    raise exception 'A template holds a medicine or advice' using hint = 'VALIDATION_ERROR';
  end if;

  if p_template_id is not null then
    select template.id into target
      from public.prescription_templates as template
     where template.id = p_template_id and template.clinic_id = clinic and template.doctor_id = doctor
       for update;
    if target is null then
      raise exception 'No such template' using hint = 'RECORD_NOT_FOUND';
    end if;
  end if;

  -- Another of theirs, in use, under the name.
  select template.id into namesake
    from public.prescription_templates as template
   where template.clinic_id = clinic and template.doctor_id = doctor and template.active
     and lower(template.name) = lower(template_name) and template.id is distinct from target
     for update;
  if namesake is not null then
    if target is not null or not coalesce(p_replace, false) then
      raise exception 'A template of theirs has the name' using hint = 'TEMPLATE_NAME_TAKEN';
    end if;
    target := namesake;
  end if;

  before := public.prescription_template_of(target);
  begin
    if target is null then
      insert into public.prescription_templates (clinic_id, doctor_id, name, advice)
      values (clinic, doctor, template_name, template_advice)
      returning id into target;
    else
      update public.prescription_templates
         set name = template_name, advice = template_advice
       where id = target;
    end if;
  exception when unique_violation then
    -- Made under the name at the same moment by another request of theirs.
    raise exception 'A template of theirs has the name' using hint = 'TEMPLATE_NAME_TAKEN';
  end;

  delete from public.prescription_template_items where template_id = target;
  insert into public.prescription_template_items (
    clinic_id, template_id, position, medicine, strength, dose, frequency, timing, duration_days, instructions
  )
  select clinic, target, line.position::smallint, line.item ->> 'medicine', line.item ->> 'strength',
         line.item ->> 'dose', line.item ->> 'frequency', line.item ->> 'timing',
         (line.item ->> 'duration_days')::smallint, line.item ->> 'instructions'
    from jsonb_array_elements(items) with ordinality as line(item, position);

  return jsonb_build_object(
    'template_id', target, 'created', before is null,
    'before', before, 'after', public.prescription_template_of(target)
  );
end;
$$;

revoke all on function public.save_prescription_template(uuid, jsonb, boolean) from public, anon;
grant execute on function public.save_prescription_template(uuid, jsonb, boolean) to authenticated;

-- ------------------------------------------------------------
-- 3. What Repeat fills (D236)
-- ------------------------------------------------------------

-- The patient's latest prescription with a medicine on it, from their visits
-- before this one — by any doctor — with its day and its doctor's name; none
-- when there is none. Runs as the caller, so it reads only what the policies
-- let them: whoever reads the visit reads the patient's other visits. Walks
-- 0022's index of a patient's visits, newest first.
create or replace function public.previous_prescription(p_visit public.visits)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'day', earlier.visit_date,
    'doctor_name', (
      select profile.full_name
        from public.doctors as doctor
        join public.clinic_members as member on member.id = doctor.member_id
        join public.profiles as profile on profile.id = member.user_id
       where doctor.id = earlier.doctor_id
    ),
    'advice', prescription.advice,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'medicine', item.medicine, 'strength', item.strength, 'dose', item.dose, 'frequency', item.frequency,
        'timing', item.timing, 'duration_days', item.duration_days, 'instructions', item.instructions
      ) order by item.position)
        from public.prescription_items as item
       where item.prescription_id = prescription.id
    )
  )
    from public.visits as earlier
    join public.prescriptions as prescription
      on prescription.clinic_id = earlier.clinic_id and prescription.visit_id = earlier.id
   where earlier.clinic_id = p_visit.clinic_id
     and earlier.patient_id = p_visit.patient_id
     and (earlier.created_at, earlier.id) < (p_visit.created_at, p_visit.id)
     and exists (select 1 from public.prescription_items as item where item.prescription_id = prescription.id)
   order by earlier.created_at desc, earlier.id desc
   limit 1;
$$;

revoke all on function public.previous_prescription(public.visits) from public, anon;
grant execute on function public.previous_prescription(public.visits) to authenticated;

-- ------------------------------------------------------------
-- Policies (plan §27.4)
-- ------------------------------------------------------------

alter table public.prescription_templates enable row level security;
alter table public.prescription_template_items enable row level security;

-- The doctor's own, and every doctor's for whoever types for them
-- (`prescriptions.write`, D240, D241).
create policy prescription_templates_select on public.prescription_templates
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (doctor_id = (select public.current_doctor_id()) or (select public.has_permission('prescriptions.write')))
);

-- A template's medicines, where the template itself can be read.
create policy prescription_template_items_select on public.prescription_template_items
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and exists (select 1 from public.prescription_templates as template where template.id = template_id)
);

-- Archived and restored by the doctor alone, while the clinic can write
-- (D240, D242); a restore into a name in use meets the unique index.
create policy prescription_templates_update on public.prescription_templates
for update to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and doctor_id = (select public.current_doctor_id())
  and (select public.clinic_can_write())
)
with check (clinic_id = (select public.current_clinic_id()) and doctor_id = (select public.current_doctor_id()));

-- Made and changed through save_prescription_template; archived and restored
-- by their `active` alone; never deleted.
grant select on public.prescription_templates to authenticated;
grant select on public.prescription_template_items to authenticated;
grant update (active) on public.prescription_templates to authenticated;
