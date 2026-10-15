-- ============================================================
-- 0025 · Treatments on the visit and the profile (plan §14.1; tracker R7.2,
-- D256 – D263).
--
-- 1. record_treatment_session takes `p_complete` (D257): the last sitting's
--    note and "This completes it" are one save — the session recorded and
--    the treatment completed together, or neither. It hands back the
--    treatment's status before and after, for the audit rows.
-- 2. remove_treatment_session names the session as the visit's screen does:
--    by its treatment and its visit (D254, D256).
-- 3. visit_treatments(visit): what a visit's Treatments card shows (D256) —
--    the patient's open treatments, and any started or worked on in this
--    visit, completed or cancelled since — oldest first. A computed
--    relationship, read with the visit in its one query, as the member, so
--    the policies hold.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A session, and the treatment completed with it (D257)
-- ------------------------------------------------------------

drop function public.record_treatment_session(uuid, uuid, text, jsonb);

-- As 0024's (D248, D249, D206), and `p_complete`: the treatment is then
-- completed in the same transaction — from in progress, which a first
-- session on a planned or on-hold one has just made it; one already
-- completed stays so. Hands back the session, whether this call recorded
-- it, its note before and after, and the treatment's status before and
-- after.
create or replace function public.record_treatment_session(
  p_treatment_id uuid,
  p_visit_id uuid,
  p_note text,
  p_seen jsonb,
  p_complete boolean default false
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
  status_after text;
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

  status_after := treatment.status;
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
      status_after := 'IN_PROGRESS';
    end if;
    insert into public.treatment_sessions (clinic_id, treatment_id, visit_id, note)
    values (visit.clinic_id, treatment.id, visit.id, p_note)
    returning * into saved;
  end if;

  if coalesce(p_complete, false) and status_after <> 'COMPLETED' then
    -- check_treatment holds the move: only an in-progress treatment completes.
    update public.treatments set status = 'COMPLETED' where id = treatment.id;
    status_after := 'COMPLETED';
  end if;

  return jsonb_build_object(
    'session_id', saved.id,
    'created', found.id is null,
    'before', before,
    'after', jsonb_build_object('note', saved.note),
    'status_before', treatment.status,
    'status_after', status_after
  );
end;
$$;

revoke all on function public.record_treatment_session(uuid, uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.record_treatment_session(uuid, uuid, text, jsonb, boolean) to authenticated;

-- ------------------------------------------------------------
-- 2. Removing a session by its treatment and visit (D254, D256)
-- ------------------------------------------------------------

drop function public.remove_treatment_session(uuid);

-- A session recorded by mistake (D254): removed while its visit is open,
-- `visits.edit`; once the visit is done it stays, and only its note is
-- corrected. A treatment it started stays started. Hands back the session
-- removed.
create or replace function public.remove_treatment_session(p_treatment_id uuid, p_visit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  visit public.visits;
  found public.treatment_sessions;
begin
  if clinic is null or not public.has_permission('visits.edit') then
    raise exception 'Removing a session needs visits.edit' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  visit := public.visit_for_change(p_visit_id, 'visits.edit');
  select * into found
    from public.treatment_sessions as session
   where session.clinic_id = clinic and session.treatment_id = p_treatment_id and session.visit_id = visit.id;
  if found.id is null then
    raise exception 'No such session' using hint = 'RECORD_NOT_FOUND';
  end if;
  if visit.status <> 'OPEN' then
    raise exception 'A done visit keeps its sessions' using hint = 'TREATMENT_SESSION_KEPT';
  end if;
  delete from public.treatment_sessions where id = found.id;
  return jsonb_build_object('session_id', found.id);
end;
$$;

revoke all on function public.remove_treatment_session(uuid, uuid) from public, anon;
grant execute on function public.remove_treatment_session(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. A visit's treatments (D256)
-- ------------------------------------------------------------

-- The patient's open treatments, and those started or worked on in this
-- visit, oldest first, on the index on (clinic_id, patient_id, created_at
-- desc). Runs as the caller: `visits.view` within the doctor scope, as
-- every treatment is read.
create or replace function public.visit_treatments(p_visit public.visits)
returns setof public.treatments
language sql
stable
rows 5
set search_path = ''
as $$
  select treatment.*
    from public.treatments as treatment
   where treatment.clinic_id = p_visit.clinic_id
     and treatment.patient_id = p_visit.patient_id
     and (
       treatment.status in ('PLANNED', 'IN_PROGRESS', 'ON_HOLD')
       or treatment.started_visit_id = p_visit.id
       or exists (
         select 1
           from public.treatment_sessions as session
          where session.clinic_id = p_visit.clinic_id
            and session.treatment_id = treatment.id
            and session.visit_id = p_visit.id
       )
     )
   order by treatment.created_at, treatment.id;
$$;

revoke all on function public.visit_treatments(public.visits) from public, anon;
grant execute on function public.visit_treatments(public.visits) to authenticated;
