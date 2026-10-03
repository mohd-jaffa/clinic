-- ============================================================
-- 0010 · The rules of the clinic's catalogues (plan §9; tracker R3.2,
-- D80 – D83).
--
-- The price list, appointment types and expense categories are written
-- straight to their tables under the 0007 policies. Two rules hold whatever
-- writes them:
--
-- 1. A new appointment type or expense category joins the end of its list
--    (D81): its position is filled in when the insert leaves it out. The
--    seeds of register_clinic give theirs.
-- 2. A clinic keeps at least one (D83): the last active appointment type
--    (booking needs one), the last active expense category (an expense needs
--    one), and the last active service in Consultation (a bill starts from
--    it) cannot be archived — nor that service moved to another category.
-- ============================================================

-- ------------------------------------------------------------
-- 1. New entries join the end (D81)
-- ------------------------------------------------------------

alter table public.appointment_types alter column position drop default;
alter table public.expense_categories alter column position drop default;

-- One past the clinic's last. Two added at the same moment may share a
-- position; they then stand in the order they were added.
create or replace function public.set_catalogue_position()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  execute format('select coalesce(max(t.position), 0) + 1 from public.%I as t where t.clinic_id = $1', tg_table_name)
     into new.position
    using new.clinic_id;
  return new;
end;
$$;

create trigger set_appointment_types_position before insert on public.appointment_types
for each row when (new.position is null) execute function public.set_catalogue_position();
create trigger set_expense_categories_position before insert on public.expense_categories
for each row when (new.position is null) execute function public.set_catalogue_position();

-- ------------------------------------------------------------
-- 2. At least one is kept (D83)
-- ------------------------------------------------------------

-- Refuses a change that would leave the clinic none of what this table keeps
-- (TG_ARGV[0] is the refusal's catalogue code; TG_ARGV[1], when given, the
-- category every other entry is looked for in). The clinic's row is locked
-- first, so two people archiving the last two at once cannot both pass.
create or replace function public.keep_one_catalogue_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  kept boolean;
begin
  perform 1 from public.clinics as c where c.id = old.clinic_id for no key update;

  execute format(
    'select exists (select 1 from public.%I as t where t.clinic_id = $1 and t.id <> $2 and t.active%s)',
    tg_table_name,
    case when tg_nargs > 1 then ' and t.category = $3' else '' end
  )
     into kept
    using old.clinic_id, old.id, tg_argv[1];

  if not kept then
    raise exception 'A clinic keeps at least one of these' using hint = tg_argv[0];
  end if;
  return new;
end;
$$;

revoke all on function public.set_catalogue_position() from public, anon, authenticated;
revoke all on function public.keep_one_catalogue_entry() from public, anon, authenticated;

create trigger keep_one_appointment_type before update of active on public.appointment_types
for each row when (old.active and not new.active)
execute function public.keep_one_catalogue_entry('APPOINTMENT_TYPE_REQUIRED');

create trigger keep_one_expense_category before update of active on public.expense_categories
for each row when (old.active and not new.active)
execute function public.keep_one_catalogue_entry('EXPENSE_CATEGORY_REQUIRED');

create trigger keep_one_consultation_service before update of active, category on public.services
for each row when (old.active and old.category = 'CONSULTATION' and not (new.active and new.category = 'CONSULTATION'))
execute function public.keep_one_catalogue_entry('CONSULTATION_SERVICE_REQUIRED', 'CONSULTATION');
