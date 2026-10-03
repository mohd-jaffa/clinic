-- ============================================================
-- 0012 · Inviting the team (plan §8.3 – §8.5; tracker R3.4, D63, D88 – D90).
--
-- The owner, or a member with `team.manage`, invites a doctor or a member of
-- staff by email. The server makes the account (no password yet, through the
-- admin API), then calls invite_member, which writes in one transaction the
-- profile, a membership INVITED with the hash of the invite's own token (D63)
-- and how long it lasts (`invite_valid_days`), and the doctor profile for a
-- doctor. The token itself goes only into the emailed link (D90).
--
-- Every function here is the server's (service role, plan §27.5): the
-- account a membership names comes from the admin API, so no client may name
-- one. Each takes the acting member from the session, never the request, and
-- checks them again:
--
-- 1. They manage the team: the owner, or an active member with team.manage,
--    of a clinic that can write.
-- 2. No escalation (plan §8.2 rule 5): they grant only permissions they hold,
--    and only the owner grants team.manage.
-- 3. One clinic per person (D23): someone in a clinic, or invited to one, is
--    not invited again; a former member here is reactivated, not invited.
--
-- Resend gives the invite a new token and a new expiry, so the old link stops
-- working; revoke removes the invite. accept_invite (the accept screen,
-- R3.5) takes a token that is current and not expired, once.
-- ============================================================

-- Only the hash of an invite's token is kept, while the invite is open, and
-- one link names one invite.
alter table public.clinic_members add column invite_token_hash text
  check (invite_token_hash ~ '^[0-9a-f]{64}$');
alter table public.clinic_members add constraint clinic_members_invite_token
  check ((status = 'INVITED') = (invite_token_hash is not null));
create unique index clinic_members_invite_token_unique on public.clinic_members (invite_token_hash)
  where invite_token_hash is not null;

-- ------------------------------------------------------------
-- 1. Who manages the team, and what they may grant
-- ------------------------------------------------------------

-- The acting member, refused unless they manage this clinic's team while it
-- can write (AUTH_PERMISSION_DENIED, CLINIC_PLAN_EXPIRED).
create or replace function public.team_actor(p_clinic_id uuid, p_actor_id uuid)
returns public.clinic_members
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor public.clinic_members;
begin
  select * into actor from public.clinic_members as m
   where m.clinic_id = p_clinic_id and m.user_id = p_actor_id and m.status = 'ACTIVE';
  if actor.id is null or not (actor.role = 'OWNER' or 'team.manage' = any (actor.permissions)) then
    raise exception 'Managing the team needs team.manage' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(p_clinic_id);
  return actor;
end;
$$;

-- No escalation: the owner grants anything; anyone else only what they hold,
-- and never team.manage.
create or replace function public.check_grantable(p_actor public.clinic_members, p_permissions text[])
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_actor.role = 'OWNER' then
    return;
  end if;
  if 'team.manage' = any (p_permissions) then
    raise exception 'Only the owner lets someone manage the team' using hint = 'TEAM_MANAGE_OWNER_ONLY';
  end if;
  if not (p_permissions <@ p_actor.permissions) then
    raise exception 'A permission the inviter does not hold' using hint = 'TEAM_PERMISSION_NOT_HELD';
  end if;
end;
$$;

-- How long a new link lasts, from the platform's settings (plan §6).
create or replace function public.invite_expiry()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select now() + make_interval(days => s.invite_valid_days) from public.platform_settings as s;
$$;

-- ------------------------------------------------------------
-- 2. Inviting
-- ------------------------------------------------------------

-- `p_doctor` holds a doctor's details: specialization, qualifications,
-- registration_number, consultation_fee_paise — each optional, each held by
-- its column's CHECK.
create or replace function public.invite_member(
  p_clinic_id uuid,
  p_actor_id uuid,
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_role text,
  p_job_title text,
  p_permissions text[],
  p_doctor jsonb,
  p_token_hash text
)
returns public.clinic_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.clinic_members := public.team_actor(p_clinic_id, p_actor_id);
  member public.clinic_members;
begin
  if p_role is null or p_role not in ('DOCTOR', 'STAFF') then
    raise exception 'An invite is for a doctor or a member of staff' using errcode = '22023';
  end if;
  perform public.check_grantable(actor, p_permissions);

  if exists (select 1 from public.profiles as p where p.id = p_user_id and p.platform_role is not null) then
    raise exception 'The platform''s own account joins no clinic' using hint = 'INVITE_EMAIL_NOT_ALLOWED';
  end if;
  if exists (
    select 1 from public.clinic_members as m where m.user_id = p_user_id and m.status in ('INVITED', 'ACTIVE')
  ) then
    raise exception 'Already in a clinic, or invited to one' using hint = 'MEMBER_ALREADY_EXISTS';
  end if;
  if exists (select 1 from public.clinic_members as m where m.user_id = p_user_id and m.clinic_id = p_clinic_id) then
    raise exception 'A former member is reactivated, not invited' using hint = 'MEMBER_DEACTIVATED_HERE';
  end if;

  -- A new account's profile; one that already has an account keeps its own.
  insert into public.profiles (id, full_name, email)
  values (p_user_id, p_full_name, p_email)
  on conflict (id) do nothing;

  insert into public.clinic_members (
    clinic_id, user_id, role, status, job_title, permissions,
    invited_by, invited_at, invite_expires_at, invite_token_hash
  )
  values (
    p_clinic_id, p_user_id, p_role, 'INVITED', p_job_title, p_permissions,
    p_actor_id, now(), public.invite_expiry(), p_token_hash
  )
  returning * into member;

  if p_role = 'DOCTOR' then
    insert into public.doctors (
      clinic_id, member_id, specialization, qualifications, registration_number, consultation_fee_paise
    )
    values (
      p_clinic_id,
      member.id,
      p_doctor ->> 'specialization',
      p_doctor ->> 'qualifications',
      p_doctor ->> 'registration_number',
      (p_doctor ->> 'consultation_fee_paise')::integer
    );
  end if;
  return member;
end;
$$;

-- A new link: a new token and a new expiry; the old link stops working.
create or replace function public.resend_invite(
  p_clinic_id uuid,
  p_actor_id uuid,
  p_member_id uuid,
  p_token_hash text
)
returns public.clinic_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  member public.clinic_members;
begin
  perform public.team_actor(p_clinic_id, p_actor_id);
  update public.clinic_members as m
     set invite_token_hash = p_token_hash,
         invite_expires_at = public.invite_expiry()
   where m.id = p_member_id and m.clinic_id = p_clinic_id and m.status = 'INVITED'
  returning * into member;
  if member.id is null then
    raise exception 'No open invite' using hint = 'INVITE_CHANGED';
  end if;
  return member;
end;
$$;

-- Removes an open invite, the doctor profile with it, and hands it back.
create or replace function public.revoke_invite(p_clinic_id uuid, p_actor_id uuid, p_member_id uuid)
returns public.clinic_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  member public.clinic_members;
begin
  perform public.team_actor(p_clinic_id, p_actor_id);
  delete from public.clinic_members as m
   where m.id = p_member_id and m.clinic_id = p_clinic_id and m.status = 'INVITED'
  returning * into member;
  if member.id is null then
    raise exception 'No open invite' using hint = 'INVITE_CHANGED';
  end if;
  return member;
end;
$$;

-- ------------------------------------------------------------
-- 3. Accepting (the accept screen, R3.5)
-- ------------------------------------------------------------

-- What an invite's link opens onto, before anything is changed: the clinic,
-- the role, who it is for, and whether it has run out. None for a link that
-- names no open invite.
create or replace function public.find_invite(p_token_hash text)
returns table (
  member_id uuid,
  user_id uuid,
  clinic_name text,
  role text,
  full_name text,
  email text,
  expired boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.user_id, c.name, m.role, p.full_name, p.email::text, m.invite_expires_at < now()
    from public.clinic_members as m
    join public.clinics as c on c.id = m.clinic_id
    join public.profiles as p on p.id = m.user_id
   where m.invite_token_hash = p_token_hash and m.status = 'INVITED';
$$;

-- Joins the clinic with a current link, once: the person's name and mobile
-- as they confirm them, and the membership active. The password is set by the
-- server, through the admin API.
create or replace function public.accept_invite(p_token_hash text, p_full_name text, p_phone text)
returns public.clinic_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  member public.clinic_members;
begin
  select * into member from public.clinic_members as m
   where m.invite_token_hash = p_token_hash and m.status = 'INVITED'
   for update;
  if member.id is null then
    raise exception 'No open invite with this link' using hint = 'INVITE_INVALID';
  end if;
  if member.invite_expires_at < now() then
    raise exception 'The invite has run out' using hint = 'INVITE_EXPIRED';
  end if;

  update public.profiles as p set full_name = p_full_name, phone = p_phone where p.id = member.user_id;
  update public.clinic_members as m
     set status = 'ACTIVE', joined_at = now(), invite_token_hash = null
   where m.id = member.id
  returning * into member;
  return member;
end;
$$;

revoke all on function public.team_actor(uuid, uuid) from public, anon, authenticated;
revoke all on function public.check_grantable(public.clinic_members, text[]) from public, anon, authenticated;
revoke all on function public.invite_expiry() from public, anon, authenticated;
revoke all on function public.invite_member(uuid, uuid, uuid, text, text, text, text, text[], jsonb, text)
  from public, anon, authenticated;
revoke all on function public.resend_invite(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.revoke_invite(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.find_invite(text) from public, anon, authenticated;
revoke all on function public.accept_invite(text, text, text) from public, anon, authenticated;
