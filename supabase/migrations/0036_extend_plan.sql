-- ============================================================
-- 0036 · Extending a plan (plan §7.4, §20.3; tracker R11.3; D373 – D376).
--
-- 1. Monthly and Yearly are money received (D374): more than ₹0, so with how
--    and when it was paid, and a receipt. Days given free are Set date
--    (CUSTOM), with the reason the owner reads in their history (D366).
-- 2. An extension is recorded once, however often it is sent (AGENTS.md
--    §26): each carries the idempotency key of the Extend plan it came from,
--    so a double tap, or a save sent again after a dropped connection,
--    records one.
-- 3. extend_clinic_subscription() takes that key, and hands back whether
--    this call recorded the extension and the clinic as the console now sees
--    it — what the console's card and the owner's email (D375, D376) are
--    made from, with no second read.
-- 4. console_clinic() carries the live prices, which fill in the amount of a
--    Monthly or a Yearly extension (plan §6, §7.4).
-- ============================================================

-- Nothing has been recorded before this one (no release yet), so every
-- extension has its key.
alter table public.subscription_payments
  add column idempotency_key uuid not null,
  add constraint subscription_payments_idempotency_key_key unique (clinic_id, idempotency_key),
  add constraint subscription_payments_period_paid check (plan = 'CUSTOM' or amount_paise > 0);

-- ------------------------------------------------------------
-- 3. extend_clinic_subscription (plan §7.4), once per key
--
-- As 0005's: MONTHLY and YEARLY add a calendar month or twelve to the later
-- of the plan's last day and yesterday, so paying early never loses a day and
-- paying late starts from today; CUSTOM sets the date given, for a reason.
-- One transaction: the payment row (and its receipt number when money was
-- received), the new validity and plan, and a platform audit row. Called with
-- the DEV's own token, so the database checks the role itself. The same key
-- again, for the same clinic, records nothing and answers with what the first
-- call recorded.
-- ------------------------------------------------------------

drop function public.extend_clinic_subscription(uuid, text, integer, text, text, date, date, text, text);

create or replace function public.extend_clinic_subscription(
  p_clinic_id uuid,
  p_kind text,
  p_amount_paise integer,
  p_method text,
  p_reference text,
  p_paid_on date,
  p_valid_until date,
  p_reason text,
  p_idempotency_key uuid,
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
  if p_idempotency_key is null then
    raise exception 'An extension needs its idempotency key' using hint = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  -- The clinic's plan, held until this commits: extensions of one clinic go one at a time.
  select * into subscription from public.clinic_subscriptions where clinic_id = p_clinic_id for update;
  if not found then
    raise exception 'No such clinic' using hint = 'RECORD_NOT_FOUND';
  end if;

  -- The same Extend plan sent again: what it recorded the first time.
  select * into payment
    from public.subscription_payments as recorded
   where recorded.clinic_id = p_clinic_id and recorded.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'created', false,
      'subscription', to_jsonb(subscription),
      'payment', to_jsonb(payment) - 'idempotency_key',
      'clinic', public.console_clinic(p_clinic_id)
    );
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
    receipt_number, idempotency_key
  )
  values (
    p_clinic_id, p_kind, p_amount_paise, p_method, p_reference, p_paid_on, subscription.valid_until, extended_until,
    p_reason, (select auth.uid()), receipt, p_idempotency_key
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

  return jsonb_build_object(
    'created', true,
    'subscription', to_jsonb(subscription),
    'payment', to_jsonb(payment) - 'idempotency_key',
    'clinic', public.console_clinic(p_clinic_id)
  );
end;
$$;

revoke all on function public.extend_clinic_subscription(uuid, text, integer, text, text, date, date, text, uuid, text)
  from public, anon;
grant execute on function public.extend_clinic_subscription(uuid, text, integer, text, text, date, date, text, uuid, text)
  to authenticated;

-- ------------------------------------------------------------
-- 4. One clinic (plan §20.3), as 0035's, with the live prices
-- ------------------------------------------------------------

create or replace function public.console_clinic(p_clinic_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select to_jsonb(clinic) || jsonb_build_object(
    'prices',
    jsonb_build_object('monthly_paise', settings.monthly_price_paise, 'yearly_paise', settings.yearly_price_paise),
    'payments',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', payment.id,
            'plan', payment.plan,
            'amount_paise', payment.amount_paise,
            'method', payment.method,
            'reference', payment.reference,
            'paid_on', payment.paid_on,
            'valid_from', payment.valid_from,
            'valid_until', payment.valid_until,
            'reason', payment.reason,
            'receipt_number', payment.receipt_number,
            'recorded_by_name', recorder.full_name,
            'created_at', payment.created_at
          )
          order by payment.created_at desc
        )
          from public.subscription_payments as payment
          left join public.profiles as recorder on recorder.id = payment.recorded_by
         where payment.clinic_id = clinic.id
      ),
      '[]'::jsonb
    )
  )
  from public.console_clinic_rows() as clinic
  cross join public.platform_settings as settings
  where clinic.id = p_clinic_id;
$$;
