-- ============================================================
-- 0005 · Subscriptions (plan §7; tracker R1.5).
--
-- 1. `clinic_subscriptions`: one row per clinic, its plan and the last day
--    of access (`valid_until`, inclusive, in the clinic's timezone).
-- 2. `subscription_payments`: every extension the admin records, with the
--    validity it moved from and to; payments happen outside the app.
--    `receipt_counters` numbers the receipts, platform-wide, per financial
--    year (R/2026-27/0001, D58).
-- 3. `trial_claims`: every owner mobile that has started a trial, as an HMAC
--    of the number (never the number), outliving the clinic (D42).
-- 4. The state, derived and never stored (plan §7.2):
--    `subscription_state_for()` is the rule — src/features/subscription/
--    state.ts's subscriptionState() is the same rule, kept equal by a test —
--    and `subscription_state(clinic)` applies it with the clinic's today and
--    the live settings.
-- 5. Read-only (plan §7.3): `clinic_can_write()` for policies and
--    `require_clinic_write()` for write functions, which refuses with
--    CLINIC_PLAN_EXPIRED.
-- 6. `extend_clinic_subscription()`: the admin's Extend plan (plan §7.4).
-- ============================================================

-- ------------------------------------------------------------
-- Shared: the clinic's day, and the financial year a day falls in
-- ------------------------------------------------------------

-- April to March, as src/lib/dates/calendar.ts's financialYear(): "2026-27".
create or replace function public.financial_year(day date)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when extract(month from day) >= 4
      then extract(year from day)::integer::text || '-' || lpad(((extract(year from day)::integer + 1) % 100)::text, 2, '0')
    else (extract(year from day)::integer - 1)::text || '-' || lpad((extract(year from day)::integer % 100)::text, 2, '0')
  end;
$$;

-- Today, in the clinic's own timezone (AGENTS.md §15).
create or replace function public.clinic_today(p_clinic_id uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone clinic.timezone)::date from public.clinics as clinic where clinic.id = p_clinic_id;
$$;

revoke all on function public.financial_year(date) from public, anon;
revoke all on function public.clinic_today(uuid) from public, anon, authenticated;
grant execute on function public.financial_year(date) to authenticated;

-- ------------------------------------------------------------
-- 1. The subscription
-- ------------------------------------------------------------

create table public.clinic_subscriptions (
  clinic_id uuid primary key references public.clinics (id) on delete cascade,
  plan text not null check (plan in ('TRIAL', 'MONTHLY', 'YEARLY')),
  valid_until date not null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_clinic_subscriptions_updated_at
before update on public.clinic_subscriptions
for each row
execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. Payments and receipts
-- ------------------------------------------------------------

create table public.receipt_counters (
  financial_year text primary key check (financial_year ~ '^[0-9]{4}-[0-9]{2}$'),
  last_number integer not null check (last_number >= 1)
);

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  -- MONTHLY and YEARLY add a period; CUSTOM sets the date by hand (plan §7.4).
  plan text not null check (plan in ('MONTHLY', 'YEARLY', 'CUSTOM')),
  amount_paise integer not null check (amount_paise between 0 and 100000000),
  method text check (method in ('CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER')),
  reference text check (public.is_clean_line(reference, 100)),
  paid_on date,
  valid_from date not null,
  valid_until date not null,
  reason text check (public.is_clean_line(reason, 200)),
  recorded_by uuid references public.profiles (id) on delete set null,
  -- Only money received has a receipt (D58).
  receipt_number text unique check (receipt_number ~ '^R/[0-9]{4}-[0-9]{2}/[0-9]{4,}$'),
  created_at timestamptz not null default now(),
  -- A date set by hand says why (plan §7.4).
  constraint subscription_payments_custom_reason check (plan <> 'CUSTOM' or reason is not null),
  -- Money received says how and when, and has its receipt.
  constraint subscription_payments_paid check (amount_paise = 0 or (method is not null and paid_on is not null)),
  constraint subscription_payments_receipt check ((amount_paise > 0) = (receipt_number is not null))
);

create index subscription_payments_clinic_id_idx on public.subscription_payments (clinic_id, created_at desc);

-- ------------------------------------------------------------
-- 3. Trial claims (D42)
-- ------------------------------------------------------------

create table public.trial_claims (
  -- HMAC-SHA256 of the owner's E.164 mobile, keyed by TRIAL_CLAIM_SECRET on
  -- the server: the number itself is never stored (plan §27.6).
  mobile_hmac text primary key check (mobile_hmac ~ '^[0-9a-f]{64}$'),
  first_claimed_at timestamptz not null default now(),
  -- No foreign key: the claim outlives the clinic it was for (plan §7.6).
  last_clinic_id uuid
);

-- ------------------------------------------------------------
-- 4. The state (plan §7.2)
-- ------------------------------------------------------------

-- The rule alone, for any dates and settings.
create or replace function public.subscription_state_for(
  p_valid_until date,
  p_today date,
  p_warning_days integer,
  p_grace_days integer
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_today <= p_valid_until - p_warning_days then 'ACTIVE'
    when p_today <= p_valid_until then 'EXPIRING'
    when p_today <= p_valid_until + p_grace_days then 'GRACE'
    else 'READ_ONLY'
  end;
$$;

-- A clinic's state now, with the live settings. A clinic with no subscription
-- (which registration never leaves) can write nothing.
create or replace function public.subscription_state(p_clinic_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select public.subscription_state_for(
        subscription.valid_until,
        (now() at time zone clinic.timezone)::date,
        settings.expiry_warning_days,
        settings.grace_days
      )
      from public.clinic_subscriptions as subscription
      join public.clinics as clinic on clinic.id = subscription.clinic_id
      cross join public.platform_settings as settings
      where subscription.clinic_id = p_clinic_id
    ),
    'READ_ONLY'
  );
$$;

revoke all on function public.subscription_state_for(date, date, integer, integer) from public, anon, authenticated;
revoke all on function public.subscription_state(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 5. Read-only (plan §7.3)
-- ------------------------------------------------------------

-- Whether the caller's clinic may write: false in READ_ONLY, and false for
-- anyone with no active membership. Every write policy calls it.
create or replace function public.clinic_can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.subscription_state(public.current_clinic_id()) <> 'READ_ONLY';
$$;

-- What a write function calls first: refuses with CLINIC_PLAN_EXPIRED.
create or replace function public.require_clinic_write(p_clinic_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.subscription_state(p_clinic_id) = 'READ_ONLY' then
    raise exception 'The clinic is view-only until its plan is renewed' using hint = 'CLINIC_PLAN_EXPIRED';
  end if;
end;
$$;

revoke all on function public.clinic_can_write() from public, anon;
revoke all on function public.require_clinic_write(uuid) from public, anon, authenticated;
grant execute on function public.clinic_can_write() to authenticated;

-- ------------------------------------------------------------
-- Who reads what: the owner reads the clinic's plan and its payments (the
-- Plan screen is the owner's, plan §7.5). Nobody signed in writes any of it,
-- and nobody but the server reads the counters or the claims.
-- ------------------------------------------------------------

alter table public.clinic_subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.receipt_counters enable row level security;
alter table public.trial_claims enable row level security;

create policy clinic_subscriptions_select_owner
on public.clinic_subscriptions
for select
to authenticated
using (clinic_id = (select public.current_clinic_id()) and (select public.is_clinic_owner()));

create policy subscription_payments_select_owner
on public.subscription_payments
for select
to authenticated
using (clinic_id = (select public.current_clinic_id()) and (select public.is_clinic_owner()));

grant select on public.clinic_subscriptions, public.subscription_payments to authenticated;
revoke all on public.receipt_counters, public.trial_claims from public, anon, authenticated;

-- ------------------------------------------------------------
-- 6. extend_clinic_subscription (plan §7.4)
--
-- MONTHLY and YEARLY add a calendar month or twelve to the later of the plan's
-- last day and yesterday, so paying early never loses a day and paying late
-- starts from today. CUSTOM sets the date given, for a reason. One
-- transaction: the payment row (and its receipt number when money was
-- received), the new validity and plan, and a platform audit row. Called with
-- the DEV's own token, so the database checks the role itself.
-- ------------------------------------------------------------

create or replace function public.extend_clinic_subscription(
  p_clinic_id uuid,
  p_kind text,
  p_amount_paise integer,
  p_method text,
  p_reference text,
  p_paid_on date,
  p_valid_until date,
  p_reason text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription public.clinic_subscriptions;
  previous_plan text;
  today date;
  extended_until date;
  year text;
  receipt text;
  payment public.subscription_payments;
begin
  if not public.is_platform_dev() then
    raise exception 'Only the platform admin extends a plan' using errcode = '42501';
  end if;

  select * into subscription from public.clinic_subscriptions where clinic_id = p_clinic_id for update;
  if not found then
    raise exception 'No such clinic' using hint = 'RECORD_NOT_FOUND';
  end if;

  previous_plan := subscription.plan;
  today := public.clinic_today(p_clinic_id);
  extended_until := case p_kind
    when 'MONTHLY' then (greatest(today - 1, subscription.valid_until) + interval '1 month')::date
    when 'YEARLY' then (greatest(today - 1, subscription.valid_until) + interval '12 months')::date
    when 'CUSTOM' then p_valid_until
  end;

  if extended_until is null then
    raise exception 'An extension is monthly, yearly or to a date' using errcode = '22023';
  end if;

  if p_amount_paise > 0 then
    year := public.financial_year((now() at time zone 'Asia/Kolkata')::date);
    insert into public.receipt_counters as counter (financial_year, last_number)
    values (year, 1)
    on conflict (financial_year) do update set last_number = counter.last_number + 1
    returning 'R/' || year || '/' || lpad(counter.last_number::text, greatest(4, length(counter.last_number::text)), '0')
    into receipt;
  end if;

  insert into public.subscription_payments (
    clinic_id, plan, amount_paise, method, reference, paid_on, valid_from, valid_until, reason, recorded_by,
    receipt_number
  )
  values (
    p_clinic_id, p_kind, p_amount_paise, p_method, p_reference, p_paid_on, subscription.valid_until, extended_until,
    p_reason, (select auth.uid()), receipt
  )
  returning * into payment;

  update public.clinic_subscriptions
  set plan = case when p_kind = 'CUSTOM' then plan else p_kind end,
      valid_until = extended_until,
      updated_by = (select auth.uid())
  where clinic_id = p_clinic_id
  returning * into subscription;

  insert into public.audit_logs (clinic_id, actor_id, action, entity_type, entity_id, changes, request_id)
  values (
    null, (select auth.uid()), 'CREATE', 'subscription_payments', payment.id,
    jsonb_build_object(
      'clinic_id', p_clinic_id,
      'kind', payment.plan,
      'plan', jsonb_build_object('from', previous_plan, 'to', subscription.plan),
      'valid_until', jsonb_build_object('from', payment.valid_from, 'to', payment.valid_until),
      'amount_paise', payment.amount_paise
    ),
    p_request_id
  );

  return jsonb_build_object('subscription', to_jsonb(subscription), 'payment', to_jsonb(payment));
end;
$$;

revoke all on function public.extend_clinic_subscription(uuid, text, integer, text, text, date, date, text, text)
  from public, anon;
grant execute on function public.extend_clinic_subscription(uuid, text, integer, text, text, date, date, text, text)
  to authenticated;
