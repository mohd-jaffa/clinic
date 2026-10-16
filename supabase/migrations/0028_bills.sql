-- ============================================================
-- 0028 · Bills (plan §15.2, §15.6, §11.3, §28.6; tracker R8.1, D27, D29,
-- D46, D282 – D289).
--
-- 1. `bills`: issued final, numbered from the clinic's own counter for its
--    financial year — `2026-27/0001`, April to March in its timezone (D27),
--    never max() + 1 and never reused. Never edited: a mistake is voided,
--    with a reason, and a new bill issued. A bill is for a patient, and for
--    one of their visits, or for the appointment whose fee was taken at
--    arrival (D283), or for neither.
-- 2. `bill_items`: its lines, each a price-list entry — its name copied, and
--    the treatment it is for when it is (D285) — or a line typed with its
--    own price (D284).
-- 3. create_bill: payments.create, once per idempotency key. The totals the
--    screen worked out (billing/totals.ts) are worked out again and checked.
--    Without payments.discount, every price is the price list's — on a
--    Consultation line, the doctor's own fee too (D26, D289) — and there is
--    no typed line and no discount (D29, D284). The visit it bills is Billed
--    from To bill or No charge (D287); a Billed visit may take another bill
--    (D286).
-- 4. void_bill: payments.edit, with a reason; its visit goes back to To bill
--    once nothing billed remains for it (§15.6, D286).
-- 5. mark_no_charge: payments.create; a visit waiting in To bill settled
--    free, with its reason (§15.6).
-- 6. A visit closes Billed when a bill of its own came first (Bill now, in
--    the room), or its fee was billed at arrival and no treatment was worked
--    on in it; otherwise To bill (§15.6). Back to waiting keeps a visit with
--    a bill, as one with anything recorded (D197).
-- 7. A patient with a visit in To bill is not archived (D288).
--
-- The fee at arrival is a bill for the arrived appointment, issued after
-- Arrived gives the token (D283); mark_arrived and add_walk_in are as they
-- were. Payments — Collect now, Issue and collect — join create_bill in
-- 0029 (R8.4, D282).
-- ============================================================

-- A price-list entry a bill line points at, the clinic's own.
alter table public.services add constraint services_id_clinic_unique unique (id, clinic_id);

-- ------------------------------------------------------------
-- 1. Bills and their numbers (D27)
-- ------------------------------------------------------------

-- Each clinic's last bill number of a financial year — 0005's financial_year(),
-- April to March — its first bill starting it at 1.
create table public.bill_counters (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  financial_year text not null check (financial_year ~ '^[0-9]{4}-[0-9]{2}$'),
  last_number integer not null check (last_number >= 1),
  primary key (clinic_id, financial_year)
);

-- The clinic's next bill number of the year: the upsert locks the counter's
-- row, so two bills issued at once never share a number, and a bill that
-- fails takes its number back with it. Four digits at least, more past 9999.
create or replace function public.next_bill_number(p_clinic_id uuid, p_year text)
returns text
language sql
security definer
set search_path = ''
as $$
  insert into public.bill_counters as counter (clinic_id, financial_year, last_number)
  values (p_clinic_id, p_year, 1)
  on conflict (clinic_id, financial_year) do update set last_number = counter.last_number + 1
  returning p_year || '/' || lpad(counter.last_number::text, greatest(4, length(counter.last_number::text)), '0');
$$;

revoke all on function public.next_bill_number(uuid, text) from public, anon, authenticated;

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null,
  -- The visit it bills, or the appointment whose fee was taken at arrival
  -- (§11.3, D283) — or neither, for a bill made from the patient.
  visit_id uuid,
  appointment_id uuid,
  -- The visit's or the appointment's doctor, or one picked; none is "No doctor" (§18).
  doctor_id uuid,
  issued_at timestamptz not null default now(),
  -- The day it was issued in the clinic's timezone, and that day's financial year (D27).
  issued_on date not null,
  financial_year text not null check (financial_year ~ '^[0-9]{4}-[0-9]{2}$'),
  bill_number text not null,
  -- Worked out by create_bill from its lines, within MAX_AMOUNT_PAISE.
  subtotal_paise integer not null check (subtotal_paise between 0 and 100000000),
  discount_paise integer not null default 0 check (discount_paise between 0 and 100000000),
  total_paise integer not null check (total_paise between 0 and 100000000),
  status text not null default 'ISSUED' check (status in ('ISSUED', 'VOID')),
  notes text check (public.is_clean_text(notes, 1000)),
  void_reason text check (public.is_clean_line(void_reason, 200)),
  voided_by uuid references public.profiles (id) on delete set null,
  voided_at timestamptz,
  -- A double tap makes one bill (plan §15.2).
  idempotency_key uuid not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- What the lines' composite foreign key points at.
  unique (id, clinic_id),
  unique (clinic_id, bill_number),
  unique (clinic_id, idempotency_key),
  -- The clinic's own patient, visit, appointment and doctor; a bill is a
  -- record, so none of them is removed while it names them.
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id),
  foreign key (visit_id, clinic_id) references public.visits (id, clinic_id),
  foreign key (appointment_id, clinic_id) references public.appointments (id, clinic_id),
  foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id),
  -- For a visit or for an arrival, never both.
  constraint bills_for check (visit_id is null or appointment_id is null),
  constraint bills_number check (bill_number like financial_year || '/%'),
  constraint bills_totals check (discount_paise <= subtotal_paise and total_paise = subtotal_paise - discount_paise),
  -- Void when it was, with its reason; issued with neither.
  constraint bills_void check (
    (status = 'VOID') = (voided_at is not null) and (status = 'VOID') = (void_reason is not null)
  )
);

-- Every read leads with the clinic (plan §37.1): the bills, newest first
-- (Billing's Bills tab, §15.4); a patient's, in the order they were issued
-- (their balance, §15.4); a visit's and an arrival's (§15.6); a doctor's (§18).
create index bills_clinic_id_issued_at_idx on public.bills (clinic_id, issued_at desc);
create index bills_clinic_id_patient_id_idx on public.bills (clinic_id, patient_id, issued_at);
create index bills_clinic_id_visit_id_idx on public.bills (clinic_id, visit_id) where visit_id is not null;
create index bills_clinic_id_appointment_id_idx
  on public.bills (clinic_id, appointment_id) where appointment_id is not null;
create index bills_clinic_id_doctor_id_idx on public.bills (clinic_id, doctor_id, issued_at);
create index bills_created_by_idx on public.bills (created_by);
create index bills_voided_by_idx on public.bills (voided_by) where voided_by is not null;

-- An issued bill is never edited (plan §15.2): it only goes void, once,
-- stamped with when and by whom.
create or replace function public.check_bill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'VOID' or new.status <> 'VOID'
     or (to_jsonb(new) - array['status', 'void_reason', 'voided_by', 'voided_at'])
        <> (to_jsonb(old) - array['status', 'void_reason', 'voided_by', 'voided_at']) then
    raise exception 'An issued bill is voided, never edited' using hint = 'VALIDATION_ERROR';
  end if;
  new.voided_at := now();
  new.voided_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.check_bill() from public, anon, authenticated;

create trigger check_bill before update on public.bills
for each row execute function public.check_bill();

-- A bill's lines (plan §15.2, §28.6): at most BILL_MAX_ITEMS, each its
-- quantity times its price. A price-list line keeps its own copy of the
-- entry's name — the price list may change, the bill does not.
create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  bill_id uuid not null,
  position smallint not null check (position between 1 and 50),
  -- The price-list entry it came from, and the treatment it is for (D285);
  -- neither for a line typed with its price (D284).
  service_id uuid,
  treatment_id uuid,
  description text not null check (public.is_clean_line(description, 100)),
  quantity integer not null check (quantity between 1 and 999),
  unit_price_paise integer not null check (unit_price_paise between 0 and 100000000),
  amount_paise integer not null check (amount_paise between 0 and 100000000),
  -- In order, and the bill's own index.
  unique (bill_id, position),
  foreign key (bill_id, clinic_id) references public.bills (id, clinic_id) on delete cascade,
  foreign key (service_id, clinic_id) references public.services (id, clinic_id),
  foreign key (treatment_id, clinic_id) references public.treatments (id, clinic_id),
  -- A treatment is billed through a price-list line (D285).
  constraint bill_items_treatment check (treatment_id is null or service_id is not null),
  constraint bill_items_amount check (amount_paise::bigint = quantity::bigint * unit_price_paise)
);

create index bill_items_clinic_id_service_id_idx on public.bill_items (clinic_id, service_id) where service_id is not null;
create index bill_items_clinic_id_treatment_id_idx
  on public.bill_items (clinic_id, treatment_id) where treatment_id is not null;

-- ------------------------------------------------------------
-- 2. When a visit is Billed (plan §15.6)
-- ------------------------------------------------------------

-- Whether a visit is settled by its bills: an issued bill of its own — Bill
-- now in the room, or at checkout — or its appointment's fee billed at
-- arrival, with no treatment worked on in it (a session recorded), so a
-- procedure after an arrival-paid consultation still reaches checkout.
create or replace function public.visit_billed(p_visit public.visits)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.bills as bill
     where bill.clinic_id = p_visit.clinic_id and bill.visit_id = p_visit.id and bill.status = 'ISSUED'
  )
  or (
    p_visit.appointment_id is not null
    and exists (
      select 1
        from public.bills as bill
       where bill.clinic_id = p_visit.clinic_id
         and bill.appointment_id = p_visit.appointment_id
         and bill.status = 'ISSUED'
    )
    and not exists (
      select 1
        from public.treatment_sessions as session
       where session.clinic_id = p_visit.clinic_id and session.visit_id = p_visit.id
    )
  );
$$;

revoke all on function public.visit_billed(public.visits) from public, anon, authenticated;

-- As 0022's, and one thing more keeps a visit Back to waiting would remove: a
-- bill issued for it in the room (Bill now), which names it for good (D197).
create or replace function public.visit_is_empty(p_visit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select not public.visit_recorded(visit)
           and not exists (
             select 1 from public.bills as bill where bill.clinic_id = visit.clinic_id and bill.visit_id = visit.id
           )
      from public.visits as visit
     where visit.id = p_visit_id
  ), true);
$$;

-- As 0018's: marks a held appointment in progress done, and closes its visit
-- — opening one first should it have none — now Billed when its bills settle
-- it, else To bill. The billing state is read in a statement of its own, so
-- a bill issued while this waited for the rows is seen. Hands back what
-- moved, the visit with its billing state, for the audit row.
create or replace function public.finish_appointment(p_appointment public.appointments)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed uuid;
  opened boolean := false;
  billing text;
begin
  update public.appointments set status = 'COMPLETED', completed_at = now() where id = p_appointment.id;
  update public.visits
     set status = 'COMPLETED', completed_at = now(), billing_status = 'TO_BILL'
   where appointment_id = p_appointment.id and status = 'OPEN'
  returning id into closed;
  if closed is null then
    insert into public.visits (
      clinic_id, patient_id, doctor_id, appointment_id, started_at, status, completed_at, billing_status
    )
    values (
      p_appointment.clinic_id, p_appointment.patient_id, p_appointment.doctor_id, p_appointment.id,
      coalesce(p_appointment.started_at, now()), 'COMPLETED', now(), 'TO_BILL'
    )
    returning id into closed;
    opened := true;
  end if;
  update public.visits as visit
     set billing_status = 'BILLED'
   where visit.id = closed and public.visit_billed(visit)
  returning visit.billing_status into billing;
  return jsonb_build_array(
    jsonb_build_object('entity', 'APPOINTMENT', 'id', p_appointment.id, 'from', 'IN_PROGRESS', 'to', 'COMPLETED'),
    jsonb_build_object(
      'entity', 'VISIT', 'id', closed, 'from', case when opened then null else 'OPEN' end, 'to', 'COMPLETED',
      'billing', coalesce(billing, 'TO_BILL')
    )
  );
end;
$$;

revoke all on function public.finish_appointment(public.appointments) from public, anon, authenticated;

-- As 0020's: Done for a visit started from a profile (D204), now Billed when
-- a bill of its own came first, else To bill. Twice changes nothing more.
-- Hands back its status before, and the billing state it closed with.
drop function public.finish_visit(uuid);

create or replace function public.finish_visit(p_visit_id uuid)
returns table (previously text, billing text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  found public.visits;
  closed_as text;
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
    update public.visits as visit
       set billing_status = 'BILLED'
     where visit.id = found.id and public.visit_billed(visit)
    returning visit.billing_status into closed_as;
    return query select found.status, coalesce(closed_as, 'TO_BILL');
    return;
  end if;
  return query select found.status, found.billing_status;
end;
$$;

revoke all on function public.finish_visit(uuid) from public, anon;
grant execute on function public.finish_visit(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. Issuing a bill (plan §15.2; D29, D283 – D287, D289)
-- ------------------------------------------------------------

-- A new bill: payments.create, while the clinic can write, for a patient the
-- caller sees and who is not archived. `p_bill` names the patient; the visit
-- it bills (open — Bill now — or done), or the appointment whose fee is
-- taken while they are here (arrived or in, D283), or neither — and then the
-- doctor picked, if any; the lines (`items`: service_id, treatment_id,
-- description, quantity, unit_price_paise); the discount, the subtotal and
-- the total as billing/totals.ts worked them out; and notes.
--
-- Each line is a price-list entry, still active, its name copied — and the
-- treatment of the patient's it is for, if any (D285) — or, with
-- payments.discount, a line typed with its price (D284). Without
-- payments.discount, each price is the entry's own, or on a Consultation
-- line the bill's doctor's fee (D26, D289), and the discount is nothing
-- (D29). The subtotal and total are worked out again here and must agree.
-- The number is the clinic's next of the financial year it is issued in.
-- A done visit it bills is Billed — from No charge too, its reason dropped
-- (D287); an open one is settled when it closes (finish_appointment). Once
-- per idempotency key. Hands back the bill, its number and total, whether
-- this call issued it, and the visit's move, for the audit row.
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
  moved jsonb;
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
    return jsonb_build_object(
      'bill_id', made.id, 'bill_number', made.bill_number, 'total_paise', made.total_paise,
      'created', false, 'visit', null
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

  if found_visit.status = 'COMPLETED' and found_visit.billing_status <> 'BILLED' then
    update public.visits
       set billing_status = 'BILLED', no_charge_reason = null, no_charge_note = null
     where id = found_visit.id;
    moved := jsonb_build_object('id', found_visit.id, 'from', found_visit.billing_status, 'to', 'BILLED');
  end if;
  return jsonb_build_object(
    'bill_id', made.id, 'bill_number', made.bill_number, 'total_paise', made.total_paise,
    'created', true, 'visit', moved
  );
end;
$$;

-- ------------------------------------------------------------
-- 4. Voiding a bill (plan §15.2, §15.6; D286)
-- ------------------------------------------------------------

-- A bill issued by mistake: payments.edit, while the clinic can write, for a
-- patient the caller sees and who is not archived, with a reason. It stays,
-- marked Void, and leaves the balance. Its visit — the one it billed, or the
-- one its arrival opened — goes back to To bill once nothing billed remains
-- for it. Twice changes nothing more. Hands back its status before and the
-- visit's move, for the audit row.
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
    return jsonb_build_object('previously', 'VOID', 'visit', null);
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
  return jsonb_build_object('previously', 'ISSUED', 'visit', moved);
end;
$$;

-- ------------------------------------------------------------
-- 5. No charge (plan §15.6)
-- ------------------------------------------------------------

-- A done visit waiting in To bill, settled free: payments.create, while the
-- clinic can write, for a patient the caller sees and who is not archived,
-- with a reason from NO_CHARGE_REASONS — and a note for Other (the visit's
-- CHECKs). Twice changes nothing more; one already Billed, or still open, is
-- refused. A bill issued for it later makes it Billed (D287). Hands back its
-- billing state before.
create or replace function public.mark_no_charge(p_visit_id uuid, p_reason text, p_note text)
returns table (previously text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  found public.visits;
begin
  if clinic is null or not public.has_permission('payments.create') then
    raise exception 'No charge needs payments.create' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  select * into found
    from public.visits as visit
   where visit.id = p_visit_id and visit.clinic_id = clinic
   for update;
  if found.id is null or not public.can_see_patient(found.patient_id) then
    raise exception 'No such visit' using hint = 'RECORD_NOT_FOUND';
  end if;
  if found.billing_status = 'NO_CHARGE' then
    return query select found.billing_status;
    return;
  end if;
  if found.billing_status is distinct from 'TO_BILL' then
    raise exception 'Only a visit waiting to be billed' using hint = 'VISIT_NOT_TO_BILL';
  end if;
  if exists (
    select 1 from public.patients as patient where patient.id = found.patient_id and patient.archived_at is not null
  ) then
    raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
  end if;
  if p_reason is null then
    raise exception 'No charge says why' using hint = 'VALIDATION_ERROR';
  end if;
  update public.visits
     set billing_status = 'NO_CHARGE', no_charge_reason = p_reason, no_charge_note = p_note
   where id = found.id;
  return query select found.billing_status;
end;
$$;

revoke all on function public.create_bill(jsonb, uuid) from public, anon;
revoke all on function public.void_bill(uuid, text) from public, anon;
revoke all on function public.mark_no_charge(uuid, text, text) from public, anon;
grant execute on function public.create_bill(jsonb, uuid) to authenticated;
grant execute on function public.void_bill(uuid, text) to authenticated;
grant execute on function public.mark_no_charge(uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- 6. Archiving a patient with a visit to bill (D288)
-- ------------------------------------------------------------

-- As 0024's, and one rule more: a patient is not archived while a visit of
-- theirs waits in To bill — billed or marked No charge first; the refusal
-- names the first one's day.
create or replace function public.check_patient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.clinic_today(new.clinic_id);
  born_given boolean := true;
  doctor_given boolean := true;
  upcoming timestamptz;
  open_treatment text;
  to_bill date;
begin
  if tg_op = 'UPDATE' then
    if old.archived_at is not null and new.archived_at is not null then
      raise exception 'An archived patient is read-only' using hint = 'PATIENT_ARCHIVED';
    end if;
    if old.archived_at is null and new.archived_at is not null then
      select appointment.scheduled_at into upcoming
        from public.appointments as appointment
       where appointment.clinic_id = new.clinic_id
         and appointment.patient_id = new.id
         and (
           (appointment.status in ('SCHEDULED', 'CONFIRMED', 'ARRIVED') and appointment.local_date >= today)
           or appointment.status = 'IN_PROGRESS'
         )
       order by appointment.scheduled_at
       limit 1;
      if upcoming is not null then
        raise exception 'Cancel or move their appointments first' using
          hint = 'PATIENT_HAS_APPOINTMENTS',
          detail = json_build_object('scheduledAt', upcoming)::text;
      end if;
      select treatment.name into open_treatment
        from public.treatments as treatment
       where treatment.clinic_id = new.clinic_id
         and treatment.patient_id = new.id
         and treatment.status in ('PLANNED', 'IN_PROGRESS', 'ON_HOLD')
       order by treatment.created_at
       limit 1;
      if open_treatment is not null then
        raise exception 'Complete or cancel their open treatments first' using
          hint = 'PATIENT_HAS_TREATMENTS',
          detail = json_build_object(
            'name', case when public.has_permission('visits.view') then open_treatment end
          )::text;
      end if;
      select visit.visit_date into to_bill
        from public.visits as visit
       where visit.clinic_id = new.clinic_id
         and visit.patient_id = new.id
         and visit.billing_status = 'TO_BILL'
       order by visit.visit_date
       limit 1;
      if to_bill is not null then
        raise exception 'Bill their visits or mark them No charge first' using
          hint = 'PATIENT_HAS_VISITS_TO_BILL',
          detail = json_build_object('visitDate', to_bill)::text;
      end if;
    end if;
    if new.archived_at is distinct from old.archived_at then
      new.archived_at := case when new.archived_at is not null then now() end;
      new.archived_by := case when new.archived_at is not null then auth.uid() end;
    end if;
    born_given := new.date_of_birth is distinct from old.date_of_birth;
    doctor_given := new.assigned_doctor_id is distinct from old.assigned_doctor_id;
  end if;

  if born_given and (new.date_of_birth > today or new.date_of_birth < (today - interval '120 years')::date) then
    raise exception 'Born today or before, at most 120 years ago' using hint = 'PATIENT_BIRTH_DATE_INVALID';
  end if;

  if doctor_given and new.assigned_doctor_id is not null and not exists (
    select 1
      from public.doctors as doctor
      join public.clinic_members as member on member.id = doctor.member_id
     where doctor.id = new.assigned_doctor_id and doctor.active and member.status = 'ACTIVE'
  ) then
    raise exception 'Not one of the clinic''s active doctors' using hint = 'DOCTOR_INACTIVE';
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Policies (plan §27.4)
-- ------------------------------------------------------------

alter table public.bill_counters enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;

-- payments.view, within the doctor scope (D3), worked out once a statement
-- (plan §37.1).
create policy bills_select on public.bills
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('payments.view'))
  and ((select public.sees_every_patient()) or patient_id in (select public.doctor_patient_ids()))
);

-- A bill's lines, where the bill itself can be read.
create policy bill_items_select on public.bill_items
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and exists (select 1 from public.bills as bill where bill.id = bill_id)
);

-- Issued and voided only through the functions above; never deleted. The
-- counters are the functions' alone.
grant select on public.bills, public.bill_items to authenticated;
