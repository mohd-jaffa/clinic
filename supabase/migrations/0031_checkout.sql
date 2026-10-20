-- ============================================================
-- 0031 · Checkout: the To-bill list, Billing's bills, the Owing tab (plan
-- §15.4, §15.6, §10.2, §11.4; tracker R8.6, D46, D101, D318 – D325,
-- D334 – D338).
--
-- 1. The To-bill list's index: the visits waiting in To bill, oldest first.
-- 2. to_bill_visits: the visits waiting in To bill, from any day, oldest
--    first, a page at a time — one doctor's or every doctor's — for whoever
--    reads bills (payments.view), reception included, who may not open a
--    visit; so the patient, the doctor, the token, the treatments worked on
--    and whether the consultation was paid at arrival are read here, as
--    checkout needs them, rather than through the visits' policies.
-- 3. to_bill_count: how many wait, for the queue's pin and the Queue item's
--    count (D337).
-- 4. list_bills: Billing's Bills tab — the bills issued between two
--    instants, newest first, a page at a time, each with where it stands
--    (bill_settlement, D298) — Paid, Part paid, Unpaid or Void — and only
--    those in a state when one is asked for (D320). Read as the caller, so
--    payments.view and the doctor scope hold; the settlement is worked out
--    for the patients with a bill in the range only.
-- 5. search_patients takes the Owing tab (D101): the patients who owe, most
--    first with nothing typed.
-- 6. billing_status(appointment): where a finished arrival's visit stands
--    with billing, for the queue's Done — settled only (D318) — to whoever
--    reads bills or visits; reception reads no visit of its own.
--
-- Payments, the Payments tab and Outstanding read the tables of 0029
-- through their own indexes; recording and voiding are 0029's functions.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The To-bill list's index (plan §15.6)
-- ------------------------------------------------------------

create index visits_clinic_id_to_bill_idx on public.visits (clinic_id, completed_at, id)
  where billing_status = 'TO_BILL';

-- ------------------------------------------------------------
-- 2. The visits waiting in To bill (plan §15.6; D318)
-- ------------------------------------------------------------

-- Each visit waiting in To bill — from any day, oldest done first — one
-- doctor's, or every doctor's with none named, within the doctor scope (D3):
-- the visit and its day, the patient and whether they are archived (nothing
-- is billed for them then), the doctor, the arrival and its token, the
-- treatments worked on in it (a session recorded in it), oldest first, and
-- whether its consultation was billed at arrival (the fee, §11.3). A page
-- at a time, served by the partial index above.
create or replace function public.to_bill_visits(p_doctor_id uuid, p_offset integer, p_limit integer)
returns table (
  visit_id uuid,
  visit_date date,
  completed_at timestamptz,
  patient_id uuid,
  patient_name text,
  patient_number integer,
  patient_archived boolean,
  doctor_id uuid,
  doctor_name text,
  appointment_id uuid,
  token_number integer,
  treatments text[],
  fee_paid boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  clinic uuid := public.current_clinic_id();
begin
  if clinic is null or not public.has_permission('payments.view') then
    raise exception 'The To-bill list needs payments.view' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  return query
  select visit.id,
         visit.visit_date,
         visit.completed_at,
         patient.id,
         patient.full_name,
         patient.patient_number,
         patient.archived_at is not null,
         visit.doctor_id,
         profile.full_name,
         visit.appointment_id,
         appointment.token_number,
         coalesce((
           select array_agg(treatment.name order by treatment.created_at, treatment.id)
             from public.treatment_sessions as session
             join public.treatments as treatment on treatment.id = session.treatment_id
            where session.clinic_id = clinic and session.visit_id = visit.id
         ), '{}'::text[]),
         exists (
           select 1
             from public.bills as bill
             join public.bill_items as item on item.bill_id = bill.id
             join public.services as service on service.id = item.service_id
            where bill.clinic_id = clinic
              and bill.status = 'ISSUED'
              and bill.appointment_id = visit.appointment_id
              and service.category = 'CONSULTATION'
         )
    from public.visits as visit
    join public.patients as patient on patient.id = visit.patient_id
    left join public.appointments as appointment on appointment.id = visit.appointment_id
    left join public.doctors as doctor on doctor.id = visit.doctor_id
    left join public.clinic_members as member on member.id = doctor.member_id
    left join public.profiles as profile on profile.id = member.user_id
   where visit.clinic_id = clinic
     and visit.billing_status = 'TO_BILL'
     and (p_doctor_id is null or visit.doctor_id = p_doctor_id)
     and ((select public.sees_every_patient()) or visit.patient_id in (select public.doctor_patient_ids()))
   order by visit.completed_at, visit.id
  offset p_offset
   limit p_limit;
end;
$$;

-- ------------------------------------------------------------
-- 3. How many wait (D337)
-- ------------------------------------------------------------

-- How many visits wait in To bill — one doctor's, or every doctor's — that
-- the caller would find in the list above.
create or replace function public.to_bill_count(p_doctor_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
begin
  if clinic is null or not public.has_permission('payments.view') then
    raise exception 'The To-bill list needs payments.view' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  return (
    select count(*)
      from public.visits as visit
     where visit.clinic_id = clinic
       and visit.billing_status = 'TO_BILL'
       and (p_doctor_id is null or visit.doctor_id = p_doctor_id)
       and ((select public.sees_every_patient()) or visit.patient_id in (select public.doctor_patient_ids()))
  );
end;
$$;

revoke all on function public.to_bill_visits(uuid, integer, integer) from public, anon;
revoke all on function public.to_bill_count(uuid) from public, anon;
grant execute on function public.to_bill_visits(uuid, integer, integer) to authenticated;
grant execute on function public.to_bill_count(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. Billing's bills (plan §15.4; D320, D335)
-- ------------------------------------------------------------

-- The bills issued from `p_from` until `p_to`, newest first, a page at a
-- time: each with its patient and where it stands — Paid, Part paid or
-- Unpaid as `bill_settlement` works it out, or Void — and only those in
-- `p_state` when it names one. Read as the caller: the bills' policy holds
-- it to payments.view, the doctor scope and the clinic. The settlement is
-- read for the patients with a bill in the range, named as a value, so the
-- view works through their bills alone. Served by the index on (clinic_id,
-- issued_at desc), and the settlement by (clinic_id, patient_id, issued_at).
create or replace function public.list_bills(
  p_from timestamptz,
  p_to timestamptz,
  p_state text,
  p_offset integer,
  p_limit integer
)
returns table (
  id uuid,
  bill_number text,
  issued_at timestamptz,
  total_paise integer,
  patient_id uuid,
  patient_name text,
  patient_number integer,
  paid_paise bigint,
  due_paise bigint,
  state text
)
language plpgsql
stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  clinic uuid := (select public.current_clinic_id());
  billed uuid[];
begin
  select array_agg(distinct ranged.patient_id) into billed
    from public.bills as ranged
   where ranged.clinic_id = clinic and ranged.issued_at >= p_from and ranged.issued_at < p_to;
  return query
  select bill.id,
         bill.bill_number,
         bill.issued_at,
         bill.total_paise,
         patient.id,
         patient.full_name,
         patient.patient_number,
         settled.paid_paise,
         settled.due_paise,
         coalesce(settled.state, 'VOID')
    from public.bills as bill
    join public.patients as patient on patient.id = bill.patient_id
    left join (
      select settlement.bill_id, settlement.paid_paise, settlement.due_paise, settlement.state
        from public.bill_settlement as settlement
       where settlement.patient_id = any (billed)
    ) as settled on settled.bill_id = bill.id
   where bill.clinic_id = clinic
     and bill.issued_at >= p_from
     and bill.issued_at < p_to
     and (p_state is null or coalesce(settled.state, 'VOID') = p_state)
   order by bill.issued_at desc, bill.id desc
  offset p_offset
   limit p_limit;
end;
$$;

revoke all on function public.list_bills(timestamptz, timestamptz, text, integer, integer) from public, anon;
grant execute on function public.list_bills(timestamptz, timestamptz, text, integer, integer) to authenticated;

-- ------------------------------------------------------------
-- 5. The patients list's Owing tab (plan §10.2; D101)
-- ------------------------------------------------------------

-- As 0015's, and one thing more: `p_owing` keeps to the patients who owe —
-- a balance due, as the balances' policy lets the caller read it
-- (payments.view) — most owed first among equal matches, so with nothing
-- typed, most owed first.
drop function public.search_patients(text, text, integer, boolean, integer, integer);

create or replace function public.search_patients(
  p_words text,
  p_digits text,
  p_number integer,
  p_archived boolean,
  p_owing boolean,
  p_offset integer,
  p_limit integer
)
returns setof public.patients
language sql
stable
set search_path = ''
as $$
  select patient.*
    from public.patients as patient
    left join public.patient_balances as balance on balance.patient_id = patient.id
   where patient.clinic_id = (select public.current_clinic_id())
     and (patient.archived_at is not null) = p_archived
     and (not p_owing or balance.balance_paise > 0)
     and (
       p_words is null
       or patient.patient_number = p_number
       or patient.phone like '%' || p_digits || '%'
       or patient.full_name ilike '%' || p_words || '%'
       or p_words operator(extensions.<%) patient.full_name
     )
   order by
     coalesce(patient.patient_number = p_number, false) desc,
     coalesce(patient.phone like '%' || p_digits || '%', false) desc,
     coalesce(patient.full_name ilike p_words || '%', false) desc,
     coalesce(patient.full_name ilike '%' || p_words || '%', false) desc,
     coalesce(extensions.word_similarity(p_words, patient.full_name), 0) desc,
     case when p_owing then balance.balance_paise end desc nulls last,
     patient.patient_number desc
  offset p_offset
   limit p_limit;
$$;

revoke all on function public.search_patients(text, text, integer, boolean, boolean, integer, integer) from public, anon;
grant execute on function public.search_patients(text, text, integer, boolean, boolean, integer, integer) to authenticated;

-- ------------------------------------------------------------
-- 6. Where an arrival's visit stands with billing (plan §11.4; D318)
-- ------------------------------------------------------------

-- The billing state of the visit opened for an appointment — To bill,
-- Billed or No charge once done, none while open or with no visit — read
-- with the queue as a column of its rows. For whoever reads bills or
-- visits, within the clinic and the doctor scope: the patients policy,
-- asked again of the row handed in, so it answers only for an appointment
-- the caller may see. On the visits' unique appointment.
create or replace function public.billing_status(p_appointment public.appointments)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select visit.billing_status
    from public.visits as visit
   where visit.clinic_id = p_appointment.clinic_id
     and visit.appointment_id = p_appointment.id
     and p_appointment.clinic_id = (select public.current_clinic_id())
     and ((select public.has_permission('payments.view')) or (select public.has_permission('visits.view')))
     and ((select public.sees_every_patient()) or p_appointment.patient_id in (select public.doctor_patient_ids()));
$$;

revoke all on function public.billing_status(public.appointments) from public, anon;
grant execute on function public.billing_status(public.appointments) to authenticated;
