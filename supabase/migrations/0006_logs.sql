-- ============================================================
-- 0006 · Logs (plan §19, §36; tracker R1.6).
--
-- 1. `audit_logs`: who did what, when — every mutation of the clinic's
--    records (AGENTS.md §14), and the platform's own actions (an extension, a
--    settings change) with no clinic. Written by the server only (through the
--    service role, src/lib/audit/auditLog.ts, or inside a SQL function); a
--    member cannot write, change or delete a row. The clinic's owner reads
--    their clinic's (the activity log, plan §19); the DEV reads only the
--    platform's, through the server.
-- 2. `error_logs`: what failed on the server — never patient data (plan
--    §27.6). Written through the service role (captureError) and read by the
--    developer console only; no signed-in user reaches it.
-- 3. `clean_up_logs()`: drops audit rows older than `audit_keep_days` and
--    error rows older than `error_log_keep_days` — the platform settings, read
--    each time it runs (D22) — every hour, by pg_cron.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The audit trail
-- ------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- Null for the platform's own actions.
  clinic_id uuid references public.clinics (id) on delete cascade,
  -- Who did it; the record's own *_by columns keep it past the purge (D14).
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ARCHIVE', 'RESTORE', 'VOID')),
  -- The table the row belongs to, and the row.
  entity_type text not null check (entity_type ~ '^[a-z_]{1,63}$'),
  entity_id uuid,
  -- A line for the activity log; never a patient's name (plan §27.6).
  summary text check (public.is_clean_line(summary, 300)),
  -- Values for non-clinical changes, field names only for clinical text.
  changes jsonb,
  request_id text check (char_length(request_id) <= 100),
  created_at timestamptz not null default now()
);

create index audit_logs_clinic_id_created_at_idx on public.audit_logs (clinic_id, created_at desc);
create index audit_logs_created_at_idx on public.audit_logs (created_at);
create index audit_logs_platform_idx on public.audit_logs (created_at desc) where clinic_id is null;

alter table public.audit_logs enable row level security;

create policy audit_logs_select_owner
on public.audit_logs
for select
to authenticated
using (clinic_id = (select public.current_clinic_id()) and (select public.is_clinic_owner()));

grant select on public.audit_logs to authenticated;
revoke update, truncate on public.audit_logs from service_role;

-- ------------------------------------------------------------
-- 2. The error log
-- ------------------------------------------------------------

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  -- Where it happened: a request, a screen, the server's own work, the scheduler's call.
  source text not null check (source in ('API', 'SCREEN', 'SERVER', 'CRON')),
  -- What failed, in words: the line the server's output carries.
  message text not null check (char_length(message) <= 500),
  -- What the person was shown to quote: a request's id, or a screen's digest.
  reference text check (char_length(reference) <= 100),
  -- The catalogue code and the kind of failure (src/lib/errors).
  code text check (char_length(code) <= 100),
  kind text check (char_length(kind) <= 40),
  http_status integer check (http_status between 100 and 599),
  method text check (char_length(method) <= 10),
  path text check (char_length(path) <= 300),
  -- Who was asking, when it is known.
  user_id uuid references public.profiles (id) on delete set null,
  clinic_id uuid references public.clinics (id) on delete cascade,
  -- The thrown value's own message and stack: the driver's text, which may
  -- name tables, so only the developer console reads it.
  detail text check (char_length(detail) <= 2000),
  stack text check (char_length(stack) <= 8000),
  -- Anything else that helps, redacted as the logger redacts it.
  context jsonb,
  created_at timestamptz not null default now()
);

create index error_logs_created_at_idx on public.error_logs (created_at desc);
create index error_logs_reference_idx on public.error_logs (reference);

-- No policy at all: nobody signed in reads or writes it.
alter table public.error_logs enable row level security;
revoke all on public.error_logs from public, anon, authenticated;
revoke update, truncate on public.error_logs from service_role;

-- ------------------------------------------------------------
-- 3. The purge
-- ------------------------------------------------------------

create or replace function public.clean_up_logs()
returns integer
language sql
set search_path = ''
as $$
  with settings as (
    select audit_keep_days, error_log_keep_days from public.platform_settings where id
  ), audit as (
    delete from public.audit_logs
    where created_at < now() - make_interval(days => (select audit_keep_days from settings))
    returning 1
  ), errors as (
    delete from public.error_logs
    where created_at < now() - make_interval(days => (select error_log_keep_days from settings))
    returning 1
  )
  select ((select count(*) from audit) + (select count(*) from errors))::integer;
$$;

revoke all on function public.clean_up_logs() from public, anon, authenticated;
grant execute on function public.clean_up_logs() to service_role;

-- Every hour, so a row is gone within the hour after its last day.
select cron.schedule('clean-up-logs', '17 * * * *', $$select public.clean_up_logs()$$);
