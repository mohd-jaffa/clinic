import { describe, expect, it } from "vitest";

import { PAYMENT_METHODS } from "@/constants/statuses";
import { isErrorMessageCode } from "@/constants/messages";
import { TEXT_LIMITS } from "@/constants/limits";
import { functionBody, quoted, readMigration } from "@tests/support/sql";

const sql = readMigration("0033_expenses.sql");
const create = functionBody(sql, "create_expense");
const change = functionBody(sql, "change_expense");
const archive = functionBody(sql, "archive_expense");
const totals = functionBody(sql, "expense_totals");

describe("0033 expenses (plan §16, §28.6; D40, D328 – D333)", () => {
  it("files each under one of the clinic's own categories, its amount bounded, its method the app's", () => {
    expect(sql).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(sql).toContain("foreign key (category_id, clinic_id) references public.expense_categories (id, clinic_id)");
    expect(sql).toContain(
      "alter table public.expense_categories add constraint expense_categories_id_clinic_id_key unique (id, clinic_id);",
    );
    expect(sql).toContain("amount_paise integer not null check (amount_paise between 1 and 100000000)");
    expect(sql).toContain(`check (public.is_clean_line(description, ${TEXT_LIMITS.expenseDescription}))`);
    const methods = /payment_method text not null check \(payment_method in \(([^)]+)\)\)/.exec(sql)!;
    expect(quoted(methods[1])).toEqual([...PAYMENT_METHODS]);
    expect(sql).toContain("unique (clinic_id, idempotency_key)");
    expect(sql).toContain("archived_by uuid references public.profiles (id) on delete set null");
  });

  it("indexes a month's expenses by day, a category's, and the archived, and every person on it", () => {
    for (const index of [
      "create index expenses_clinic_id_expense_date_idx on public.expenses (clinic_id, expense_date desc, created_at desc)\n  where archived_at is null;",
      "on public.expenses (clinic_id, category_id, expense_date desc, created_at desc);",
      "create index expenses_clinic_id_archived_idx on public.expenses (clinic_id, expense_date desc, created_at desc)\n  where archived_at is not null;",
      "create index expenses_created_by_idx on public.expenses (created_by);",
      "create index expenses_updated_by_idx on public.expenses (updated_by);",
      "create index expenses_archived_by_idx on public.expenses (archived_by) where archived_by is not null;",
    ]) {
      expect(sql).toContain(index);
    }
  });

  it("is read by whoever sees expenses, and written through its functions only", () => {
    expect(sql).toContain("alter table public.expenses enable row level security;");
    expect(sql).toContain("grant select on public.expenses to authenticated;");
    expect(sql).toContain("and (select public.has_permission('expenses.view'))");
    expect(sql).not.toMatch(/create policy \w+ on public\.expenses\s+for (insert|update|delete)/);
    expect(sql).toContain("for each row execute function public.set_actor();");
  });

  it("adds once per key under a category in use, dated today or earlier in the clinic's timezone (D328)", () => {
    expect(create).toContain("security definer");
    expect(create).toContain("public.has_permission('expenses.create')");
    expect(create).toContain("perform public.require_clinic_write(clinic);");
    expect(create).toContain("expense.idempotency_key = p_idempotency_key");
    expect(create).toContain("category.clinic_id = clinic and category.active");
    expect(create).toContain("given.expense_date > public.clinic_today(clinic)");
  });

  it("corrects one not archived, keeping its own category though archived since, and says what it was (D333)", () => {
    expect(change).toContain("public.has_permission('expenses.edit')");
    expect(change).toContain("perform public.require_clinic_write(clinic);");
    expect(change).toContain("hint = 'EXPENSE_ARCHIVED'");
    expect(change).toContain("given.category_id is distinct from found.category_id and not exists (");
    expect(change).toContain("given.expense_date > public.clinic_today(clinic)");
    expect(change).toContain("'before', jsonb_build_object(");
  });

  it("archives or restores one, stamped with who and when, saying what it was (D331)", () => {
    expect(archive).toContain("public.has_permission('expenses.edit')");
    expect(archive).toContain("perform public.require_clinic_write(clinic);");
    expect(archive).toContain("set archived_at = case when p_archived then now() end,");
    expect(archive).toContain("archived_by = case when p_archived then auth.uid() end");
    expect(archive).toContain("jsonb_build_object('previously', found.archived_at is not null)");
  });

  it("totals the month as the caller, each category and the whole, archived ones left out (D330, D331)", () => {
    expect(totals).not.toContain("security definer");
    expect(totals).toContain("expense.archived_at is null");
    expect(totals).toContain("expense.expense_date between p_from and p_to");
    expect(totals).toContain("group by grouping sets ((category.id, category.name, category.position), ())");
  });

  it("refuses in the app's own words, and is called by members only", () => {
    for (const hint of quoted(sql.match(/hint = '[A-Z_]+'/g)!.join(" "))) {
      expect(isErrorMessageCode(hint), hint).toBe(true);
    }
    for (const signature of [
      "create_expense(jsonb, uuid)",
      "change_expense(uuid, jsonb)",
      "archive_expense(uuid, boolean)",
      "expense_totals(date, date)",
    ]) {
      expect(sql).toContain(`revoke all on function public.${signature} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${signature} to authenticated;`);
    }
  });
});
