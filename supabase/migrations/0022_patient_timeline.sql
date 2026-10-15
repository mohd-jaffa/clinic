-- ============================================================
-- 0022 · A patient's history and their last visit (plan §10.2, §10.3;
-- tracker R6.5, D101, D225 – D231).
--
-- 1. The history lists visits beside appointments (D225): a patient's
--    visits are read newest first, a page at a time, in their own order.
-- 2. `visit_recorded(visit)`: whether a visit holds anything — what its row
--    in the history says when it holds nothing (D226). A computed field read
--    with the visit, as the member. `visit_is_empty`, which Back to waiting
--    asks (D197), is now its opposite, so the two never disagree.
-- 3. `last_visit_on(patient)`: the day of a patient's latest visit, for the
--    patients list (D228). Everyone who sees the patient sees the day — not
--    what the visit holds — so it is read past the visits' policy, for the
--    caller's own clinic and patients only. A computed field: the list reads
--    it in the same query, one index lookup a row.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A patient's visits, newest first (plan §37.1)
-- ------------------------------------------------------------

create index visits_clinic_id_patient_id_created_at_idx
  on public.visits (clinic_id, patient_id, created_at desc, id desc);

-- ------------------------------------------------------------
-- 2. Whether a visit holds anything (D197, D226)
-- ------------------------------------------------------------

-- A complaint, diagnosis, notes or follow-up; a reading taken; or a
-- prescription with a medicine or advice. Runs as the caller, so it reads
-- only what the policies let them — the visit's own records, for whoever
-- may read the visit.
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
      );
$$;

revoke all on function public.visit_recorded(public.visits) from public, anon;
grant execute on function public.visit_recorded(public.visits) to authenticated;

-- Whether a visit holds nothing recorded (D197): the opposite of
-- visit_recorded, read as the definer — every record of the visit — for
-- Back to waiting. A visit that is not there holds nothing.
create or replace function public.visit_is_empty(p_visit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select not public.visit_recorded(visit) from public.visits as visit where visit.id = p_visit_id), true);
$$;

-- ------------------------------------------------------------
-- 3. A patient's last visit (plan §10.2; D228)
-- ------------------------------------------------------------

-- The day of their latest visit, open or done, by any doctor; none for a
-- patient never seen. The patients policy, asked again of the row handed in
-- — the caller's clinic, `patients.view`, and a doctor's own patients — so
-- it answers only for a patient the caller may see, whatever row is sent.
create or replace function public.last_visit_on(p_patient public.patients)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select max(visit.visit_date)
    from public.visits as visit
   where visit.clinic_id = p_patient.clinic_id
     and visit.patient_id = p_patient.id
     and p_patient.clinic_id = (select public.current_clinic_id())
     and (select public.has_permission('patients.view'))
     and ((select public.sees_every_patient()) or p_patient.id in (select public.doctor_patient_ids()));
$$;

revoke all on function public.last_visit_on(public.patients) from public, anon;
grant execute on function public.last_visit_on(public.patients) to authenticated;
