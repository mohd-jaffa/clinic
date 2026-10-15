-- ============================================================
-- 0027 · Who made a follow-up's last contact (plan §14.3; tracker R7.4,
-- D275).
--
-- The follow-ups screen's sheet tells the last contact as the row does —
-- how it went, the day and the note — and who made it, so the desk knows
-- who called. follow_up_rows and follow_up_items hand back the caller's
-- name as `last_contacted_by`; nothing else changes. follow_up_counts reads
-- follow_up_rows by name, so it keeps working as it is.
-- ============================================================

drop function public.follow_up_items(text, integer, integer);
drop function public.follow_up_rows();

-- As 0026's, and who made the last contact (D275): every follow-up of the
-- caller's clinic still to do, within the doctor scope, with its tab — or
-- none past the Upcoming window — and its last contact; and the treatments
-- completed in the window, as Completed. Snoozed ones are left out (D271).
-- The caller's permission is checked by those calling it.
create or replace function public.follow_up_rows()
returns table (
  kind text,
  treatment_id uuid,
  visit_id uuid,
  patient_id uuid,
  patient_name text,
  patient_number integer,
  patient_phone text,
  title text,
  doctor_id uuid,
  doctor_name text,
  due_on date,
  tab text,
  last_outcome text,
  last_contacted_at timestamptz,
  last_note text,
  last_contacted_by text
)
language sql
stable
security definer
set search_path = ''
as $$
  with clinic as (
    select clinic.id,
           (now() at time zone clinic.timezone)::date as today,
           settings.follow_up_lapsed_days as lapsed,
           clinic.timezone
      from public.clinics as clinic
      cross join public.platform_settings as settings
     where clinic.id = (select public.current_clinic_id())
  ),
  due as (
    select 'TREATMENT' as kind, treatment.id as treatment_id, null::uuid as visit_id, treatment.patient_id,
           treatment.name as title, treatment.doctor_id, treatment.next_due_on as due_on,
           treatment.next_due_set_at as set_at
      from public.treatments as treatment, clinic
     where treatment.clinic_id = clinic.id
       and treatment.next_due_on is not null
       and treatment.status in ('PLANNED', 'IN_PROGRESS', 'ON_HOLD')
    union all
    select 'VISIT', null, visit.id, visit.patient_id, null, visit.doctor_id, visit.follow_up_on,
           visit.created_at
      from public.visits as visit, clinic
     where visit.clinic_id = clinic.id
       and visit.follow_up_on is not null
  ),
  pending as (
    select due.*
      from due, clinic
     where ((select public.sees_every_patient()) or due.patient_id in (select public.doctor_patient_ids()))
       -- An appointment for a later day, to come or kept (D268).
       and not exists (
         select 1
           from public.appointments as appointment
          where appointment.clinic_id = clinic.id
            and appointment.patient_id = due.patient_id
            and appointment.local_date > (due.set_at at time zone clinic.timezone)::date
            and (
              appointment.status = 'COMPLETED'
              or (appointment.status in ('SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS')
                  and appointment.local_date >= clinic.today)
            )
       )
       -- A visit opened after it was set (D268).
       and not exists (
         select 1
           from public.visits as later
          where later.clinic_id = clinic.id
            and later.patient_id = due.patient_id
            and later.created_at > due.set_at
       )
  ),
  completed as (
    select 'TREATMENT' as kind, treatment.id as treatment_id, null::uuid as visit_id, treatment.patient_id,
           treatment.name as title, treatment.doctor_id, treatment.completed_on as due_on, 'COMPLETED' as tab
      from public.treatments as treatment, clinic
     where treatment.clinic_id = clinic.id
       and treatment.completed_on >= clinic.today - 30
       and ((select public.sees_every_patient()) or treatment.patient_id in (select public.doctor_patient_ids()))
  ),
  tabbed as (
    select pending.kind, pending.treatment_id, pending.visit_id, pending.patient_id, pending.title,
           pending.doctor_id, pending.due_on,
           case
             when pending.due_on = clinic.today then 'TODAY'
             when pending.due_on > clinic.today and pending.due_on <= clinic.today + 30 then 'UPCOMING'
             when pending.due_on < clinic.today and pending.due_on >= clinic.today - clinic.lapsed then 'OVERDUE'
             when pending.due_on < clinic.today - clinic.lapsed then 'LAPSED'
           end as tab
      from pending, clinic
    union all
    select completed.kind, completed.treatment_id, completed.visit_id, completed.patient_id, completed.title,
           completed.doctor_id, completed.due_on, completed.tab
      from completed
  )
  select tabbed.kind, tabbed.treatment_id, tabbed.visit_id, tabbed.patient_id,
         patient.full_name, patient.patient_number, patient.phone,
         tabbed.title, tabbed.doctor_id, profile.full_name, tabbed.due_on, tabbed.tab,
         contact.outcome, contact.contacted_at, contact.note, contact.caller
    from tabbed
    cross join clinic
    join public.patients as patient on patient.id = tabbed.patient_id and patient.archived_at is null
    left join public.doctors as doctor on doctor.id = tabbed.doctor_id
    left join public.clinic_members as member on member.id = doctor.member_id
    left join public.profiles as profile on profile.id = member.user_id
    left join lateral (
      select last.outcome, last.contacted_at, last.note, last.snooze_until, caller.full_name as caller
        from public.follow_up_contacts as last
        left join public.profiles as caller on caller.id = last.contacted_by
       where last.clinic_id = clinic.id
         and (last.treatment_id = tabbed.treatment_id or last.visit_id = tabbed.visit_id)
       order by last.contacted_at desc
       limit 1
    ) as contact on true
   where tabbed.tab is not null
     -- Snoozed till a later day: out of the lists and the counts (D271); Completed is not a call to make.
     and (tabbed.tab = 'COMPLETED' or contact.snooze_until is null or contact.snooze_until <= clinic.today);
$$;

-- As 0026's, with who made the last contact (D275): a tab's follow-ups, a
-- page at a time (§14.3), the earliest due first — Completed, the latest
-- completed first — for whoever works them (D267).
create or replace function public.follow_up_items(p_tab text, p_offset integer, p_limit integer)
returns table (
  kind text,
  treatment_id uuid,
  visit_id uuid,
  patient_id uuid,
  patient_name text,
  patient_number integer,
  patient_phone text,
  title text,
  doctor_id uuid,
  doctor_name text,
  due_on date,
  last_outcome text,
  last_contacted_at timestamptz,
  last_note text,
  last_contacted_by text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_clinic_id() is null or not public.works_follow_ups() then
    raise exception 'Follow-ups need appointments.view or visits.view' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  if p_tab is null or p_tab not in ('TODAY', 'OVERDUE', 'UPCOMING', 'LAPSED', 'COMPLETED') then
    raise exception 'Not a tab of the follow-ups' using hint = 'VALIDATION_ERROR';
  end if;
  return query
  select row.kind, row.treatment_id, row.visit_id, row.patient_id, row.patient_name, row.patient_number,
         row.patient_phone, row.title, row.doctor_id, row.doctor_name, row.due_on, row.last_outcome,
         row.last_contacted_at, row.last_note, row.last_contacted_by
    from public.follow_up_rows() as row
   where row.tab = p_tab
   order by case when p_tab = 'COMPLETED' then row.due_on end desc,
            row.due_on, row.patient_name, coalesce(row.treatment_id, row.visit_id)
  offset greatest(p_offset, 0)
   limit greatest(p_limit, 1);
end;
$$;

revoke all on function public.follow_up_rows() from public, anon, authenticated;
revoke all on function public.follow_up_items(text, integer, integer) from public, anon;
grant execute on function public.follow_up_items(text, integer, integer) to authenticated;
