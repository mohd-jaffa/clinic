-- ============================================================
-- 0004 · Platform settings (plan §6, D22; tracker R1.4).
--
-- Business rules are data, not code: one typed row the platform admin edits
-- from the developer console. The defaults below and the bound on every
-- column are src/constants/platform.ts's PLATFORM_SETTING_DEFAULTS and
-- PLATFORM_SETTING_BOUNDS, kept equal by tests/db; the code never reads a
-- default as the live value (AGENTS.md §10).
--
-- - Read: by the database directly (subscription_state(), clean_up_logs()),
--   and by the server through the service role (getPlatformSettings()).
--   Clinic users never read the table.
-- - Write: only update_platform_settings(), by the DEV, within these bounds,
--   recording who and when, with a platform audit row of what changed.
-- ============================================================

create table public.platform_settings (
  -- One row, ever.
  id boolean primary key default true check (id),
  trial_days integer not null default 30 check (trial_days between 0 and 365),
  monthly_price_paise integer not null default 30000 check (monthly_price_paise between 0 and 10000000),
  yearly_price_paise integer not null default 300000 check (yearly_price_paise between 0 and 100000000),
  expiry_warning_days integer not null default 7 check (expiry_warning_days between 0 and 60),
  grace_days integer not null default 7 check (grace_days between 0 and 60),
  expiry_notice_days integer[] not null default '{7,1}' check (
    cardinality(expiry_notice_days) <= 5
    and array_position(expiry_notice_days, null) is null
    and 1 <= all (expiry_notice_days)
    and 60 >= all (expiry_notice_days)
  ),
  audit_keep_days integer not null default 30 check (audit_keep_days between 7 and 3650),
  error_log_keep_days integer not null default 7 check (error_log_keep_days between 1 and 365),
  invite_valid_days integer not null default 7 check (invite_valid_days between 1 and 30),
  follow_up_lapsed_days integer not null default 30 check (follow_up_lapsed_days between 7 and 365),
  deletion_cooling_days integer not null default 7 check (deletion_cooling_days between 0 and 90),
  -- Who a clinic contacts to renew (plan §7.5); each hidden while unset.
  renewal_contact_name text check (public.is_clean_line(renewal_contact_name, 100)),
  renewal_contact_phone text check (public.is_indian_mobile(renewal_contact_phone)),
  renewal_contact_email extensions.citext check (public.is_email(renewal_contact_email::text)),
  renewal_upi_id text check (
    char_length(renewal_upi_id) <= 100 and renewal_upi_id ~ '^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9]+$'
  ),
  -- The platform's own name and address, on plan receipts (D58).
  business_name text check (public.is_clean_line(business_name, 100)),
  business_address text check (public.is_clean_text(business_address, 500)),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (true);

-- No policy: no signed-in user reads or writes it. The server's role reads it,
-- and changes it only through update_platform_settings(); the row is never
-- deleted.
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from public, anon, authenticated;
revoke insert, delete, truncate on public.platform_settings from service_role;

-- ------------------------------------------------------------
-- update_platform_settings(changes, request_id)
--
-- `changes` names only the settings being changed, by column; a column it
-- does not name keeps its value, and a name that is not a setting is refused.
-- The CHECKs above are the bounds (23514 when one is broken). Called with the
-- DEV's own token, so the database checks the role itself.
-- ------------------------------------------------------------

create or replace function public.update_platform_settings(p_changes jsonb, p_request_id text default null)
returns public.platform_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings constant text[] := array[
    'trial_days', 'monthly_price_paise', 'yearly_price_paise', 'expiry_warning_days', 'grace_days',
    'expiry_notice_days', 'audit_keep_days', 'error_log_keep_days', 'invite_valid_days',
    'follow_up_lapsed_days', 'deletion_cooling_days', 'renewal_contact_name', 'renewal_contact_phone',
    'renewal_contact_email', 'renewal_upi_id', 'business_name', 'business_address'
  ];
  was public.platform_settings;
  now_is public.platform_settings;
  changed jsonb;
begin
  if not public.is_platform_dev() then
    raise exception 'Only the platform admin changes platform settings' using errcode = '42501';
  end if;

  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'Platform settings changes must be an object' using errcode = '22023';
  end if;

  if exists (select 1 from jsonb_object_keys(p_changes) as name where name <> all (settings)) then
    raise exception 'Only platform settings can be changed' using errcode = '22023';
  end if;

  select * into was from public.platform_settings where id for update;

  update public.platform_settings set
    trial_days = case when p_changes ? 'trial_days'
      then (p_changes ->> 'trial_days')::integer else trial_days end,
    monthly_price_paise = case when p_changes ? 'monthly_price_paise'
      then (p_changes ->> 'monthly_price_paise')::integer else monthly_price_paise end,
    yearly_price_paise = case when p_changes ? 'yearly_price_paise'
      then (p_changes ->> 'yearly_price_paise')::integer else yearly_price_paise end,
    expiry_warning_days = case when p_changes ? 'expiry_warning_days'
      then (p_changes ->> 'expiry_warning_days')::integer else expiry_warning_days end,
    grace_days = case when p_changes ? 'grace_days'
      then (p_changes ->> 'grace_days')::integer else grace_days end,
    expiry_notice_days = case when p_changes ? 'expiry_notice_days'
      then array(select day::integer from jsonb_array_elements_text(p_changes -> 'expiry_notice_days') as day)
      else expiry_notice_days end,
    audit_keep_days = case when p_changes ? 'audit_keep_days'
      then (p_changes ->> 'audit_keep_days')::integer else audit_keep_days end,
    error_log_keep_days = case when p_changes ? 'error_log_keep_days'
      then (p_changes ->> 'error_log_keep_days')::integer else error_log_keep_days end,
    invite_valid_days = case when p_changes ? 'invite_valid_days'
      then (p_changes ->> 'invite_valid_days')::integer else invite_valid_days end,
    follow_up_lapsed_days = case when p_changes ? 'follow_up_lapsed_days'
      then (p_changes ->> 'follow_up_lapsed_days')::integer else follow_up_lapsed_days end,
    deletion_cooling_days = case when p_changes ? 'deletion_cooling_days'
      then (p_changes ->> 'deletion_cooling_days')::integer else deletion_cooling_days end,
    renewal_contact_name = case when p_changes ? 'renewal_contact_name'
      then p_changes ->> 'renewal_contact_name' else renewal_contact_name end,
    renewal_contact_phone = case when p_changes ? 'renewal_contact_phone'
      then p_changes ->> 'renewal_contact_phone' else renewal_contact_phone end,
    renewal_contact_email = case when p_changes ? 'renewal_contact_email'
      then (p_changes ->> 'renewal_contact_email')::extensions.citext else renewal_contact_email end,
    renewal_upi_id = case when p_changes ? 'renewal_upi_id'
      then p_changes ->> 'renewal_upi_id' else renewal_upi_id end,
    business_name = case when p_changes ? 'business_name'
      then p_changes ->> 'business_name' else business_name end,
    business_address = case when p_changes ? 'business_address'
      then p_changes ->> 'business_address' else business_address end,
    updated_by = (select auth.uid()),
    updated_at = now()
  where id
  returning * into now_is;

  -- What changed, from and to: settings hold no patient data (plan §27.6).
  select jsonb_object_agg(name, jsonb_build_object('from', to_jsonb(was) -> name, 'to', to_jsonb(now_is) -> name))
  into changed
  from jsonb_object_keys(p_changes) as name
  where (to_jsonb(was) -> name) is distinct from (to_jsonb(now_is) -> name);

  if changed is not null then
    insert into public.audit_logs (clinic_id, actor_id, action, entity_type, entity_id, changes, request_id)
    values (null, (select auth.uid()), 'UPDATE', 'platform_settings', null, changed, p_request_id);
  end if;

  return now_is;
end;
$$;

revoke all on function public.update_platform_settings(jsonb, text) from public, anon;
grant execute on function public.update_platform_settings(jsonb, text) to authenticated;
