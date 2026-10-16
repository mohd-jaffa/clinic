-- ============================================================
-- 0029 · Payments and balances (plan §15.3, §15.4, §28.6, §28.7; tracker
-- R8.4, D4, D282, D294 – D301).
--
-- 1. `payments`: money taken from a patient, or handed back (a refund) —
--    against the patient, never a bill (D4); its method, reference, when it
--    was paid (any time up to now, D299, and that day in the clinic's
--    timezone) and who received it. Never edited: a mistake is voided, with
--    a reason, once.
-- 2. `patient_balances`: each patient's billed, paid and refunded, and the
--    balance — positive due, negative advance — kept up to date by the money
--    functions in the same transaction as each bill, void, payment and
--    refund (D295), so the Owing tab and Outstanding read it from an index.
-- 3. `bill_settlement`: each issued bill's paid and due, the patient's net
--    payments settling their bills oldest first (D298), and its state —
--    Paid, Part paid or Unpaid. Read for a patient, or for bills with their
--    patient named, so it works out one patient's bills at a time.
-- 4. record_payment: a payment (payments.create), or a refund
--    (payments.edit) of no more than the patient holds in advance (D297).
--    Once per idempotency key.
-- 5. void_payment (payments.edit, a reason): refused while what was
--    refunded would be more than what is left paid — the refund is voided
--    first (D301).
-- 6. create_bill takes the payment collected with the bill — Collect now,
--    Issue and collect at arrival — in its transaction (D282); create_bill
--    and void_bill keep the balance.
--
-- No `patient_stats` (D296): the profile's summary serves the next
-- appointment and open treatments, and the list reads the balances. A
-- patient who owes, or holds an advance, may still be archived; the balance
-- stays and counts (D300).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Payments
-- ------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null,
  kind text not null default 'PAYMENT' check (kind in ('PAYMENT', 'REFUND')),
  -- Within MAX_AMOUNT_PAISE; never nothing.
  amount_paise integer not null check (amount_paise between 1 and 100000000),
  method text not null check (method in ('CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER')),
  -- A UPI transaction id, a cheque number.
  reference text check (public.is_clean_line(reference, 100)),
  -- When it was paid, never later than when it was recorded (D299), and that
  -- day in the clinic's timezone (AGENTS.md §15).
  paid_at timestamptz not null default now(),
  paid_on date not null,
  note text check (public.is_clean_line(note, 200)),
  status text not null default 'RECORDED' check (status in ('RECORDED', 'VOID')),
  void_reason text check (public.is_clean_line(void_reason, 200)),
  voided_by uuid references public.profiles (id) on delete set null,
  voided_at timestamptz,
  -- Who took the money, or handed it back (plan §15.3).
  received_by uuid references public.profiles (id) on delete set null,
  -- A double tap makes one payment (plan §15.3).
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (id, clinic_id),
  unique (clinic_id, idempotency_key),
  -- The clinic's own patient; a payment is a record, so the patient stays.
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id),
  -- Void when it was, with its reason; recorded with neither.
  constraint payments_void check (
    (status = 'VOID') = (voided_at is not null) and (status = 'VOID') = (void_reason is not null)
  )
);

-- Every read leads with the clinic (plan §37.1): the payments, newest first
-- (Billing's Payments tab, §15.4); a patient's (their history, R8.6).
create index payments_clinic_id_paid_at_idx on public.payments (clinic_id, paid_at desc);
create index payments_clinic_id_patient_id_idx on public.payments (clinic_id, patient_id, paid_at desc);
create index payments_received_by_idx on public.payments (received_by);
create index payments_voided_by_idx on public.payments (voided_by) where voided_by is not null;

-- A payment is never edited (plan §15.3): it only goes void, once, stamped
-- with when and by whom.
create or replace function public.check_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'VOID' or new.status <> 'VOID'
     or (to_jsonb(new) - array['status', 'void_reason', 'voided_by', 'voided_at'])
        <> (to_jsonb(old) - array['status', 'void_reason', 'voided_by', 'voided_at']) then
    raise exception 'A payment is voided, never edited' using hint = 'VALIDATION_ERROR';
  end if;
  new.voided_at := now();
  new.voided_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.check_payment() from public, anon, authenticated;

create trigger check_payment before update on public.payments
for each row execute function public.check_payment();

-- ------------------------------------------------------------
-- 2. Balances (D295)
-- ------------------------------------------------------------

-- Each patient's money, as the money functions leave it: billed (issued
-- bills), paid and refunded (recorded payments), and the balance — billed −
-- paid + refunded; positive is due, negative an advance (plan §15.4). A
-- patient with none of it has no row, and a balance of nothing.
create table public.patient_balances (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid primary key,
  billed_paise bigint not null default 0 check (billed_paise >= 0),
  paid_paise bigint not null default 0 check (paid_paise >= 0),
  refunded_paise bigint not null default 0 check (refunded_paise >= 0),
  balance_paise bigint generated always as (billed_paise - paid_paise + refunded_paise) stored,
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id),
  -- What was handed back never exceeds what was paid in (D297, D301).
  constraint patient_balances_refunds check (refunded_paise <= paid_paise)
);

-- Those who owe, most first (the Owing tab and Outstanding, §10.2, §15.4).
create index patient_balances_clinic_id_owing_idx
  on public.patient_balances (clinic_id, balance_paise desc) where balance_paise > 0;

-- The money a bill, a void, a payment or a refund moves, added to the
-- patient's row — made, at nothing, with the first of them (a CHECK reads the
-- row an insert proposes, so a void's negative amounts are never inserted).
-- The row is held until the transaction ends, so two at once for one patient
-- wait in turn. Hands back the row as it now stands.
create or replace function public.add_to_balance(
  p_clinic_id uuid,
  p_patient_id uuid,
  p_billed bigint,
  p_paid bigint,
  p_refunded bigint
)
returns public.patient_balances
language sql
security definer
set search_path = ''
as $$
  insert into public.patient_balances (clinic_id, patient_id)
  values (p_clinic_id, p_patient_id)
  on conflict (patient_id) do nothing;
  update public.patient_balances as balance
     set billed_paise = balance.billed_paise + p_billed,
         paid_paise = balance.paid_paise + p_paid,
         refunded_paise = balance.refunded_paise + p_refunded,
         updated_at = now()
   where balance.patient_id = p_patient_id
  returning balance.*;
$$;

revoke all on function public.add_to_balance(uuid, uuid, bigint, bigint, bigint) from public, anon, authenticated;

-- The bills issued before payments came (0028) count from now on.
insert into public.patient_balances (clinic_id, patient_id, billed_paise)
select bill.clinic_id, bill.patient_id, sum(bill.total_paise)
  from public.bills as bill
 where bill.status = 'ISSUED'
 group by bill.clinic_id, bill.patient_id;

-- ------------------------------------------------------------
-- 3. Each bill's paid and due (plan §15.2, D298)
-- ------------------------------------------------------------

-- Each issued bill, and what the patient's net payments (paid − refunded)
-- settle of it, their bills taken oldest first: what the bills before it
-- did not take, up to its total. Its state is Paid when nothing is due —
-- a bill that came to nothing too — Part paid when some is, Unpaid when
-- none. Read as the caller (RLS on the bills and the balances), for a
-- patient, or for bills with their patient named: the patient is the
-- window's partition, so only their bills are worked through.
create view public.bill_settlement with (security_invoker = true) as
select bill.id as bill_id,
       bill.clinic_id,
       bill.patient_id,
       bill.issued_at,
       bill.total_paise,
       settled.paid_paise,
       bill.total_paise - settled.paid_paise as due_paise,
       case
         when bill.total_paise - settled.paid_paise = 0 then 'PAID'
         when settled.paid_paise > 0 then 'PART_PAID'
         else 'UNPAID'
       end as state
  from (
    select issued.id, issued.clinic_id, issued.patient_id, issued.issued_at, issued.total_paise,
           sum(issued.total_paise) over (
             partition by issued.patient_id order by issued.issued_at, issued.id
           ) - issued.total_paise as before_paise
      from public.bills as issued
     where issued.status = 'ISSUED'
  ) as bill
  left join public.patient_balances as balance on balance.patient_id = bill.patient_id
  cross join lateral (
    select least(
      bill.total_paise,
      greatest(0, coalesce(balance.paid_paise - balance.refunded_paise, 0) - bill.before_paise)
    ) as paid_paise
  ) as settled;

-- ------------------------------------------------------------
-- 4. Recording a payment or a refund (plan §15.3; D297, D299)
-- ------------------------------------------------------------

-- A payment (payments.create) or a refund (payments.edit), while the clinic
-- can write, for a patient the caller sees and who is not archived (D103).
-- `p_payment` names the patient, the kind (a payment unless said), the
-- amount, the method, a reference, when it was paid (now unless said; never
-- later, D299) and a note. A payment beyond what is owed is an advance; a
-- refund is no more than the advance held (D297). Received by the caller.
-- Once per idempotency key. Hands back the payment, whether this call
-- recorded it, and the balance after.
create or replace function public.record_payment(p_payment jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  given public.payments := jsonb_populate_record(null::public.payments, p_payment);
  found_patient public.patients;
  held public.patient_balances;
  made public.payments;
  balance_after public.patient_balances;
begin
  given.kind := coalesce(given.kind, 'PAYMENT');
  if clinic is null
     or not public.has_permission(case when given.kind = 'REFUND' then 'payments.edit' else 'payments.create' end) then
    raise exception 'A payment needs payments.create, a refund payments.edit' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  if p_idempotency_key is null then
    raise exception 'A payment needs its idempotency key' using hint = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  perform public.require_clinic_write(clinic);

  perform pg_advisory_xact_lock(hashtextextended(clinic::text || ':' || p_idempotency_key::text, 0));
  select * into made
    from public.payments as payment
   where payment.clinic_id = clinic and payment.idempotency_key = p_idempotency_key;
  if made.id is not null then
    select * into balance_after from public.patient_balances as balance where balance.patient_id = made.patient_id;
    return jsonb_build_object(
      'payment_id', made.id, 'created', false, 'balance_paise', coalesce(balance_after.balance_paise, 0)
    );
  end if;

  select * into found_patient
    from public.patients as patient
   where patient.id = given.patient_id and patient.clinic_id = clinic;
  if found_patient.id is null or not public.can_see_patient(found_patient.id) then
    raise exception 'No such patient' using hint = 'RECORD_NOT_FOUND';
  end if;
  if found_patient.archived_at is not null then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;
  given.paid_at := coalesce(given.paid_at, now());
  if given.paid_at > now() then
    raise exception 'Paid now or before' using hint = 'VALIDATION_ERROR';
  end if;

  if given.kind = 'REFUND' then
    select * into held
      from public.patient_balances as balance
     where balance.patient_id = found_patient.id
     for update;
    if coalesce(held.paid_paise - held.refunded_paise - held.billed_paise, 0) < given.amount_paise then
      raise exception 'A refund is no more than the advance held' using hint = 'PAYMENT_REFUND_TOO_LARGE';
    end if;
  end if;

  insert into public.payments (
    clinic_id, patient_id, kind, amount_paise, method, reference, paid_at, paid_on, note, received_by,
    idempotency_key
  )
  select clinic, found_patient.id, given.kind, given.amount_paise, given.method, given.reference, given.paid_at,
         (given.paid_at at time zone place.timezone)::date, given.note, auth.uid(), p_idempotency_key
    from public.clinics as place
   where place.id = clinic
  returning * into made;
  balance_after := public.add_to_balance(
    clinic, found_patient.id, 0,
    case when made.kind = 'PAYMENT' then made.amount_paise else 0 end,
    case when made.kind = 'REFUND' then made.amount_paise else 0 end
  );
  return jsonb_build_object('payment_id', made.id, 'created', true, 'balance_paise', balance_after.balance_paise);
end;
$$;

-- ------------------------------------------------------------
-- 5. Voiding a payment (plan §15.3; D301)
-- ------------------------------------------------------------

-- A payment or refund entered by mistake: payments.edit, while the clinic
-- can write, for a patient the caller sees and who is not archived, with a
-- reason. It stays, marked Void, and leaves the balance. A payment is not
-- voided while what was refunded would then be more than what is left paid:
-- the refund is voided first (D301). Twice changes nothing more. Hands back
-- its status before, its kind and amount, and the balance after.
create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  found public.payments;
  held public.patient_balances;
  balance_after public.patient_balances;
begin
  if clinic is null or not public.has_permission('payments.edit') then
    raise exception 'Voiding a payment needs payments.edit' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  select * into found
    from public.payments as payment
   where payment.id = p_payment_id and payment.clinic_id = clinic
   for update;
  if found.id is null or not public.can_see_patient(found.patient_id) then
    raise exception 'No such payment' using hint = 'RECORD_NOT_FOUND';
  end if;
  select * into held
    from public.patient_balances as balance
   where balance.patient_id = found.patient_id
   for update;
  if found.status = 'VOID' then
    return jsonb_build_object(
      'previously', 'VOID', 'kind', found.kind, 'amount_paise', found.amount_paise,
      'balance_paise', held.balance_paise
    );
  end if;
  if exists (
    select 1 from public.patients as patient where patient.id = found.patient_id and patient.archived_at is not null
  ) then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;
  if p_reason is null then
    raise exception 'A void says why' using hint = 'VALIDATION_ERROR';
  end if;
  if found.kind = 'PAYMENT' and held.paid_paise - found.amount_paise < held.refunded_paise then
    raise exception 'Void the refund first' using hint = 'PAYMENT_HAS_REFUNDS';
  end if;

  update public.payments set status = 'VOID', void_reason = p_reason where id = found.id;
  balance_after := public.add_to_balance(
    clinic, found.patient_id, 0,
    case when found.kind = 'PAYMENT' then -found.amount_paise else 0 end,
    case when found.kind = 'REFUND' then -found.amount_paise else 0 end
  );
  return jsonb_build_object(
    'previously', 'RECORDED', 'kind', found.kind, 'amount_paise', found.amount_paise,
    'balance_paise', balance_after.balance_paise
  );
end;
$$;

revoke all on function public.record_payment(jsonb, uuid) from public, anon;
revoke all on function public.void_payment(uuid, text) from public, anon;
grant execute on function public.record_payment(jsonb, uuid) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 6. A bill, with what is collected with it (D282)
-- ------------------------------------------------------------

-- As 0028's, and two things more: the payment collected with the bill —
-- `payment` in `p_bill` (amount_paise, method, reference), Collect now, or
-- Issue and collect at arrival — is recorded in the same transaction, paid
-- now, received by the caller, under the bill's own idempotency key; and
-- the patient's balance takes the bill and the payment. A bill issued again
-- by its key hands back the payment it was issued with. Hands back the
-- bill, its number and total, the payment, whether this call issued it, the
-- visit's move, and the balance after.
create or replace function public.create_bill(p_bill jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  discounts boolean := public.has_permission('payments.discount');
  given public.bills;
  found_patient public.patients;
  found_visit public.visits;
  found_appointment public.appointments;
  doctor uuid;
  fee integer;
  line public.bill_items;
  lines public.bill_items[] := '{}';
  service public.services;
  subtotal bigint := 0;
  today date;
  year text;
  made public.bills;
  paying public.payments;
  paid public.payments;
  moved jsonb;
  balance_after public.patient_balances;
begin
  if clinic is null or not public.has_permission('payments.create') then
    raise exception 'Issuing a bill needs payments.create' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  if p_idempotency_key is null then
    raise exception 'A bill needs its idempotency key' using hint = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  perform public.require_clinic_write(clinic);

  perform pg_advisory_xact_lock(hashtextextended(clinic::text || ':' || p_idempotency_key::text, 0));
  select * into made
    from public.bills as bill
   where bill.clinic_id = clinic and bill.idempotency_key = p_idempotency_key;
  if made.id is not null then
    select * into paid
      from public.payments as payment
     where payment.clinic_id = clinic and payment.idempotency_key = p_idempotency_key;
    select * into balance_after from public.patient_balances as balance where balance.patient_id = made.patient_id;
    return jsonb_build_object(
      'bill_id', made.id, 'bill_number', made.bill_number, 'total_paise', made.total_paise,
      'payment_id', paid.id, 'created', false, 'visit', null, 'balance_paise', coalesce(balance_after.balance_paise, 0)
    );
  end if;

  given := jsonb_populate_record(null::public.bills, p_bill);
  select * into found_patient
    from public.patients as patient
   where patient.id = given.patient_id and patient.clinic_id = clinic;
  if found_patient.id is null or not public.can_see_patient(found_patient.id) then
    raise exception 'No such patient' using hint = 'RECORD_NOT_FOUND';
  end if;
  if found_patient.archived_at is not null then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;

  -- What it bills, held until it is issued: the queue's moves wait for it,
  -- and so see it when they close the visit.
  if given.visit_id is not null and given.appointment_id is not null then
    raise exception 'A bill is for a visit or an arrival, not both' using hint = 'VALIDATION_ERROR';
  elsif given.visit_id is not null then
    select * into found_visit
      from public.visits as visit
     where visit.id = given.visit_id and visit.clinic_id = clinic
     for update;
    if found_visit.id is null or found_visit.patient_id <> found_patient.id then
      raise exception 'No such visit' using hint = 'RECORD_NOT_FOUND';
    end if;
    doctor := found_visit.doctor_id;
  elsif given.appointment_id is not null then
    select * into found_appointment
      from public.appointments as appointment
     where appointment.id = given.appointment_id and appointment.clinic_id = clinic
     for update;
    if found_appointment.id is null or found_appointment.patient_id <> found_patient.id then
      raise exception 'No such appointment' using hint = 'RECORD_NOT_FOUND';
    end if;
    if found_appointment.status not in ('ARRIVED', 'IN_PROGRESS') then
      raise exception 'The fee at arrival is taken while they are here' using hint = 'APPOINTMENT_STATUS_NOT_ALLOWED';
    end if;
    doctor := found_appointment.doctor_id;
  elsif given.doctor_id is not null then
    if not exists (
      select 1
        from public.doctors as picked
        join public.clinic_members as member on member.id = picked.member_id
       where picked.id = given.doctor_id and picked.clinic_id = clinic and picked.active and member.status = 'ACTIVE'
    ) then
      raise exception 'Not one of the clinic''s active doctors' using hint = 'DOCTOR_INACTIVE';
    end if;
    doctor := given.doctor_id;
  end if;
  select bill_doctor.consultation_fee_paise into fee from public.doctors as bill_doctor where bill_doctor.id = doctor;

  if jsonb_typeof(p_bill -> 'items') is distinct from 'array'
     or jsonb_array_length(p_bill -> 'items') not between 1 and 50 then
    raise exception 'A bill has 1 to 50 lines' using hint = 'VALIDATION_ERROR';
  end if;
  for line in select * from jsonb_populate_recordset(null::public.bill_items, p_bill -> 'items') loop
    if line.quantity is null or line.quantity not between 1 and 999
       or line.unit_price_paise is null or line.unit_price_paise not between 0 and 100000000
       or line.quantity::bigint * line.unit_price_paise > 100000000 then
      raise exception 'A line''s quantity, price or amount is out of bounds' using hint = 'VALIDATION_ERROR';
    end if;
    if line.service_id is not null then
      select * into service
        from public.services as entry
       where entry.id = line.service_id and entry.clinic_id = clinic and entry.active;
      if service.id is null then
        raise exception 'Not one of the clinic''s active services' using hint = 'SERVICE_INACTIVE';
      end if;
      line.description := service.name;
      if not discounts and line.unit_price_paise <> service.price_paise
         and not (service.category = 'CONSULTATION' and fee is not null and line.unit_price_paise = fee) then
        raise exception 'A price not the price list''s needs payments.discount' using hint = 'BILL_PRICE_NOT_ALLOWED';
      end if;
    elsif not discounts then
      raise exception 'A typed line needs payments.discount' using hint = 'BILL_PRICE_NOT_ALLOWED';
    end if;
    if line.treatment_id is not null and not exists (
      select 1
        from public.treatments as treatment
       where treatment.id = line.treatment_id and treatment.clinic_id = clinic
         and treatment.patient_id = found_patient.id
    ) then
      raise exception 'No such treatment' using hint = 'RECORD_NOT_FOUND';
    end if;
    line.position := coalesce(array_length(lines, 1), 0) + 1;
    line.amount_paise := line.quantity * line.unit_price_paise;
    subtotal := subtotal + line.amount_paise;
    lines := lines || line;
  end loop;

  given.discount_paise := coalesce(given.discount_paise, 0);
  if given.discount_paise <> 0 and not discounts then
    raise exception 'A discount needs payments.discount' using hint = 'BILL_PRICE_NOT_ALLOWED';
  end if;
  -- The totals the screen showed, from billing/totals.ts, are the ones issued (plan §15.1).
  if subtotal > 100000000 or given.discount_paise not between 0 and subtotal
     or given.subtotal_paise is distinct from subtotal
     or given.total_paise is distinct from subtotal - given.discount_paise then
    raise exception 'The totals do not add up' using hint = 'VALIDATION_ERROR';
  end if;

  today := public.clinic_today(clinic);
  year := public.financial_year(today);
  insert into public.bills (
    clinic_id, patient_id, visit_id, appointment_id, doctor_id, issued_on, financial_year, bill_number,
    subtotal_paise, discount_paise, total_paise, notes, idempotency_key, created_by
  )
  values (
    clinic, found_patient.id, found_visit.id, found_appointment.id, doctor, today, year,
    public.next_bill_number(clinic, year), subtotal, given.discount_paise, subtotal - given.discount_paise,
    given.notes, p_idempotency_key, auth.uid()
  )
  returning * into made;
  insert into public.bill_items (
    clinic_id, bill_id, position, service_id, treatment_id, description, quantity, unit_price_paise, amount_paise
  )
  select clinic, made.id, item.position, item.service_id, item.treatment_id, item.description, item.quantity,
         item.unit_price_paise, item.amount_paise
    from unnest(lines) as item;

  -- What is collected with it, paid now (D282).
  if jsonb_typeof(p_bill -> 'payment') = 'object' then
    paying := jsonb_populate_record(null::public.payments, p_bill -> 'payment');
    insert into public.payments (
      clinic_id, patient_id, kind, amount_paise, method, reference, paid_at, paid_on, received_by, idempotency_key
    )
    values (
      clinic, found_patient.id, 'PAYMENT', paying.amount_paise, paying.method, paying.reference, now(), today,
      auth.uid(), p_idempotency_key
    )
    returning * into paid;
  end if;
  balance_after := public.add_to_balance(clinic, found_patient.id, made.total_paise, coalesce(paid.amount_paise, 0), 0);

  if found_visit.status = 'COMPLETED' and found_visit.billing_status <> 'BILLED' then
    update public.visits
       set billing_status = 'BILLED', no_charge_reason = null, no_charge_note = null
     where id = found_visit.id;
    moved := jsonb_build_object('id', found_visit.id, 'from', found_visit.billing_status, 'to', 'BILLED');
  end if;
  return jsonb_build_object(
    'bill_id', made.id, 'bill_number', made.bill_number, 'total_paise', made.total_paise,
    'payment_id', paid.id, 'created', true, 'visit', moved, 'balance_paise', balance_after.balance_paise
  );
end;
$$;

-- As 0028's, and the patient's balance no longer counts the bill. Hands back
-- its status before, the visit's move, and the balance after.
create or replace function public.void_bill(p_bill_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  found public.bills;
  billed public.visits;
  moved jsonb;
  balance_after public.patient_balances;
begin
  if clinic is null or not public.has_permission('payments.edit') then
    raise exception 'Voiding a bill needs payments.edit' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  select * into found
    from public.bills as bill
   where bill.id = p_bill_id and bill.clinic_id = clinic
   for update;
  if found.id is null or not public.can_see_patient(found.patient_id) then
    raise exception 'No such bill' using hint = 'RECORD_NOT_FOUND';
  end if;
  if found.status = 'VOID' then
    select * into balance_after from public.patient_balances as balance where balance.patient_id = found.patient_id;
    return jsonb_build_object('previously', 'VOID', 'visit', null, 'balance_paise', balance_after.balance_paise);
  end if;
  if exists (
    select 1 from public.patients as patient where patient.id = found.patient_id and patient.archived_at is not null
  ) then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;
  if p_reason is null then
    raise exception 'A void says why' using hint = 'VALIDATION_ERROR';
  end if;

  update public.bills set status = 'VOID', void_reason = p_reason where id = found.id;
  select * into billed
    from public.visits as visit
   where visit.clinic_id = clinic
     and visit.status = 'COMPLETED'
     and visit.billing_status = 'BILLED'
     and (visit.id = found.visit_id or visit.appointment_id = found.appointment_id)
   for update;
  if billed.id is not null and not public.visit_billed(billed) then
    update public.visits set billing_status = 'TO_BILL' where id = billed.id;
    moved := jsonb_build_object('id', billed.id, 'from', 'BILLED', 'to', 'TO_BILL');
  end if;
  balance_after := public.add_to_balance(clinic, found.patient_id, -found.total_paise, 0, 0);
  return jsonb_build_object('previously', 'ISSUED', 'visit', moved, 'balance_paise', balance_after.balance_paise);
end;
$$;

-- ------------------------------------------------------------
-- Policies (plan §27.4)
-- ------------------------------------------------------------

alter table public.payments enable row level security;
alter table public.patient_balances enable row level security;

-- payments.view, within the doctor scope (D3), worked out once a statement
-- (plan §37.1).
create policy payments_select on public.payments
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('payments.view'))
  and ((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))
);

create policy patient_balances_select on public.patient_balances
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('payments.view'))
  and ((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))
);

-- Recorded and voided only through the functions above, the balances kept
-- by them alone; never deleted.
grant select on public.payments, public.patient_balances, public.bill_settlement to authenticated;
