-- ============================================================
-- 0026 · Follow-ups (plan §14.2, §14.3; tracker R7.3, D267 – D271).
--
-- 1. A follow-up is an open treatment's next due day — on hold too, when it
--    has one (D269) — or a visit's follow-up day, for a patient who is not
--    archived. Its patient comes back, so it is done (D268), once they have:
--    - an appointment for a later day than the one it was set on, with any
--      doctor, still to come or kept — one cancelled, missed, or left
--      unmarked on a day gone by does not count, and its cancelling reopens
--      the follow-up;
--    - or a visit opened after it was set, with any doctor;
--    - or, for a treatment, it closed or lost its next due day.
--    A treatment keeps when its next due day was set (`next_due_set_at`); a
--    visit's was set with the visit.
-- 2. `follow_up_contacts`: each call or message about one — its outcome, a
--    note, and a day to be reminded on, which keeps the follow-up out of the
--    lists and their counts until then (D271). Never changed; the latest is
--    "last contact".
-- 3. follow_up_items(tab) and follow_up_counts(): the follow-ups screen's
--    tabs, worked out here in the clinic's timezone (§14.3) — Today; Overdue,
--    up to `follow_up_lapsed_days` (§6) ago; Upcoming, the next
--    FOLLOW_UP_WINDOW_DAYS (D270); Lapsed, before that; Completed, the
--    treatments completed in the last FOLLOW_UP_WINDOW_DAYS. For whoever
--    sees appointments or visits (D267) — the front desk makes the calls —
--    within the doctor scope (D3): the patient, what is due (a treatment's
--    name, or a visit's follow-up), its doctor and day, and the last contact;
--    nothing more of the record.
-- 4. record_follow_up_contact: a contact noted, by `appointments.edit` or
--    `visits.edit` (D267), while the clinic can write.
-- ============================================================

-- ------------------------------------------------------------
-- 1. When a treatment's next due day was set (D268)
-- ------------------------------------------------------------

alter table public.treatments add column next_due_set_at timestamptz;

-- Treatments due before this migration were last set when last changed.
update public.treatments set next_due_set_at = updated_at where next_due_on is not null;

alter table public.treatments
  add constraint treatments_next_due_set check ((next_due_on is null) = (next_due_set_at is null));

-- Stamped whenever the day is given or changed, after check_treatment has
-- had its say (triggers fire by name); cleared with it.
create or replace function public.stamp_treatment_next_due()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.next_due_on is distinct from old.next_due_on then
    new.next_due_set_at := case when new.next_due_on is not null then now() end;
  end if;
  return new;
end;
$$;

revoke all on function public.stamp_treatment_next_due() from public, anon, authenticated;

create trigger stamp_treatment_next_due before insert or update on public.treatments
for each row execute function public.stamp_treatment_next_due();

-- The follow-ups each side holds, by day (plan §37.1): open treatments with a
-- next due day; visits with a follow-up day.
create index treatments_clinic_id_next_due_on_idx
  on public.treatments (clinic_id, next_due_on) where next_due_on is not null;
create index visits_clinic_id_follow_up_on_idx
  on public.visits (clinic_id, follow_up_on) where follow_up_on is not null;
-- The Completed tab: treatments by the day they were completed.
create index treatments_clinic_id_completed_on_idx
  on public.treatments (clinic_id, completed_on desc) where completed_on is not null;

-- ------------------------------------------------------------
-- 2. Contacts (D271)
-- ------------------------------------------------------------

create table public.follow_up_contacts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null,
  -- What it was about: a treatment's next sitting, or a visit's follow-up.
  treatment_id uuid,
  visit_id uuid,
  outcome text not null check (outcome in ('REACHED', 'NO_ANSWER', 'BOOKED', 'DECLINED', 'REMINDER_SENT')),
  note text check (public.is_clean_line(note, 200)),
  -- Out of the lists until this day (D271).
  snooze_until date,
  contacted_by uuid references public.profiles (id) on delete set null,
  contacted_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id),
  foreign key (treatment_id, clinic_id) references public.treatments (id, clinic_id),
  foreign key (visit_id, clinic_id) references public.visits (id, clinic_id),
  constraint follow_up_contacts_one_item check ((treatment_id is null) <> (visit_id is null))
);

-- A follow-up's last contact, newest first; a patient's contacts; who made them.
create index follow_up_contacts_clinic_id_treatment_id_idx
  on public.follow_up_contacts (clinic_id, treatment_id, contacted_at desc) where treatment_id is not null;
create index follow_up_contacts_clinic_id_visit_id_idx
  on public.follow_up_contacts (clinic_id, visit_id, contacted_at desc) where visit_id is not null;
create index follow_up_contacts_clinic_id_patient_id_idx
  on public.follow_up_contacts (clinic_id, patient_id, contacted_at desc);
create index follow_up_contacts_contacted_by_idx on public.follow_up_contacts (contacted_by);

-- ------------------------------------------------------------
-- 3. The follow-ups and their tabs (§14.3; D267 – D271)
-- ------------------------------------------------------------

-- Whether the caller works the follow-ups (D267): appointments or visits seen.
create or replace function public.works_follow_ups()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('appointments.view') or public.has_permission('visits.view');
$$;

-- Asked by the contacts' policy, as the member.
revoke all on function public.works_follow_ups() from public, anon;
grant execute on function public.works_follow_ups() to authenticated, service_role;

-- Every follow-up of the caller's clinic still to do, within the doctor scope,
-- with its tab — or none past the Upcoming window — and its last contact;
-- and the treatments completed in the window, as Completed. Snoozed ones are
-- left out (D271). The caller's permission is checked by those calling it.
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
  last_note text
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
         contact.outcome, contact.contacted_at, contact.note
    from tabbed
    cross join clinic
    join public.patients as patient on patient.id = tabbed.patient_id and patient.archived_at is null
    left join public.doctors as doctor on doctor.id = tabbed.doctor_id
    left join public.clinic_members as member on member.id = doctor.member_id
    left join public.profiles as profile on profile.id = member.user_id
    left join lateral (
      select last.outcome, last.contacted_at, last.note, last.snooze_until
        from public.follow_up_contacts as last
       where last.clinic_id = clinic.id
         and (last.treatment_id = tabbed.treatment_id or last.visit_id = tabbed.visit_id)
       order by last.contacted_at desc
       limit 1
    ) as contact on true
   where tabbed.tab is not null
     -- Snoozed till a later day: out of the lists and the counts (D271); Completed is not a call to make.
     and (tabbed.tab = 'COMPLETED' or contact.snooze_until is null or contact.snooze_until <= clinic.today);
$$;

revoke all on function public.follow_up_rows() from public, anon, authenticated;

-- A tab's follow-ups, a page at a time (§14.3): the earliest due first —
-- Completed, the latest completed first — for whoever works them (D267).
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
  last_note text
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
         row.last_contacted_at, row.last_note
    from public.follow_up_rows() as row
   where row.tab = p_tab
   order by case when p_tab = 'COMPLETED' then row.due_on end desc,
            row.due_on, row.patient_name, coalesce(row.treatment_id, row.visit_id)
  offset greatest(p_offset, 0)
   limit greatest(p_limit, 1);
end;
$$;

-- How many each tab holds (§14.3), snoozed ones left out (D271).
create or replace function public.follow_up_counts()
returns table (tab text, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_clinic_id() is null or not public.works_follow_ups() then
    raise exception 'Follow-ups need appointments.view or visits.view' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  return query
  select tabs.tab, count(row.tab)
    from unnest(array['TODAY', 'OVERDUE', 'UPCOMING', 'LAPSED', 'COMPLETED']) as tabs (tab)
    left join public.follow_up_rows() as row on row.tab = tabs.tab
   group by tabs.tab;
end;
$$;

revoke all on function public.follow_up_items(text, integer, integer) from public, anon;
revoke all on function public.follow_up_counts() from public, anon;
grant execute on function public.follow_up_items(text, integer, integer) to authenticated;
grant execute on function public.follow_up_counts() to authenticated;

-- ------------------------------------------------------------
-- 4. Noting a contact (§14.3; D267, D271)
-- ------------------------------------------------------------

-- A call or a message about one follow-up — a treatment's (`treatment_id`)
-- or a visit's (`visit_id`) — of a patient the caller may see and who is not
-- archived: `appointments.edit` or `visits.edit`, while the clinic can write.
-- A day to be reminded on is after today. Hands back the contact.
create or replace function public.record_follow_up_contact(p_contact jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  treatment uuid := (p_contact ->> 'treatment_id')::uuid;
  visit uuid := (p_contact ->> 'visit_id')::uuid;
  patient uuid;
  snooze date := (p_contact ->> 'snooze_until')::date;
  made public.follow_up_contacts;
begin
  if clinic is null or not (public.has_permission('appointments.edit') or public.has_permission('visits.edit')) then
    raise exception 'Noting a contact needs appointments.edit or visits.edit' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  if (treatment is null) = (visit is null) then
    raise exception 'A contact is about one follow-up' using hint = 'VALIDATION_ERROR';
  end if;
  if treatment is not null then
    select candidate.patient_id into patient
      from public.treatments as candidate
     where candidate.id = treatment and candidate.clinic_id = clinic;
  else
    select candidate.patient_id into patient
      from public.visits as candidate
     where candidate.id = visit and candidate.clinic_id = clinic;
  end if;
  if patient is null or not public.can_see_patient(patient) then
    raise exception 'No such follow-up' using hint = 'RECORD_NOT_FOUND';
  end if;
  if exists (select 1 from public.patients as found where found.id = patient and found.archived_at is not null) then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;
  if snooze is not null and snooze <= public.clinic_today(clinic) then
    raise exception 'Reminded on a later day' using hint = 'VALIDATION_ERROR';
  end if;

  insert into public.follow_up_contacts (
    clinic_id, patient_id, treatment_id, visit_id, outcome, note, snooze_until, contacted_by
  )
  values (clinic, patient, treatment, visit, p_contact ->> 'outcome', p_contact ->> 'note', snooze, auth.uid())
  returning * into made;
  return jsonb_build_object(
    'contact_id', made.id, 'patient_id', made.patient_id, 'outcome', made.outcome,
    'snooze_until', made.snooze_until
  );
end;
$$;

revoke all on function public.record_follow_up_contact(jsonb) from public, anon;
grant execute on function public.record_follow_up_contact(jsonb) to authenticated;

-- ------------------------------------------------------------
-- Policies (plan §27.4)
-- ------------------------------------------------------------

alter table public.follow_up_contacts enable row level security;

-- Whoever works the follow-ups (D267), within the doctor scope (D3), worked
-- out once a statement (plan §37.1).
create policy follow_up_contacts_select on public.follow_up_contacts
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.works_follow_ups())
  and ((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))
);

-- Written only through record_follow_up_contact, and never changed or removed.
grant select on public.follow_up_contacts to authenticated;
