-- ============================================================
-- 0034 · Home and reports (plan §17, §18, §28.7; tracker R10.1, D49, D53,
-- D345 – D349).
--
-- Every figure is defined once, here, in the clinic's timezone, and Home
-- and the reports read the same definitions:
-- 1. The visits done by day: the index the figures of the visits read.
-- 2. The definitions, read by the functions below only:
--    money_by_day — what was collected (payments less refunds), billed and
--    spent each day, and the net, voided and archived ones left out of
--    their own day (D345); visits_done — the patients seen, each once, and
--    the visits; appointment_counts — the appointments, cancelled ones left
--    out (D346), and how many stand in each status; clinic_outstanding —
--    what the patients who owe owe.
-- 3. dashboard_summary: Home's sections, each only with its permission
--    (§17): the day's appointments and patients seen — a doctor's own
--    (D347) — what was collected and is owed, the queue, To bill, the
--    follow-ups, tomorrow, who owes most, the last payments and expenses;
--    and, until the first patient, the getting-started steps (D348).
-- 4. report_daily: a day's figures and its day-end collection summary — by
--    who took the money and how, and the day's voids (D49).
-- 5. report_monthly: a month's patients, appointments and money, each day's
--    collected and spent for the chart, and each doctor's patients seen,
--    visits, billed and paid to date (D53).
--
-- Each is read as the clinic's member who asks — security definer, the
-- permission checked inside, the caller's own clinic — so reception reads
-- Home's To bill without the visits' policies, and reports.view reads the
-- figures without payments.view. They write nothing, so a read-only clinic
-- reads them as ever.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The visits done by day (plan §37.1)
-- ------------------------------------------------------------

-- A day's or a month's visits done, every doctor's (§17, §18); one doctor's
-- are read by (clinic_id, doctor_id, visit_date desc), and a patient's
-- earlier visits by (clinic_id, patient_id, visit_date desc).
create index visits_clinic_id_completed_idx on public.visits (clinic_id, visit_date)
  where status = 'COMPLETED';

-- ------------------------------------------------------------
-- 2. The definitions (plan §18)
-- ------------------------------------------------------------

-- The first instant of the clinic's day `p_day`, in its timezone.
create or replace function public.clinic_day_start(p_clinic_id uuid, p_day date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select p_day::timestamp at time zone clinic.timezone from public.clinics as clinic where clinic.id = p_clinic_id;
$$;

-- Each day from `p_from` to `p_to`: collected — the payments less the
-- refunds paid that day; billed — the bills issued that day; spent — the
-- expenses of that day; and the net, collected less spent (§18). A voided
-- payment or bill, or an archived expense, leaves its own day (D331, D345).
-- Served by the indexes on (clinic_id, paid_at desc), (clinic_id, issued_at
-- desc) and the expenses in use by day.
create or replace function public.money_by_day(p_clinic_id uuid, p_from date, p_to date)
returns table (day date, collected_paise bigint, billed_paise bigint, expenses_paise bigint, net_paise bigint)
language sql
stable
set search_path = ''
as $$
  with bounds as (
    select public.clinic_day_start(p_clinic_id, p_from) as starts,
           public.clinic_day_start(p_clinic_id, p_to + 1) as ends
  ),
  collected as (
    select payment.paid_on as day,
           sum(case when payment.kind = 'REFUND' then -payment.amount_paise else payment.amount_paise end) as paise
      from public.payments as payment
      cross join bounds
     where payment.clinic_id = p_clinic_id
       and payment.paid_at >= bounds.starts
       and payment.paid_at < bounds.ends
       and payment.status = 'RECORDED'
     group by payment.paid_on
  ),
  billed as (
    select bill.issued_on as day, sum(bill.total_paise) as paise
      from public.bills as bill
      cross join bounds
     where bill.clinic_id = p_clinic_id
       and bill.issued_at >= bounds.starts
       and bill.issued_at < bounds.ends
       and bill.status = 'ISSUED'
     group by bill.issued_on
  ),
  spent as (
    select expense.expense_date as day, sum(expense.amount_paise) as paise
      from public.expenses as expense
     where expense.clinic_id = p_clinic_id
       and expense.archived_at is null
       and expense.expense_date between p_from and p_to
     group by expense.expense_date
  )
  select days.day,
         coalesce(collected.paise, 0)::bigint,
         coalesce(billed.paise, 0)::bigint,
         coalesce(spent.paise, 0)::bigint,
         (coalesce(collected.paise, 0) - coalesce(spent.paise, 0))::bigint
    from (select p_from + step as day from generate_series(0, p_to - p_from) as step) as days
    left join collected on collected.day = days.day
    left join billed on billed.day = days.day
    left join spent on spent.day = days.day
   order by days.day;
$$;

-- From `p_from` to `p_to`, the patients seen — each once, with a visit done
-- (§18) — and the visits done: those of the doctors in `p_doctors`, or every
-- doctor's when it is null.
create or replace function public.visits_done(p_clinic_id uuid, p_from date, p_to date, p_doctors uuid[])
returns table (patients bigint, visits bigint)
language sql
stable
set search_path = ''
as $$
  select count(distinct visit.patient_id), count(*)
    from public.visits as visit
   where visit.clinic_id = p_clinic_id
     and visit.status = 'COMPLETED'
     and visit.visit_date between p_from and p_to
     and (p_doctors is null or visit.doctor_id = any (p_doctors));
$$;

-- From `p_from` to `p_to`, the appointments — booked and walk-ins, the
-- cancelled ones left out (D346) — and how many stand in each status, as
-- {"COMPLETED": 4, …}, for the statuses that have any: the doctors in
-- `p_doctors`, or every doctor's when it is null.
create or replace function public.appointment_counts(p_clinic_id uuid, p_from date, p_to date, p_doctors uuid[])
returns table (appointments bigint, statuses jsonb)
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(counted.total) filter (where counted.status <> 'CANCELLED'), 0)::bigint,
         coalesce(jsonb_object_agg(counted.status, counted.total), '{}'::jsonb)
    from (
      select appointment.status, count(*) as total
        from public.appointments as appointment
       where appointment.clinic_id = p_clinic_id
         and appointment.local_date between p_from and p_to
         and (p_doctors is null or appointment.doctor_id = any (p_doctors))
       group by appointment.status
    ) as counted;
$$;

-- What the patients who owe owe, all told: each one's balance due, an
-- advance held by another taking nothing off it (§17, D4). Read from the
-- index of those who owe.
create or replace function public.clinic_outstanding(p_clinic_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(balance.balance_paise), 0)::bigint
    from public.patient_balances as balance
   where balance.clinic_id = p_clinic_id and balance.balance_paise > 0;
$$;

-- Read by the functions below only.
revoke all on function public.clinic_day_start(uuid, date) from public, anon, authenticated;
revoke all on function public.money_by_day(uuid, date, date) from public, anon, authenticated;
revoke all on function public.visits_done(uuid, date, date, uuid[]) from public, anon, authenticated;
revoke all on function public.appointment_counts(uuid, date, date, uuid[]) from public, anon, authenticated;
revoke all on function public.clinic_outstanding(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3. Home (plan §17; D347 – D349)
-- ------------------------------------------------------------

-- Home's sections for the caller, each only with its permission, else null:
-- `day` (appointments.view) — today's appointments and patients seen, a
-- doctor's own (D347); `money` (reports.view) — collected today and
-- outstanding, the clinic's; `queue` (appointments.view) — each doctor with
-- anyone in or waiting today, a doctor only themselves: how many are in,
-- how many wait, and the next `p_queue_limit` waiting in the queue's order;
-- `to_bill` (payments.view) — how many visits wait, the oldest
-- `p_list_limit`; `follow_ups` (appointments.view or visits.view, D267) —
-- Today, Overdue and Lapsed counted, Today's first `p_list_limit` (D349);
-- `upcoming` (appointments.view) — tomorrow's appointments, cancelled ones
-- left out, counted, the first `p_list_limit`; `owing`, `payments`
-- (payments.view) — the patients owing most, the last payments and refunds
-- standing; `expenses` (expenses.view) — the last ones. Patients within the
-- doctor scope. And `getting_started` until the clinic's first patient
-- (D348): whether any price is above nothing and whether anyone else is on
-- the team, invited or joined.
create or replace function public.dashboard_summary(p_list_limit integer, p_queue_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  today date;
  sees_all boolean := public.sees_every_patient();
  -- A doctor's own day (D347); every doctor's for everyone else.
  doctors uuid[];
  lists integer := greatest(coalesce(p_list_limit, 1), 1);
  queued integer := greatest(coalesce(p_queue_limit, 1), 1);
  sees_appointments boolean := public.has_permission('appointments.view');
  sees_payments boolean := public.has_permission('payments.view');
begin
  if clinic is null then
    raise exception 'Home is a clinic member''s' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  today := public.clinic_today(clinic);
  doctors := case when sees_all then null else array[public.current_doctor_id()] end;

  return jsonb_build_object(
    'today', today,
    'day', case when sees_appointments then (
      select jsonb_build_object('appointments', booked.appointments, 'patients_seen', seen.patients)
        from public.appointment_counts(clinic, today, today, doctors) as booked
        cross join public.visits_done(clinic, today, today, doctors) as seen
    ) end,
    'money', case when public.has_permission('reports.view') then (
      select jsonb_build_object(
               'collected_paise', money.collected_paise,
               'outstanding_paise', public.clinic_outstanding(clinic)
             )
        from public.money_by_day(clinic, today, today) as money
    ) end,
    'queue', case when sees_appointments then (
      with present as (
        select appointment.id, appointment.doctor_id, appointment.patient_id, appointment.status,
               appointment.token_number, appointment.arrived_at, appointment.urgent_at
          from public.appointments as appointment
         where appointment.clinic_id = clinic
           and appointment.local_date = today
           and appointment.status in ('ARRIVED', 'IN_PROGRESS')
           and (doctors is null or appointment.doctor_id = any (doctors))
      )
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'doctor_id', counted.doctor_id,
                 'doctor_name', profile.full_name,
                 'with_doctor', counted.with_doctor,
                 'waiting', counted.waiting,
                 'next', next.patients
               )
               order by profile.full_name, counted.doctor_id
             ), '[]'::jsonb)
        from (
          select present.doctor_id,
                 count(*) filter (where present.status = 'IN_PROGRESS') as with_doctor,
                 count(*) filter (where present.status = 'ARRIVED') as waiting
            from present
           group by present.doctor_id
        ) as counted
        join public.doctors as doctor on doctor.id = counted.doctor_id
        join public.clinic_members as member on member.id = doctor.member_id
        join public.profiles as profile on profile.id = member.user_id
        cross join lateral (
          select coalesce(jsonb_agg(
                   jsonb_build_object(
                     'appointment_id', waiting.id,
                     'patient_id', patient.id,
                     'patient_name', patient.full_name,
                     'patient_number', patient.patient_number,
                     'token_number', waiting.token_number,
                     'urgent', waiting.urgent_at is not null
                   )
                   order by waiting.token_number nulls last, waiting.arrived_at
                 ), '[]'::jsonb) as patients
            from (
              select present.id, present.patient_id, present.token_number, present.arrived_at, present.urgent_at
                from present
               where present.doctor_id = counted.doctor_id and present.status = 'ARRIVED'
               order by present.token_number nulls last, present.arrived_at
               limit queued
            ) as waiting
            join public.patients as patient on patient.id = waiting.patient_id
        ) as next
    ) end,
    'to_bill', case when sees_payments then jsonb_build_object(
      'count', public.to_bill_count(null),
      'visits', (
        select coalesce(jsonb_agg(
                 jsonb_build_object(
                   'visit_id', waiting.visit_id,
                   'completed_at', waiting.completed_at,
                   'patient_id', waiting.patient_id,
                   'patient_name', waiting.patient_name,
                   'patient_number', waiting.patient_number,
                   'doctor_name', waiting.doctor_name,
                   'token_number', waiting.token_number
                 )
                 order by waiting.place
               ), '[]'::jsonb)
          from public.to_bill_visits(null, 0, lists) with ordinality as waiting (
            visit_id, visit_date, completed_at, patient_id, patient_name, patient_number, patient_archived,
            doctor_id, doctor_name, appointment_id, token_number, treatments, fee_paid, place
          )
      )
    ) end,
    'follow_ups', case when public.works_follow_ups() then (
      select jsonb_build_object(
               'today', count(*) filter (where due.tab = 'TODAY'),
               'overdue', count(*) filter (where due.tab = 'OVERDUE'),
               'lapsed', count(*) filter (where due.tab = 'LAPSED'),
               'due', coalesce(jsonb_agg(
                 jsonb_build_object(
                   'kind', due.kind,
                   'treatment_id', due.treatment_id,
                   'visit_id', due.visit_id,
                   'patient_id', due.patient_id,
                   'patient_name', due.patient_name,
                   'patient_number', due.patient_number,
                   'title', due.title,
                   'doctor_name', due.doctor_name,
                   'due_on', due.due_on
                 )
                 order by due.place
               ) filter (where due.tab = 'TODAY' and due.place <= lists), '[]'::jsonb)
             )
        from (
          -- In the follow-ups' own order (follow_up_items).
          select row.*,
                 row_number() over (
                   partition by row.tab
                   order by row.due_on, row.patient_name, coalesce(row.treatment_id, row.visit_id)
                 ) as place
            from public.follow_up_rows() as row
           where row.tab in ('TODAY', 'OVERDUE', 'LAPSED')
        ) as due
    ) end,
    'upcoming', case when sees_appointments then (
      with tomorrow as (
        select appointment.id, appointment.patient_id, appointment.doctor_id, appointment.appointment_type_id,
               appointment.scheduled_at, appointment.status
          from public.appointments as appointment
         where appointment.clinic_id = clinic
           and appointment.local_date = today + 1
           and appointment.status <> 'CANCELLED'
           and (doctors is null or appointment.doctor_id = any (doctors))
      )
      select jsonb_build_object(
               'count', (select count(*) from tomorrow),
               'appointments', coalesce(jsonb_agg(
                 jsonb_build_object(
                   'appointment_id', soonest.id,
                   'scheduled_at', soonest.scheduled_at,
                   'status', soonest.status,
                   'patient_id', patient.id,
                   'patient_name', patient.full_name,
                   'patient_number', patient.patient_number,
                   'doctor_name', profile.full_name,
                   'type_name', kind.name
                 )
                 order by soonest.scheduled_at, soonest.id
               ), '[]'::jsonb)
             )
        from (select * from tomorrow order by tomorrow.scheduled_at, tomorrow.id limit lists) as soonest
        join public.patients as patient on patient.id = soonest.patient_id
        join public.appointment_types as kind on kind.id = soonest.appointment_type_id
        join public.doctors as doctor on doctor.id = soonest.doctor_id
        join public.clinic_members as member on member.id = doctor.member_id
        join public.profiles as profile on profile.id = member.user_id
    ) end,
    'owing', case when sees_payments then (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'patient_id', patient.id,
                 'patient_name', patient.full_name,
                 'patient_number', patient.patient_number,
                 'balance_paise', owed.balance_paise
               )
               order by owed.balance_paise desc, owed.patient_id
             ), '[]'::jsonb)
        from (
          select balance.patient_id, balance.balance_paise
            from public.patient_balances as balance
           where balance.clinic_id = clinic
             and balance.balance_paise > 0
             and (sees_all or balance.patient_id in (select public.doctor_patient_ids()))
           order by balance.balance_paise desc, balance.patient_id
           limit lists
        ) as owed
        join public.patients as patient on patient.id = owed.patient_id
    ) end,
    'payments', case when sees_payments then (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'payment_id', recent.id,
                 'kind', recent.kind,
                 'amount_paise', recent.amount_paise,
                 'method', recent.method,
                 'paid_at', recent.paid_at,
                 'patient_id', patient.id,
                 'patient_name', patient.full_name,
                 'patient_number', patient.patient_number
               )
               order by recent.paid_at desc, recent.id desc
             ), '[]'::jsonb)
        from (
          select payment.id, payment.patient_id, payment.kind, payment.amount_paise, payment.method, payment.paid_at
            from public.payments as payment
           where payment.clinic_id = clinic
             and payment.status = 'RECORDED'
             and (sees_all or payment.patient_id in (select public.doctor_patient_ids()))
           order by payment.paid_at desc, payment.id desc
           limit lists
        ) as recent
        join public.patients as patient on patient.id = recent.patient_id
    ) end,
    'expenses', case when public.has_permission('expenses.view') then (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'expense_id', recent.id,
                 'category_name', category.name,
                 'description', recent.description,
                 'amount_paise', recent.amount_paise,
                 'day', recent.expense_date,
                 'method', recent.payment_method
               )
               order by recent.expense_date desc, recent.created_at desc
             ), '[]'::jsonb)
        from (
          select expense.id, expense.category_id, expense.description, expense.amount_paise, expense.expense_date,
                 expense.payment_method, expense.created_at
            from public.expenses as expense
           where expense.clinic_id = clinic and expense.archived_at is null
           order by expense.expense_date desc, expense.created_at desc
           limit lists
        ) as recent
        join public.expense_categories as category on category.id = recent.category_id
    ) end,
    'getting_started', case when not exists (
      select 1 from public.patients as patient where patient.clinic_id = clinic
    ) then jsonb_build_object(
      'prices', exists (
        select 1
          from public.services as service
         where service.clinic_id = clinic and service.active and service.price_paise > 0
      ) or exists (
        select 1
          from public.doctors as doctor
         where doctor.clinic_id = clinic and doctor.active and doctor.consultation_fee_paise > 0
      ),
      'team', exists (
        select 1
          from public.clinic_members as member
         where member.clinic_id = clinic and member.role <> 'OWNER' and member.status in ('INVITED', 'ACTIVE')
      )
    ) end
  );
end;
$$;

revoke all on function public.dashboard_summary(integer, integer) from public, anon;
grant execute on function public.dashboard_summary(integer, integer) to authenticated;

-- ------------------------------------------------------------
-- 4. A day's report (plan §18; D49, D345, D346)
-- ------------------------------------------------------------

-- `p_day`'s figures (reports.view), today or a day before: the patients
-- seen, the appointments and how many stand in each status, collected,
-- billed, spent and the net — and the day-end collection summary (D49):
-- the payments and refunds standing, by who took or handed back each and
-- how — what each person at the desk hands over — and the day's payments
-- and refunds voided since. It locks nothing.
create or replace function public.report_daily(p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  starts timestamptz;
  ends timestamptz;
begin
  if clinic is null or not public.has_permission('reports.view') then
    raise exception 'Reports need reports.view' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  if p_day is null or p_day > public.clinic_today(clinic) then
    raise exception 'A report is of today or a day before' using hint = 'VALIDATION_ERROR';
  end if;
  starts := public.clinic_day_start(clinic, p_day);
  ends := public.clinic_day_start(clinic, p_day + 1);

  return (
    select jsonb_build_object(
             'day', p_day,
             'patients_seen', seen.patients,
             'appointments', booked.appointments,
             'statuses', booked.statuses,
             'collected_paise', money.collected_paise,
             'billed_paise', money.billed_paise,
             'expenses_paise', money.expenses_paise,
             'net_paise', money.net_paise,
             'collections', (
               select coalesce(jsonb_agg(
                        jsonb_build_object(
                          'received_by', taken.received_by,
                          'receiver_name', profile.full_name,
                          'method', taken.method,
                          'payments', taken.payments,
                          'received_paise', taken.received_paise,
                          'refunds', taken.refunds,
                          'refunded_paise', taken.refunded_paise
                        )
                        order by profile.full_name nulls last, taken.received_by, taken.method
                      ), '[]'::jsonb)
                 from (
                   select payment.received_by,
                          payment.method,
                          count(*) filter (where payment.kind = 'PAYMENT') as payments,
                          coalesce(sum(payment.amount_paise) filter (where payment.kind = 'PAYMENT'), 0) as received_paise,
                          count(*) filter (where payment.kind = 'REFUND') as refunds,
                          coalesce(sum(payment.amount_paise) filter (where payment.kind = 'REFUND'), 0) as refunded_paise
                     from public.payments as payment
                    where payment.clinic_id = clinic
                      and payment.paid_at >= starts
                      and payment.paid_at < ends
                      and payment.status = 'RECORDED'
                    group by payment.received_by, payment.method
                 ) as taken
                 left join public.profiles as profile on profile.id = taken.received_by
             ),
             'voided', (
               select jsonb_build_object(
                        'payments', count(*) filter (where payment.kind = 'PAYMENT'),
                        'payment_paise', coalesce(sum(payment.amount_paise) filter (where payment.kind = 'PAYMENT'), 0),
                        'refunds', count(*) filter (where payment.kind = 'REFUND'),
                        'refund_paise', coalesce(sum(payment.amount_paise) filter (where payment.kind = 'REFUND'), 0)
                      )
                 from public.payments as payment
                where payment.clinic_id = clinic
                  and payment.paid_at >= starts
                  and payment.paid_at < ends
                  and payment.status = 'VOID'
             )
           )
      from public.money_by_day(clinic, p_day, p_day) as money
      cross join public.visits_done(clinic, p_day, p_day, null) as seen
      cross join public.appointment_counts(clinic, p_day, p_day, null) as booked
  );
end;
$$;

revoke all on function public.report_daily(date) from public, anon;
grant execute on function public.report_daily(date) to authenticated;

-- ------------------------------------------------------------
-- 5. A month's report (plan §18; D53)
-- ------------------------------------------------------------

-- The figures (reports.view) of the month holding `p_month`, this month or
-- one before: the patients seen — each once — those whose first visit done
-- ever is in the month (new) and those with one before it (returning); the
-- appointments and how many stand in each status; collected, billed, spent,
-- the net, and what is owed today; each day's collected and spent, for the
-- chart; and by doctor (D53) — each doctor's patients seen and visits, the
-- bills issued in the month with them and how much of those is paid to date
-- (bill_settlement), and the bills with no doctor as one line of their own.
-- The settlement is worked out for the patients billed in the month only.
create or replace function public.report_monthly(p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  first_day date;
  last_day date;
  starts timestamptz;
  ends timestamptz;
  billed uuid[];
begin
  if clinic is null or not public.has_permission('reports.view') then
    raise exception 'Reports need reports.view' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  first_day := date_trunc('month', p_month::timestamp)::date;
  if p_month is null or first_day > public.clinic_today(clinic) then
    raise exception 'A report is of this month or one before' using hint = 'VALIDATION_ERROR';
  end if;
  last_day := (first_day + interval '1 month')::date - 1;
  starts := public.clinic_day_start(clinic, first_day);
  ends := public.clinic_day_start(clinic, last_day + 1);
  select array_agg(distinct bill.patient_id) into billed
    from public.bills as bill
   where bill.clinic_id = clinic and bill.issued_at >= starts and bill.issued_at < ends and bill.status = 'ISSUED';

  return (
    select jsonb_build_object(
             'month', first_day,
             'patients_seen', patients.seen,
             'new_patients', patients.new_patients,
             'returning_patients', patients.returning_patients,
             'appointments', booked.appointments,
             'statuses', booked.statuses,
             'collected_paise', money.collected_paise,
             'billed_paise', money.billed_paise,
             'expenses_paise', money.expenses_paise,
             'net_paise', money.net_paise,
             'outstanding_paise', public.clinic_outstanding(clinic),
             'days', money.days,
             'doctors', (
               with seen as (
                 select visit.doctor_id, count(distinct visit.patient_id) as patients, count(*) as visits
                   from public.visits as visit
                  where visit.clinic_id = clinic
                    and visit.status = 'COMPLETED'
                    and visit.visit_date between first_day and last_day
                  group by visit.doctor_id
               ),
               issued as (
                 select bill.doctor_id, sum(bill.total_paise) as billed_paise, sum(settled.paid_paise) as paid_paise
                   from public.bills as bill
                   join (
                     select settlement.bill_id, settlement.paid_paise
                       from public.bill_settlement as settlement
                      where settlement.patient_id = any (billed)
                   ) as settled on settled.bill_id = bill.id
                  where bill.clinic_id = clinic
                    and bill.issued_at >= starts
                    and bill.issued_at < ends
                    and bill.status = 'ISSUED'
                  group by bill.doctor_id
               )
               select coalesce(jsonb_agg(
                        jsonb_build_object(
                          'doctor_id', line.doctor_id,
                          'doctor_name', profile.full_name,
                          'patients_seen', line.patients,
                          'visits', line.visits,
                          'billed_paise', line.billed_paise,
                          'paid_paise', line.paid_paise
                        )
                        order by line.doctor_id is null, profile.full_name, line.doctor_id
                      ), '[]'::jsonb)
                 from (
                   select coalesce(seen.doctor_id, issued.doctor_id) as doctor_id,
                          coalesce(seen.patients, 0) as patients,
                          coalesce(seen.visits, 0) as visits,
                          coalesce(issued.billed_paise, 0) as billed_paise,
                          coalesce(issued.paid_paise, 0) as paid_paise
                     from seen
                     full join issued on issued.doctor_id = seen.doctor_id
                 ) as line
                 left join public.doctors as doctor on doctor.id = line.doctor_id
                 left join public.clinic_members as member on member.id = doctor.member_id
                 left join public.profiles as profile on profile.id = member.user_id
             )
           )
      from (
        select sum(daily.collected_paise)::bigint as collected_paise,
               sum(daily.billed_paise)::bigint as billed_paise,
               sum(daily.expenses_paise)::bigint as expenses_paise,
               sum(daily.net_paise)::bigint as net_paise,
               jsonb_agg(
                 jsonb_build_object(
                   'day', daily.day,
                   'collected_paise', daily.collected_paise,
                   'expenses_paise', daily.expenses_paise
                 )
                 order by daily.day
               ) as days
          from public.money_by_day(clinic, first_day, last_day) as daily
      ) as money
      cross join public.appointment_counts(clinic, first_day, last_day, null) as booked
      cross join (
        select count(*) as seen,
               count(*) filter (where not seen.earlier) as new_patients,
               count(*) filter (where seen.earlier) as returning_patients
          from (
            select exists (
                     select 1
                       from public.visits as before
                      where before.clinic_id = clinic
                        and before.patient_id = in_month.patient_id
                        and before.status = 'COMPLETED'
                        and before.visit_date < first_day
                   ) as earlier
              from (
                select distinct visit.patient_id
                  from public.visits as visit
                 where visit.clinic_id = clinic
                   and visit.status = 'COMPLETED'
                   and visit.visit_date between first_day and last_day
              ) as in_month
          ) as seen
      ) as patients
  );
end;
$$;

revoke all on function public.report_monthly(date) from public, anon;
grant execute on function public.report_monthly(date) to authenticated;
