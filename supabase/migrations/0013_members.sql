-- ============================================================
-- 0013 · Changing the team (plan §8.2, §8.6; tracker R3.6, D93 – D95).
--
-- A member's page changes what they can do, their job title or their
-- doctor's details, and deactivates or reactivates them. Both functions are
-- called by the signed-in member as themselves — the actor is auth.uid(),
-- never a request's word — and check:
--
-- 1. The actor manages the team (0012's team_actor): the owner, or an active
--    member with team.manage, of a clinic that can write.
-- 2. The member is one they may change (D93): of their clinic, joined (an
--    invite is resent or revoked instead), never the owner — whose access is
--    all of it, and who is never deactivated (§8.2 rule 7) — never
--    themselves, and, for anyone but the owner, one whose every permission
--    they hold, without team.manage.
-- 3. No escalation (0012's check_grantable): what is given is what the actor
--    holds, and team.manage only from the owner.
-- 4. The role is fixed (D95): a job title is staff's, a doctor's details a
--    doctor's.
-- ============================================================

-- The member the acting member may change, locked while they change it.
create or replace function public.team_target(p_actor public.clinic_members, p_member_id uuid)
returns public.clinic_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.clinic_members;
begin
  select * into target from public.clinic_members as m
   where m.id = p_member_id and m.clinic_id = p_actor.clinic_id
   for update;
  if target.id is null then
    raise exception 'No such member' using hint = 'RECORD_NOT_FOUND';
  end if;
  if target.role = 'OWNER' then
    raise exception 'The owner holds every permission, always' using hint = 'TEAM_OWNER_UNCHANGEABLE';
  end if;
  if target.id = p_actor.id then
    raise exception 'No one changes their own access' using hint = 'TEAM_NOT_YOURSELF';
  end if;
  if target.status = 'INVITED' then
    raise exception 'Not joined yet' using hint = 'MEMBER_STILL_INVITED';
  end if;
  if p_actor.role <> 'OWNER'
     and ('team.manage' = any (target.permissions) or not (target.permissions <@ p_actor.permissions)) then
    raise exception 'Only the owner changes this member' using hint = 'TEAM_MEMBER_NOT_YOURS';
  end if;
  return target;
end;
$$;

-- Only the fields named in `p_changes` change: `permissions` (a list),
-- `job_title`, and `doctor` — its own named fields: specialization,
-- qualifications, registration_number, consultation_fee_paise; a field given
-- as null is cleared. Each column's CHECK is the last word on its value.
create or replace function public.update_member(p_member_id uuid, p_changes jsonb)
returns public.clinic_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.clinic_members := public.team_actor(public.current_clinic_id(), auth.uid());
  target public.clinic_members := public.team_target(actor, p_member_id);
  doctor jsonb := p_changes -> 'doctor';
  granted text[];
begin
  if p_changes ? 'permissions' then
    granted := array(select jsonb_array_elements_text(p_changes -> 'permissions'));
    perform public.check_grantable(actor, granted);
  end if;
  if (p_changes ? 'job_title' and target.role <> 'STAFF') or (p_changes ? 'doctor' and target.role <> 'DOCTOR') then
    raise exception 'A job title is staff''s, a doctor''s details a doctor''s' using errcode = '22023';
  end if;

  update public.clinic_members as m
     set permissions = case when p_changes ? 'permissions' then granted else m.permissions end,
         job_title = case when p_changes ? 'job_title' then p_changes ->> 'job_title' else m.job_title end
   where m.id = target.id
  returning * into target;

  if doctor is not null then
    update public.doctors as d
       set specialization = case when doctor ? 'specialization' then doctor ->> 'specialization' else d.specialization end,
           qualifications = case when doctor ? 'qualifications' then doctor ->> 'qualifications' else d.qualifications end,
           registration_number = case
             when doctor ? 'registration_number' then doctor ->> 'registration_number' else d.registration_number end,
           consultation_fee_paise = case
             when doctor ? 'consultation_fee_paise' then (doctor ->> 'consultation_fee_paise')::integer
             else d.consultation_fee_paise end
     where d.member_id = target.id;
  end if;
  return target;
end;
$$;

-- Deactivates (§8.2 rule 6: their next request is refused) or reactivates —
-- unless they have joined another clinic meanwhile (D23). Asking for what
-- already is changes nothing.
create or replace function public.set_member_active(p_member_id uuid, p_active boolean)
returns public.clinic_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.clinic_members := public.team_actor(public.current_clinic_id(), auth.uid());
  target public.clinic_members := public.team_target(actor, p_member_id);
begin
  if p_active and target.status = 'INACTIVE' then
    if exists (
      select 1 from public.clinic_members as m
       where m.user_id = target.user_id and m.id <> target.id and m.status in ('INVITED', 'ACTIVE')
    ) then
      raise exception 'In another clinic now' using hint = 'MEMBER_ALREADY_EXISTS';
    end if;
    update public.clinic_members as m
       set status = 'ACTIVE', deactivated_at = null, deactivated_by = null
     where m.id = target.id
    returning * into target;
  elsif not p_active and target.status = 'ACTIVE' then
    update public.clinic_members as m
       set status = 'INACTIVE', deactivated_at = now(), deactivated_by = actor.user_id
     where m.id = target.id
    returning * into target;
  end if;
  return target;
end;
$$;

revoke all on function public.team_target(public.clinic_members, uuid) from public, anon, authenticated;
revoke all on function public.update_member(uuid, jsonb) from public, anon;
revoke all on function public.set_member_active(uuid, boolean) from public, anon;
grant execute on function public.update_member(uuid, jsonb) to authenticated;
grant execute on function public.set_member_active(uuid, boolean) to authenticated;
