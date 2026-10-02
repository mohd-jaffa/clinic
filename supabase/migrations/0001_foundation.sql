-- ============================================================
-- 0001 · Foundation (plan §29, tracker R1.1).
--
-- 1. The extensions the schema is built on, in the `extensions` schema as
--    Supabase keeps them: case-blind emails (citext), patient search
--    (pg_trgm), the double-booking exclusion (btree_gist), the scheduler and
--    its HTTP calls (pg_cron, pg_net — AGENTS.md §21), and pgcrypto.
-- 2. Nothing is open by default. Supabase's own default privileges hand
--    `anon` and `authenticated` TRUNCATE, REFERENCES and TRIGGER on every new
--    table, and PostgreSQL gives PUBLIC — `anon` included — EXECUTE on every
--    new function. Both are taken back here, so a table or function reaches
--    an API role only through the explicit GRANT its migration writes
--    (plan §27.2: `anon` has no table access).
-- 3. `set_updated_at()`, the trigger every table with `updated_at` uses, and
--    `set_actor()`, which every table with `created_by`/`updated_by` uses.
-- 4. Text hygiene: what the database can check of the normalising the app
--    does before it stores text (src/lib/text/normalise.ts, AGENTS.md §24),
--    so a write that skips the app cannot store a blank name, a name of
--    spaces, invisible characters or more than its form allows.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extensions
-- ------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ------------------------------------------------------------
-- 2. Nothing open by default
-- ------------------------------------------------------------

-- Global: PostgreSQL's own default of EXECUTE for PUBLIC on every function.
alter default privileges for role postgres revoke execute on functions from public;

-- In public: what Supabase grants the API roles on every new object.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- The server's own role reaches everything; RLS does not bind it (plan §27.5).
alter default privileges for role postgres in schema public grant all on tables to service_role;
alter default privileges for role postgres in schema public grant all on sequences to service_role;
alter default privileges for role postgres in schema public grant execute on functions to service_role;

grant usage on schema public to authenticated, service_role;

-- ------------------------------------------------------------
-- 3. updated_at
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Who wrote a row (plan §27.4): `created_by` and `updated_by` are the signed-in
-- caller, whatever a client sent, and a signed-in caller never changes
-- `created_by` after. A write the server makes as itself has no caller: it
-- names the person itself (registration), or clears a name whose account was
-- deleted (`on delete set null`).
create or replace function public.set_actor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = coalesce(auth.uid(), new.created_by);
  elsif auth.uid() is not null then
    new.created_by = old.created_by;
  end if;
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 4. Text hygiene
--
-- Each is true for NULL, so an optional column uses the same check as a
-- required one and `not null` says whether it may be missing.
-- ------------------------------------------------------------

-- One line — a name, a city, a reference: 1 to max_length characters, trimmed,
-- composed (NFC), with no control character (so no line break or tab) and no
-- zero-width character. normaliseLine() produces exactly this.
create or replace function public.is_clean_line(value text, max_length integer)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select value is null or (
    char_length(value) between 1 and max_length
    and value = btrim(value)
    and value is nfc normalized
    and value !~ '[\x01-\x1f\x7f-\x9f​-‍﻿]'
  );
$$;

-- Several lines — an address, notes: as a line, but line breaks are allowed
-- (plain \n only: normaliseLines() turns \r\n into \n and tabs into spaces), and
-- the whole is trimmed of spaces and breaks at both ends.
create or replace function public.is_clean_text(value text, max_length integer)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select value is null or (
    char_length(value) between 1 and max_length
    and value = btrim(value, E' \n')
    and value is nfc normalized
    and value !~ '[\x01-\x09\x0b-\x1f\x7f-\x9f​-‍﻿]'
  );
$$;

-- An Indian mobile, as src/lib/phone.ts stores it: +91 and ten digits, 6-9 first.
create or replace function public.is_indian_mobile(value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select value is null or value ~ '^\+91[6-9][0-9]{9}$';
$$;

-- A phone number as a person writes it, mobile or landline — "0484 234 5678",
-- "+91 98765 43210", "(0484) 2345678": digits with spaces, hyphens and
-- brackets, 6 to 15 digits in all, at most 20 characters. A clinic's own phone
-- is printed as the clinic wrote it (plan §9), so it is kept as typed.
create or replace function public.is_phone_number(value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select value is null or (
    char_length(value) <= 20
    and value ~ '^\+?[0-9(][0-9 ()-]*[0-9]$'
    and char_length(regexp_replace(value, '[^0-9]', '', 'g')) between 6 and 15
  );
$$;

-- An email address's shape, as the app's EMAIL pattern checks it, within 254.
create or replace function public.is_email(value text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select value is null or (char_length(value) <= 254 and value ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');
$$;

-- CHECK constraints call these as whoever writes the row, so a signed-in member
-- writing through RLS needs EXECUTE; they read nothing and change nothing.
grant execute on function public.is_clean_line(text, integer) to authenticated;
grant execute on function public.is_clean_text(text, integer) to authenticated;
grant execute on function public.is_indian_mobile(text) to authenticated;
grant execute on function public.is_phone_number(text) to authenticated;
grant execute on function public.is_email(text) to authenticated;
