-- ============================================================
-- 0037 · The plan emails (plan §22; tracker R11.5; D382 – D386).
--
-- Every day at 9:00 in India (D382) the database's scheduler calls the app's
-- POST /api/cron/subscription-notices, which emails each owner whose plan
-- has a notice due: before it ends (one on each of the expiry email days),
-- the day after it ended, and the day it becomes view-only. No worker, no
-- queue: pg_cron, through pg_net, and the work in that one request.
--
-- 1. What each plan was last told, on its subscription row: the notice, the
--    day it was due, and the last day of access it was about. A plan
--    extended has a new last day, so its notices start again.
-- 2. claim_subscription_notices(): the plans with a notice due — the latest
--    one due by the clinic's own today and not yet sent for this last day
--    (D383: a missed day catches up, with that one alone, never a backlog) —
--    marked as told in the same statement, so two runs at once never tell
--    anyone twice. A clinic waiting for activation (No trial, plan §7.6) is
--    told nothing until the DEV extends it (D385).
-- 3. release_subscription_notices(): an email that did not go is unmarked,
--    so the next run tries it again (D383).
-- 4. call_subscription_notices() and its daily job. The app's address and
--    CRON_SECRET are read from Supabase Vault, never written here:
--
--      select vault.create_secret('https://<app>/api/cron/subscription-notices',
--                                 'subscription_notices_url');
--      select vault.create_secret('<CRON_SECRET>', 'cron_secret');
--
--    Without them (a local stack) the job says so and calls nothing.
-- ============================================================

-- ------------------------------------------------------------
-- 1. What each plan was last told
-- ------------------------------------------------------------

alter table public.clinic_subscriptions
  add column last_notice text check (last_notice in ('ENDS_SOON', 'ENDED', 'READ_ONLY')),
  add column last_notice_due date,
  add column last_notice_for date,
  add constraint clinic_subscriptions_last_notice check (
    (last_notice is null) = (last_notice_due is null) and (last_notice is null) = (last_notice_for is null)
  );

-- The daily run looks only at plans whose last day is near or past.
create index clinic_subscriptions_valid_until_idx on public.clinic_subscriptions (valid_until);

-- ------------------------------------------------------------
-- 2. claim_subscription_notices(limit)
--
-- A plan's notices fall due on days worked out from its last day and the
-- live settings: ENDS_SOON on each expiry email day before it; ENDED the day
-- after it (none when there is no grace: the clinic is view-only that day);
-- READ_ONLY the day the grace ends. The one due is the latest whose day has
-- come; it is sent when nothing was, or something earlier, for this last
-- day. Hands back, for each plan claimed, who to tell, what, and what it was
-- told before (for release).
-- ------------------------------------------------------------

create or replace function public.claim_subscription_notices(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  with
    settings as (
      select expiry_notice_days, grace_days, coalesce((select max(day) from unnest(expiry_notice_days) as day), 0) as ahead
        from public.platform_settings
    ),
    due as (
      select
        subscription.clinic_id,
        stage.notice,
        stage.day,
        subscription.last_notice as previous_notice,
        subscription.last_notice_due as previous_due,
        subscription.last_notice_for as previous_for
      from public.clinic_subscriptions as subscription
      join public.clinics as clinic on clinic.id = subscription.clinic_id
      cross join settings
      cross join lateral (select (now() at time zone clinic.timezone)::date as today) as local
      cross join lateral (
        select candidate.notice, candidate.day
          from (
            select 'ENDS_SOON' as notice, subscription.valid_until - ahead_by as day
              from unnest(settings.expiry_notice_days) as ahead_by
            union all
            select 'ENDED', subscription.valid_until + 1 where settings.grace_days > 0
            union all
            select 'READ_ONLY', subscription.valid_until + settings.grace_days + 1
          ) as candidate
         where candidate.day <= local.today
         order by candidate.day desc, (candidate.notice = 'READ_ONLY') desc
         limit 1
      ) as stage
      where subscription.valid_until <= (now() at time zone 'UTC')::date + settings.ahead + 1
        -- Waiting for activation (plan §7.6; D385): told nothing until extended.
        and not (
          subscription.plan = 'TRIAL'
          and subscription.valid_until < (clinic.created_at at time zone clinic.timezone)::date
        )
        and (
          subscription.last_notice_for is distinct from subscription.valid_until
          or subscription.last_notice_due < stage.day
        )
      order by subscription.valid_until, subscription.clinic_id
      limit p_limit
    ),
    marked as (
      update public.clinic_subscriptions as subscription
         set last_notice = due.notice,
             last_notice_due = due.day,
             last_notice_for = subscription.valid_until
        from due
       where subscription.clinic_id = due.clinic_id
         and subscription.clinic_id in (
           select held.clinic_id
             from public.clinic_subscriptions as held
            where held.clinic_id in (select clinic_id from due)
              for update skip locked
         )
         -- Told by another run since this one looked: not again.
         and (
           subscription.last_notice_for is not distinct from due.previous_for
           and subscription.last_notice_due is not distinct from due.previous_due
         )
      returning subscription.clinic_id, subscription.plan, subscription.valid_until, due.notice, due.day,
                due.previous_notice, due.previous_due, due.previous_for
    )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'clinic_id', marked.clinic_id,
        'clinic_name', clinic.name,
        'owner_name', owner.full_name,
        'owner_email', owner.email::text,
        'plan', marked.plan,
        'valid_until', marked.valid_until,
        'today', (now() at time zone clinic.timezone)::date,
        'read_only_from', marked.valid_until + (select grace_days from public.platform_settings) + 1,
        'notice', marked.notice,
        'due', marked.day,
        'previous_notice', marked.previous_notice,
        'previous_due', marked.previous_due,
        'previous_for', marked.previous_for
      )
      order by marked.valid_until, marked.clinic_id
    ),
    '[]'::jsonb
  )
  into claimed
  from marked
  join public.clinics as clinic on clinic.id = marked.clinic_id
  join public.clinic_members as ownership on ownership.clinic_id = clinic.id and ownership.role = 'OWNER'
  join public.profiles as owner on owner.id = ownership.user_id;

  return claimed;
end;
$$;

-- ------------------------------------------------------------
-- 3. release_subscription_notices(claims)
--
-- The emails that did not go: each plan is put back to what it was told
-- before — only while it still holds this run's claim — so the next run
-- tries again (D383).
-- ------------------------------------------------------------

create or replace function public.release_subscription_notices(p_claims jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.clinic_subscriptions as subscription
     set last_notice = claim.previous_notice,
         last_notice_due = claim.previous_due,
         last_notice_for = claim.previous_for
    from jsonb_to_recordset(p_claims) as claim (
      clinic_id uuid, notice text, due date, valid_until date,
      previous_notice text, previous_due date, previous_for date
    )
   where subscription.clinic_id = claim.clinic_id
     and subscription.last_notice = claim.notice
     and subscription.last_notice_due = claim.due
     and subscription.last_notice_for = claim.valid_until;
$$;

-- Only the server, as itself, claims or releases.
revoke all on function public.claim_subscription_notices(integer) from public, anon, authenticated;
revoke all on function public.release_subscription_notices(jsonb) from public, anon, authenticated;
grant execute on function public.claim_subscription_notices(integer) to service_role;
grant execute on function public.release_subscription_notices(jsonb) to service_role;

-- ------------------------------------------------------------
-- 4. The daily call (D382): 9:00 in India is 03:30 UTC, pg_cron's clock.
-- ------------------------------------------------------------

create or replace function public.call_subscription_notices()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  address text;
  secret text;
begin
  select decrypted_secret into address from vault.decrypted_secrets where name = 'subscription_notices_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if address is null or secret is null then
    raise notice 'The plan emails are not set up: no subscription_notices_url or cron_secret in Vault';
    return;
  end if;

  perform net.http_post(
    url := address,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.call_subscription_notices() from public, anon, authenticated;

select cron.schedule('subscription-notices', '30 3 * * *', $$select public.call_subscription_notices()$$);
