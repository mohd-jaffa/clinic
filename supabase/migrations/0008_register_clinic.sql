-- ============================================================
-- 0008 · register_clinic (plan §5.1, §7.6; tracker R1.8).
--
-- Sign-up's one transaction, called by the server through the service role
-- after it has made the owner's auth user (src/features/auth/register.ts); if
-- this fails, the server deletes that user again. In order:
--
-- 1. the owner's profile, the clinic, the OWNER membership, and the owner's
--    doctor profile when they also see patients (plan §3.1);
-- 2. the trial claim (D42): a mobile that has never claimed one gets a TRIAL
--    of `trial_days` from today, in the clinic's timezone; one that has gets
--    none — its validity is set far enough back to be READ_ONLY at once
--    whatever the grace period is set to (grace_days is at most 60,
--    PLATFORM_SETTING_BOUNDS) — and the console shows it as No trial;
-- 3. what every clinic starts with — the appointment types, the expense
--    categories and the Consultation entry on the price list — exactly
--    src/constants/seeds.ts, kept equal by tests/db;
-- 4. an audit row.
-- ============================================================

create or replace function public.register_clinic(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_sees_patients boolean,
  p_clinic_name text,
  p_clinic_type text,
  p_city text,
  p_address text,
  p_clinic_phone text,
  p_mobile_hmac text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.platform_settings;
  new_clinic_id uuid;
  new_member_id uuid;
  new_doctor_id uuid;
  today date;
  trial boolean;
  last_day date;
begin
  select * into settings from public.platform_settings where id;

  -- 1. The owner, the clinic, the membership, the doctor profile.
  insert into public.profiles (id, full_name, email, phone)
  values (p_user_id, p_full_name, p_email, p_phone);

  insert into public.clinics (name, clinic_type, city, address, phone)
  values (p_clinic_name, p_clinic_type, p_city, p_address, p_clinic_phone)
  returning id into new_clinic_id;

  insert into public.clinic_members (clinic_id, user_id, role, status, joined_at)
  values (new_clinic_id, p_user_id, 'OWNER', 'ACTIVE', now())
  returning id into new_member_id;

  if p_sees_patients then
    insert into public.doctors (clinic_id, member_id)
    values (new_clinic_id, new_member_id)
    returning id into new_doctor_id;
  end if;

  -- 2. The trial, once per mobile.
  trial := not exists (select 1 from public.trial_claims where mobile_hmac = p_mobile_hmac);

  insert into public.trial_claims as claim (mobile_hmac, last_clinic_id)
  values (p_mobile_hmac, new_clinic_id)
  on conflict (mobile_hmac) do update set last_clinic_id = excluded.last_clinic_id;

  today := public.clinic_today(new_clinic_id);
  last_day := case when trial then today + settings.trial_days else today - 61 end;

  insert into public.clinic_subscriptions (clinic_id, plan, valid_until)
  values (new_clinic_id, 'TRIAL', last_day);

  -- 3. What every clinic starts with (src/constants/seeds.ts).
  insert into public.appointment_types (clinic_id, name, default_minutes, position)
  values
    (new_clinic_id, 'Consultation', 15, 1),
    (new_clinic_id, 'Follow-up', 10, 2),
    (new_clinic_id, 'Procedure', 30, 3),
    (new_clinic_id, 'Review', 15, 4),
    (new_clinic_id, 'Other', 15, 5);

  insert into public.expense_categories (clinic_id, name, position)
  values
    (new_clinic_id, 'Rent', 1),
    (new_clinic_id, 'Electricity', 2),
    (new_clinic_id, 'Equipment', 3),
    (new_clinic_id, 'Medicine', 4),
    (new_clinic_id, 'Supplies', 5),
    (new_clinic_id, 'Salary', 6),
    (new_clinic_id, 'Maintenance', 7),
    (new_clinic_id, 'Marketing', 8),
    (new_clinic_id, 'Other', 9);

  insert into public.services (clinic_id, name, category, price_paise, created_by, updated_by)
  values (new_clinic_id, 'Consultation', 'CONSULTATION', 0, p_user_id, p_user_id);

  -- 4. The audit row.
  insert into public.audit_logs (clinic_id, actor_id, action, entity_type, entity_id, changes)
  values (new_clinic_id, p_user_id, 'CREATE', 'clinics', new_clinic_id, jsonb_build_object('trial', trial));

  return jsonb_build_object(
    'clinic_id', new_clinic_id,
    'member_id', new_member_id,
    'doctor_id', new_doctor_id,
    'trial', trial,
    'valid_until', last_day
  );
end;
$$;

revoke all on function public.register_clinic(uuid, text, text, text, boolean, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.register_clinic(uuid, text, text, text, boolean, text, text, text, text, text, text)
  to service_role;
