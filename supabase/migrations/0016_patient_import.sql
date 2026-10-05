-- ============================================================
-- 0016 · Importing patients (plan §10.5, D51, D127 – D133; tracker R4.8).
--
-- 1. How many rows one import may hold is a platform setting (D128), not a
--    constant: `max_import_rows`, 10,000 to start, bounded as
--    PLATFORM_SETTING_BOUNDS.maxImportRows says (tests/db keeps them equal).
--    update_platform_settings learns its name; the DEV changes it in the
--    console like every other.
-- 2. A batch sent again adds nobody twice (plan §10.5, "idempotent per
--    batch"): each row carries its own key, the browser's, and a row whose
--    key the clinic already holds is found, not added — so a batch retried
--    after the connection dropped, wholly or in part, numbers no one twice
--    and skips no number. Hands back each row's patient and whether this
--    call added them, so the import is audited once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The import's row cap (D128)
-- ------------------------------------------------------------

alter table public.platform_settings
  add column max_import_rows integer not null default 10000 check (max_import_rows between 100 and 50000);

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
    'follow_up_lapsed_days', 'deletion_cooling_days', 'max_import_rows', 'renewal_contact_name',
    'renewal_contact_phone', 'renewal_contact_email', 'renewal_upi_id', 'business_name', 'business_address'
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
    max_import_rows = case when p_changes ? 'max_import_rows'
      then (p_changes ->> 'max_import_rows')::integer else max_import_rows end,
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

-- ------------------------------------------------------------
-- 2. One batch of an import, safe to send again
-- ------------------------------------------------------------

-- Its answer changes shape, so the old one goes first.
drop function public.import_patients(jsonb);

-- The owner's alone, while the clinic can write. Each row is a patient as
-- create_patient adds one — without an assigned doctor, which an import does
-- not carry — with its own idempotency key. One batch at a time per clinic:
-- a batch sent again waits for the first, then finds its patients. The rows
-- whose keys are new are numbered from the counter in the order given; a row
-- refused refuses the batch. Each column's CHECK and check_patient are the
-- last word. Hands back every row's patient, in the order given, and whether
-- this call added them.
create or replace function public.import_patients(p_patients jsonb)
returns table (patient_id uuid, patient_number integer, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
begin
  if clinic is null or not public.is_clinic_owner() then
    raise exception 'Importing patients is the owner''s' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  if exists (
    select 1 from jsonb_populate_recordset(null::public.patients, p_patients) as given
     where given.idempotency_key is null
  ) then
    raise exception 'Every imported row needs its idempotency key' using hint = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(clinic::text || ':import', 0));

  return query
  with given as (
    select * from jsonb_populate_recordset(null::public.patients, p_patients) with ordinality
  ),
  found as (
    select patient.id, patient.patient_number, patient.idempotency_key
      from public.patients as patient
     where patient.clinic_id = clinic
       and patient.idempotency_key in (select given.idempotency_key from given)
  ),
  added as (
    insert into public.patients (
      clinic_id, full_name, phone, alt_phone, email, date_of_birth, dob_is_estimated, gender,
      address, emergency_contact_name, emergency_contact_phone, notes, idempotency_key
    )
    select clinic, given.full_name, given.phone, given.alt_phone, given.email, given.date_of_birth,
           coalesce(given.dob_is_estimated, false), given.gender, given.address,
           given.emergency_contact_name, given.emergency_contact_phone, given.notes, given.idempotency_key
      from given
     where given.idempotency_key not in (select found.idempotency_key from found)
     order by given.ordinality
    returning public.patients.id, public.patients.patient_number, public.patients.idempotency_key
  )
  select coalesce(added.id, found.id), coalesce(added.patient_number, found.patient_number), added.id is not null
    from given
    left join added on added.idempotency_key = given.idempotency_key
    left join found on found.idempotency_key = given.idempotency_key
   order by given.ordinality;
end;
$$;

revoke all on function public.import_patients(jsonb) from public, anon;
grant execute on function public.import_patients(jsonb) to authenticated;
