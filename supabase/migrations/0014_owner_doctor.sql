-- ============================================================
-- 0014 · The owner's own doctor profile (plan §3.1; tracker R3.7, D96, D97).
--
-- An owner may also see patients: a doctor profile beside their OWNER
-- membership (0003), set at registration ("I also see patients", 0008) and
-- changed here, from their own row in Team (D96). Only the owner changes it —
-- update_member never touches the owner (0013) — as themselves, while the
-- clinic can write.
--
-- Turning it off keeps the profile, inactive (D97): they leave the pickers,
-- the queue and booking, and what is in their name keeps it; turning it on
-- brings the same profile back, its details as they were.
-- ============================================================

-- The owner, acting as themselves; anyone else is refused (AUTH_PERMISSION_DENIED).
create or replace function public.require_owner()
returns public.clinic_members
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner public.clinic_members;
begin
  select * into owner from public.clinic_members as m
   where m.clinic_id = public.current_clinic_id() and m.user_id = auth.uid()
     and m.role = 'OWNER' and m.status = 'ACTIVE';
  if owner.id is null then
    raise exception 'Only the owner' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(owner.clinic_id);
  return owner;
end;
$$;

-- "I also see patients": on makes or brings back their doctor profile, off
-- leaves it inactive. Hands back the profile, none when there never was one.
create or replace function public.set_owner_sees_patients(p_sees boolean)
returns setof public.doctors
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner public.clinic_members := public.require_owner();
  doctor public.doctors;
begin
  update public.doctors as d set active = p_sees where d.member_id = owner.id
  returning * into doctor;
  if doctor.id is null and p_sees then
    insert into public.doctors (clinic_id, member_id) values (owner.clinic_id, owner.id)
    returning * into doctor;
  end if;
  if doctor.id is not null then
    return next doctor;
  end if;
end;
$$;

-- Their doctor details, as any doctor's (0013's update_member): only the
-- fields named, null to clear; only while they see patients.
create or replace function public.update_own_doctor(p_changes jsonb)
returns public.doctors
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner public.clinic_members := public.require_owner();
  doctor public.doctors;
begin
  update public.doctors as d
     set specialization = case
           when p_changes ? 'specialization' then p_changes ->> 'specialization' else d.specialization end,
         qualifications = case
           when p_changes ? 'qualifications' then p_changes ->> 'qualifications' else d.qualifications end,
         registration_number = case
           when p_changes ? 'registration_number' then p_changes ->> 'registration_number'
           else d.registration_number end,
         consultation_fee_paise = case
           when p_changes ? 'consultation_fee_paise' then (p_changes ->> 'consultation_fee_paise')::integer
           else d.consultation_fee_paise end
   where d.member_id = owner.id and d.active
  returning * into doctor;
  if doctor.id is null then
    raise exception 'The owner sees no patients' using hint = 'OWNER_NOT_DOCTOR';
  end if;
  return doctor;
end;
$$;

revoke all on function public.require_owner() from public, anon, authenticated;
revoke all on function public.set_owner_sees_patients(boolean) from public, anon;
revoke all on function public.update_own_doctor(jsonb) from public, anon;
grant execute on function public.set_owner_sees_patients(boolean) to authenticated;
grant execute on function public.update_own_doctor(jsonb) to authenticated;
