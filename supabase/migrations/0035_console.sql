-- ============================================================
-- 0035 · The developer console's reads (plan §20; tracker R11.2; D367 – D372).
--
-- Every read of the console is one of these, called by the server as itself
-- (the service role, behind withDevRoute) — never by a signed-in user — and
-- none hands back a clinic's data (plan §20): of a clinic only its name,
-- type, city, owner, plan and how many members it has; of an account who it
-- is and where; of the platform's audit only its own actions.
--
-- 1. console_clinic_rows(): every clinic as the console sees it — its plan's
--    state by the live settings on the clinic's own today; where the
--    Overview counts it (D368: a trial still running is Trial, any other
--    clinic by its state); and No trial (plan §7.6) — still on the TRIAL
--    plan with a last day before the day it signed up, which register_clinic
--    (0008) gives only a mobile that had its trial before, until the DEV
--    extends it.
-- 2. console_overview(): the Overview's figures.
-- 3. console_clinics(): the Clinics list, searched and filtered, the newest
--    sign-up first (D371), a page at a time.
-- 4. console_clinic(): one clinic, with every change recorded to its plan.
-- 5. console_accounts(): every account, the newest first, with its clinic
--    and its last sign-in.
-- 6. console_audit(): the platform's own audit rows, the newest first, with
--    who acted and the clinic an extension was for.
--
-- Deletion requested and Deletions due join these with the request itself
-- (D369, R12.5).
-- ============================================================

-- The newest sign-ups first; the newest accounts first; this month's extensions.
create index clinics_created_at_idx on public.clinics (created_at desc, id desc);
create index profiles_created_at_idx on public.profiles (created_at desc, id desc);
create index subscription_payments_created_at_idx on public.subscription_payments (created_at);

-- ------------------------------------------------------------
-- 1. Every clinic, as the console sees it
-- ------------------------------------------------------------

create or replace function public.console_clinic_rows()
returns table (
  id uuid,
  name text,
  clinic_type text,
  city text,
  signed_up_at timestamptz,
  owner_name text,
  owner_email text,
  owner_phone text,
  plan text,
  valid_until date,
  state text,
  bucket text,
  members integer,
  no_trial boolean
)
language sql
stable
set search_path = ''
as $$
  select
    clinic.id,
    clinic.name,
    clinic.clinic_type,
    clinic.city,
    clinic.created_at,
    owner.full_name,
    owner.email::text,
    owner.phone,
    subscription.plan,
    subscription.valid_until,
    standing.state,
    case when subscription.plan = 'TRIAL' and standing.state in ('ACTIVE', 'EXPIRING') then 'TRIAL' else standing.state end,
    (
      select count(*)::integer
        from public.clinic_members as member
       where member.clinic_id = clinic.id and member.status = 'ACTIVE'
    ),
    subscription.plan = 'TRIAL' and subscription.valid_until < (clinic.created_at at time zone clinic.timezone)::date
  from public.clinics as clinic
  join public.clinic_subscriptions as subscription on subscription.clinic_id = clinic.id
  join public.clinic_members as ownership on ownership.clinic_id = clinic.id and ownership.role = 'OWNER'
  join public.profiles as owner on owner.id = ownership.user_id
  cross join public.platform_settings as settings
  cross join lateral (
    select public.subscription_state_for(
      subscription.valid_until,
      (now() at time zone clinic.timezone)::date,
      settings.expiry_warning_days,
      settings.grace_days
    ) as state
  ) as standing;
$$;

-- ------------------------------------------------------------
-- 2. The Overview (plan §20.1): clinics where they stand, sign-ups this
--    week (from Monday) and this month, extensions recorded this month,
--    and the clinics waiting for activation — on the platform's own day,
--    India's (D9).
-- ------------------------------------------------------------

create or replace function public.console_overview()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with
    clinic as (select * from public.console_clinic_rows()),
    today as (select (now() at time zone 'Asia/Kolkata')::date as day),
    since as (
      select
        today.day as today,
        (today.day - (extract(isodow from today.day)::integer - 1)) as week,
        date_trunc('month', today.day)::date as month
      from today
    )
  select jsonb_build_object(
    'today', since.today,
    'clinics', (select count(*) from clinic),
    'buckets', (
      select jsonb_object_agg(bucket.name, (select count(*) from clinic where clinic.bucket = bucket.name))
        from unnest(array['TRIAL', 'ACTIVE', 'EXPIRING', 'GRACE', 'READ_ONLY']) as bucket (name)
    ),
    'no_trial', (select count(*) from clinic where clinic.no_trial),
    'signups_week', (
      select count(*) from clinic where clinic.signed_up_at >= (since.week::timestamp at time zone 'Asia/Kolkata')
    ),
    'signups_month', (
      select count(*) from clinic where clinic.signed_up_at >= (since.month::timestamp at time zone 'Asia/Kolkata')
    ),
    'extensions_month', (
      select count(*) from public.subscription_payments as payment
       where payment.created_at >= (since.month::timestamp at time zone 'Asia/Kolkata')
    )
  )
  from since;
$$;

-- ------------------------------------------------------------
-- 3. The Clinics list (plan §20.2; D371): what was typed matched against the
--    clinic's name and city and the owner's name and email — words, never a
--    pattern of the caller's (src/lib/supabase/search.ts) — or their mobile's
--    digits; and one filter — a place in the Overview, or No trial.
-- ------------------------------------------------------------

create or replace function public.console_clinics(
  p_words text,
  p_digits text,
  p_filter text,
  p_offset integer,
  p_limit integer
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_filter is not null and p_filter not in ('TRIAL', 'ACTIVE', 'EXPIRING', 'GRACE', 'READ_ONLY', 'NO_TRIAL') then
    raise exception 'No such filter' using errcode = '22023';
  end if;

  return coalesce(
    (
      select jsonb_agg(to_jsonb(page) order by page.signed_up_at desc, page.id desc)
        from (
          select clinic.*
            from public.console_clinic_rows() as clinic
           where (p_filter is null or (p_filter = 'NO_TRIAL' and clinic.no_trial) or clinic.bucket = p_filter)
             and (
               p_words is null
               or clinic.name ilike '%' || p_words || '%'
               or clinic.city ilike '%' || p_words || '%'
               or clinic.owner_name ilike '%' || p_words || '%'
               or clinic.owner_email ilike '%' || p_words || '%'
               or (p_digits is not null and clinic.owner_phone like '%' || p_digits || '%')
             )
           order by clinic.signed_up_at desc, clinic.id desc
          offset p_offset
           limit p_limit
        ) as page
    ),
    '[]'::jsonb
  );
end;
$$;

-- ------------------------------------------------------------
-- 4. One clinic (plan §20.3): its row, and every change recorded to its
--    plan, the latest first, with who recorded it. Null for no such clinic.
-- ------------------------------------------------------------

create or replace function public.console_clinic(p_clinic_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select to_jsonb(clinic) || jsonb_build_object(
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
  where clinic.id = p_clinic_id;
$$;

-- ------------------------------------------------------------
-- 5. Every account (plan §20.5): who they are, the clinic they belong to —
--    their active or invited membership, else their last — their role and
--    its status, the platform's own role, and when they last signed in.
-- ------------------------------------------------------------

create or replace function public.console_accounts(p_words text, p_digits text, p_offset integer, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(to_jsonb(page) order by page.created_at desc, page.id desc),
    '[]'::jsonb
  )
  from (
    select
      profile.id,
      profile.full_name,
      profile.email::text as email,
      profile.phone,
      profile.platform_role,
      profile.created_at,
      membership.clinic_id,
      membership.clinic_name,
      membership.role,
      membership.status,
      account.last_sign_in_at
    from public.profiles as profile
    join auth.users as account on account.id = profile.id
    left join lateral (
      select member.clinic_id, clinic.name as clinic_name, member.role, member.status
        from public.clinic_members as member
        join public.clinics as clinic on clinic.id = member.clinic_id
       where member.user_id = profile.id
       order by (member.status <> 'INACTIVE') desc, member.created_at desc
       limit 1
    ) as membership on true
    where p_words is null
       or profile.full_name ilike '%' || p_words || '%'
       or profile.email ilike '%' || p_words || '%'
       or membership.clinic_name ilike '%' || p_words || '%'
       or (p_digits is not null and profile.phone like '%' || p_digits || '%')
    order by profile.created_at desc, profile.id desc
    offset p_offset
     limit p_limit
  ) as page;
$$;

-- ------------------------------------------------------------
-- 6. The platform audit (plan §20.7): the console's own actions — plans
--    extended, settings changed — with who acted, and the clinic an
--    extension was for while it still exists.
-- ------------------------------------------------------------

create or replace function public.console_audit(p_offset integer, p_limit integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc, page.id desc), '[]'::jsonb)
  from (
    select
      entry.id,
      entry.action,
      entry.entity_type,
      entry.entity_id,
      entry.changes,
      entry.request_id,
      entry.created_at,
      actor.full_name as actor_name,
      clinic.name as clinic_name
    from public.audit_logs as entry
    left join public.profiles as actor on actor.id = entry.actor_id
    left join public.clinics as clinic on clinic.id = (entry.changes ->> 'clinic_id')::uuid
    where entry.clinic_id is null
    order by entry.created_at desc, entry.id desc
    offset p_offset
     limit p_limit
  ) as page;
$$;

-- Only the server, as itself, reads any of it.
revoke all on function public.console_clinic_rows() from public, anon, authenticated;
revoke all on function public.console_overview() from public, anon, authenticated;
revoke all on function public.console_clinics(text, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.console_clinic(uuid) from public, anon, authenticated;
revoke all on function public.console_accounts(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.console_audit(integer, integer) from public, anon, authenticated;
grant execute on function public.console_clinic_rows() to service_role;
grant execute on function public.console_overview() to service_role;
grant execute on function public.console_clinics(text, text, text, integer, integer) to service_role;
grant execute on function public.console_clinic(uuid) to service_role;
grant execute on function public.console_accounts(text, text, integer, integer) to service_role;
grant execute on function public.console_audit(integer, integer) to service_role;
