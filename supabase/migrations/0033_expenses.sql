-- ============================================================
-- 0033 · Expenses (plan §16, §28.6; tracker R9.1, D40, D328 – D333, D343,
-- D344).
--
-- 1. `expenses`: what the clinic spent — filed under one of its own
--    categories (D40), its amount, its day (today or earlier in the
--    clinic's timezone, never one to come, D328), how it was paid, and an
--    optional description (D329). Archived, never deleted: an archived
--    expense leaves the totals and may be restored (D331). Any expense, of
--    any month, may be corrected (D333).
-- 2. create_expense (expenses.create): once per idempotency key, under an
--    active category.
-- 3. change_expense (expenses.edit): its category, amount, day, method and
--    description; refused once archived. It hands back what it was and
--    what it is, for the audit row.
-- 4. archive_expense (expenses.edit): archives an expense, or restores one.
-- 5. expense_totals: the month's total and each category's, archived ones
--    left out (D330, D331), worked out in SQL.
--
-- Read through its policy (expenses.view); written only through the
-- functions, each checking the permission and that the clinic can write.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Expenses
-- ------------------------------------------------------------

-- An expense's category is the clinic's own.
alter table public.expense_categories add constraint expense_categories_id_clinic_id_key unique (id, clinic_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  category_id uuid not null,
  -- "AC repair, room 2" — the category says enough for Rent (D329).
  description text check (public.is_clean_line(description, 120)),
  -- Within MAX_AMOUNT_PAISE; never nothing.
  amount_paise integer not null check (amount_paise between 1 and 100000000),
  -- Its day in the clinic's timezone: today or earlier (D328), checked by the functions.
  expense_date date not null,
  payment_method text not null check (payment_method in ('CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER')),
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  -- A double tap makes one expense.
  idempotency_key uuid not null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  unique (clinic_id, idempotency_key),
  foreign key (category_id, clinic_id) references public.expense_categories (id, clinic_id)
);

-- Every read leads with the clinic (plan §37.1): a month's expenses, newest
-- first (D332); one category's (D330); the month's archived ones (D331).
create index expenses_clinic_id_expense_date_idx on public.expenses (clinic_id, expense_date desc, created_at desc)
  where archived_at is null;
create index expenses_clinic_id_category_id_idx
  on public.expenses (clinic_id, category_id, expense_date desc, created_at desc);
create index expenses_clinic_id_archived_idx on public.expenses (clinic_id, expense_date desc, created_at desc)
  where archived_at is not null;
create index expenses_created_by_idx on public.expenses (created_by);
create index expenses_updated_by_idx on public.expenses (updated_by);
create index expenses_archived_by_idx on public.expenses (archived_by) where archived_by is not null;

create trigger set_expenses_updated_at before update on public.expenses
for each row execute function public.set_updated_at();
create trigger set_expenses_actor before insert or update on public.expenses
for each row execute function public.set_actor();

alter table public.expenses enable row level security;

grant select on public.expenses to authenticated;

-- Read by whoever sees expenses; written only through the functions below.
create policy expenses_select on public.expenses
for select to authenticated
using (
  clinic_id = (select public.current_clinic_id())
  and (select public.has_permission('expenses.view'))
);

-- ------------------------------------------------------------
-- 2. Adding an expense (plan §16; D328, D329)
-- ------------------------------------------------------------

-- An expense (expenses.create), while the clinic can write: `p_expense`
-- names its category — one of the clinic's, in use — its amount, its day —
-- today or earlier in the clinic's timezone — how it was paid, and a
-- description, if any. Once per idempotency key. Hands back the expense and
-- whether this call added it.
create or replace function public.create_expense(p_expense jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  given public.expenses := jsonb_populate_record(null::public.expenses, p_expense);
  made public.expenses;
begin
  if clinic is null or not public.has_permission('expenses.create') then
    raise exception 'An expense needs expenses.create' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  if p_idempotency_key is null then
    raise exception 'An expense needs its idempotency key' using hint = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  perform public.require_clinic_write(clinic);

  perform pg_advisory_xact_lock(hashtextextended(clinic::text || ':' || p_idempotency_key::text, 0));
  select * into made
    from public.expenses as expense
   where expense.clinic_id = clinic and expense.idempotency_key = p_idempotency_key;
  if made.id is not null then
    return jsonb_build_object('expense_id', made.id, 'created', false);
  end if;

  if not exists (
    select 1
      from public.expense_categories as category
     where category.id = given.category_id and category.clinic_id = clinic and category.active
  ) then
    raise exception 'Not one of the clinic''s categories in use' using hint = 'EXPENSE_CATEGORY_ARCHIVED';
  end if;
  if given.expense_date is null or given.expense_date > public.clinic_today(clinic) then
    raise exception 'An expense is dated today or earlier' using hint = 'VALIDATION_ERROR';
  end if;

  insert into public.expenses (
    clinic_id, category_id, description, amount_paise, expense_date, payment_method, idempotency_key
  )
  values (
    clinic, given.category_id, given.description, given.amount_paise, given.expense_date, given.payment_method,
    p_idempotency_key
  )
  returning * into made;
  return jsonb_build_object('expense_id', made.id, 'created', true);
end;
$$;

-- ------------------------------------------------------------
-- 3. Correcting an expense (plan §16; D333)
-- ------------------------------------------------------------

-- An expense of any month corrected (expenses.edit), while the clinic can
-- write and it is not archived: its category — one in use, unless it keeps
-- its own — amount, day (today or earlier), method and description. Hands
-- back each of them as it was and as it is, for the audit row.
create or replace function public.change_expense(p_expense_id uuid, p_expense jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  given public.expenses := jsonb_populate_record(null::public.expenses, p_expense);
  found public.expenses;
  made public.expenses;
begin
  if clinic is null or not public.has_permission('expenses.edit') then
    raise exception 'Correcting an expense needs expenses.edit' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  perform public.require_clinic_write(clinic);
  select * into found
    from public.expenses as expense
   where expense.id = p_expense_id and expense.clinic_id = clinic
   for update;
  if found.id is null then
    raise exception 'No such expense' using hint = 'RECORD_NOT_FOUND';
  end if;
  if found.archived_at is not null then
    raise exception 'An archived expense is restored first' using hint = 'EXPENSE_ARCHIVED';
  end if;
  if given.category_id is distinct from found.category_id and not exists (
    select 1
      from public.expense_categories as category
     where category.id = given.category_id and category.clinic_id = clinic and category.active
  ) then
    raise exception 'Not one of the clinic''s categories in use' using hint = 'EXPENSE_CATEGORY_ARCHIVED';
  end if;
  if given.expense_date is null or given.expense_date > public.clinic_today(clinic) then
    raise exception 'An expense is dated today or earlier' using hint = 'VALIDATION_ERROR';
  end if;

  update public.expenses
     set category_id = given.category_id,
         description = given.description,
         amount_paise = given.amount_paise,
         expense_date = given.expense_date,
         payment_method = given.payment_method
   where id = found.id
  returning * into made;
  return jsonb_build_object(
    'before', jsonb_build_object(
      'category_id', found.category_id, 'description', found.description, 'amount_paise', found.amount_paise,
      'expense_date', found.expense_date, 'payment_method', found.payment_method
    ),
    'after', jsonb_build_object(
      'category_id', made.category_id, 'description', made.description, 'amount_paise', made.amount_paise,
      'expense_date', made.expense_date, 'payment_method', made.payment_method
    )
  );
end;
$$;

-- ------------------------------------------------------------
-- 4. Archiving and restoring (plan §16; D331)
-- ------------------------------------------------------------

-- An expense archived — it leaves the totals — or restored (expenses.edit),
-- while the clinic can write. Hands back whether it was archived before.
create or replace function public.archive_expense(p_expense_id uuid, p_archived boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic uuid := public.current_clinic_id();
  found public.expenses;
begin
  if clinic is null or not public.has_permission('expenses.edit') then
    raise exception 'Archiving an expense needs expenses.edit' using hint = 'AUTH_PERMISSION_DENIED';
  end if;
  if p_archived is null then
    raise exception 'Archived or restored' using hint = 'VALIDATION_ERROR';
  end if;
  perform public.require_clinic_write(clinic);
  select * into found
    from public.expenses as expense
   where expense.id = p_expense_id and expense.clinic_id = clinic
   for update;
  if found.id is null then
    raise exception 'No such expense' using hint = 'RECORD_NOT_FOUND';
  end if;
  if (found.archived_at is not null) <> p_archived then
    update public.expenses
       set archived_at = case when p_archived then now() end,
           archived_by = case when p_archived then auth.uid() end
     where id = found.id;
  end if;
  return jsonb_build_object('previously', found.archived_at is not null);
end;
$$;

revoke all on function public.create_expense(jsonb, uuid) from public, anon;
revoke all on function public.change_expense(uuid, jsonb) from public, anon;
revoke all on function public.archive_expense(uuid, boolean) from public, anon;
grant execute on function public.create_expense(jsonb, uuid) to authenticated;
grant execute on function public.change_expense(uuid, jsonb) to authenticated;
grant execute on function public.archive_expense(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- 5. A month's totals (plan §16; D330, D331)
-- ------------------------------------------------------------

-- The expenses of `p_from` to `p_to`, archived ones left out (D331): each
-- category's total, by the category's place in the clinic's list, then the
-- whole — the row with no category. Read as the caller, so expenses.view
-- holds; served by the index of the expenses in use by day.
create or replace function public.expense_totals(p_from date, p_to date)
returns table (category_id uuid, category_name text, total_paise bigint)
language sql
stable
set search_path = ''
as $$
  select category.id, category.name, sum(expense.amount_paise)::bigint
    from public.expenses as expense
    join public.expense_categories as category on category.id = expense.category_id
   where expense.clinic_id = (select public.current_clinic_id())
     and expense.archived_at is null
     and expense.expense_date between p_from and p_to
   group by grouping sets ((category.id, category.name, category.position), ())
   order by grouping(category.id), min(category.position), category.name;
$$;

revoke all on function public.expense_totals(date, date) from public, anon;
grant execute on function public.expense_totals(date, date) to authenticated;
