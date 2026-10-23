import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { archiveExpense, changeExpense, createExpense, getExpenseTotals, listExpenses } from "@/features/expenses/api";
import { monthOf } from "@/features/expenses/month";
import { addDaysKey, addMonthsKey, monthStartKey, todayKey } from "@/lib/dates/calendar";
import { expenseSchema } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  setValidUntil,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Expenses (plan §16; R9.2, D328 – D333), from the feature functions against
 * the local database: added once per key under a category in use, dated
 * today or earlier in the clinic's timezone; a month's list by day, one
 * category's, the archived; the month's totals by category and the whole,
 * archived ones left out; corrected of any month, audited with what
 * changed; archived and restored, audited — within expenses.view, .create
 * and .edit, the clinic and its plan.
 */
type Member = SignedIn & { memberId: string };

let clinic: TestClinic;
let other: TestClinic;
let clerk: Member;
let viewer: Member;
let categories: Record<string, string>;

const today = todayKey();
const month = monthOf(today);
const lastMonth = monthOf(addMonthsKey(monthStartKey(today), -1));
/** A day of this month before today when there is one, else today. */
const earlier = today > month.from ? addDaysKey(today, -1) : today;

const anExpense = (input: Record<string, unknown>) =>
  expenseSchema.parse({ amount: "1000", day: today, method: "CASH", description: "", ...input });
const add = (as: SignedIn, input: Record<string, unknown>, key: string = randomUUID()) =>
  createExpense(as.tenant!, anExpense(input), key, `req_${key}`);

beforeAll(async () => {
  [clinic, other] = await Promise.all([registerClinic({ fullName: "Asha Menon" }), registerClinic()]);
  [clerk, viewer] = await Promise.all([
    addMember(clinic.clinicId, { permissions: ["expenses.view", "expenses.create"] }),
    addMember(clinic.clinicId, { permissions: ["expenses.view"] }),
  ]);
  const { data } = await admin().from("expense_categories").select("id, name").eq("clinic_id", clinic.clinicId);
  categories = Object.fromEntries(data!.map((category) => [category.name, category.id as string]));
});

afterAll(removeAll);

describe("adding an expense (plan §16; D328, D329)", () => {
  it("adds it once per key, received as typed, audited with its values", async () => {
    const key = randomUUID();
    const first = await add(clerk, { categoryId: categories.Supplies, amount: "1,250.50", description: "Gloves" }, key);
    const again = await add(clerk, { categoryId: categories.Supplies, amount: "1,250.50", description: "Gloves" }, key);
    expect(again.expenseId).toBe(first.expenseId);
    const { data: saved } = await admin()
      .from("expenses")
      .select("category_id, description, amount_paise, expense_date, payment_method, created_by, archived_at")
      .eq("id", first.expenseId)
      .single();
    expect(saved).toEqual({
      category_id: categories.Supplies,
      description: "Gloves",
      amount_paise: 125_050,
      expense_date: today,
      payment_method: "CASH",
      created_by: clerk.userId,
      archived_at: null,
    });
    const { data: audit } = await admin().from("audit_logs").select("action, changes").eq("entity_id", first.expenseId);
    expect(audit).toEqual([
      expect.objectContaining({
        action: "CREATE",
        changes: expect.objectContaining({ amount_paise: { from: null, to: 125_050 } }),
      }),
    ]);
  });

  it("is dated today or earlier, never a day to come (D328)", async () => {
    const { error } = await clerk.tenant!.supabase.rpc("create_expense", {
      p_expense: {
        category_id: categories.Rent,
        amount_paise: 100,
        expense_date: addDaysKey(today, 1),
        payment_method: "CASH",
      },
      p_idempotency_key: randomUUID(),
    });
    expect(error?.hint).toBe("VALIDATION_ERROR");
    expect((await add(clerk, { categoryId: categories.Rent, day: addDaysKey(today, -40) })).expenseId).toBeTruthy();
  });

  it("is filed under one of the clinic's categories in use — not an archived one, nor another clinic's", async () => {
    const { data: archived } = await admin()
      .from("expense_categories")
      .insert({ clinic_id: clinic.clinicId, name: "Old uniforms", active: false })
      .select("id")
      .single();
    await expect(add(clerk, { categoryId: archived!.id })).rejects.toMatchObject({
      code: "EXPENSE_CATEGORY_ARCHIVED",
    });
    const { data: theirs } = await admin()
      .from("expense_categories")
      .select("id")
      .eq("clinic_id", other.clinicId)
      .eq("name", "Rent")
      .single();
    await expect(add(clerk, { categoryId: theirs!.id })).rejects.toMatchObject({ code: "EXPENSE_CATEGORY_ARCHIVED" });
  });

  it("is for expenses.create alone, and written through its function only", async () => {
    await expect(add(viewer, { categoryId: categories.Rent })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    const { error } = await clerk.tenant!.supabase.from("expenses").insert({
      clinic_id: clinic.clinicId,
      category_id: categories.Rent,
      amount_paise: 100,
      expense_date: today,
      payment_method: "CASH",
      idempotency_key: randomUUID(),
    });
    expect(error?.code).toBe("42501");
  });
});

describe("a month's expenses and totals (plan §16; D330 – D332)", () => {
  it("lists the month by day, newest first, one category's alone, and totals each category and the whole", async () => {
    const books = await registerClinic();
    const { data } = await admin().from("expense_categories").select("id, name").eq("clinic_id", books.clinicId);
    const own = Object.fromEntries(data!.map((category) => [category.name, category.id as string]));
    const rent = await add(books.owner, { categoryId: own.Rent, amount: "25,000", day: month.from });
    const power = await add(books.owner, { categoryId: own.Electricity, amount: "3,400", day: earlier });
    const gloves = await add(books.owner, { categoryId: own.Supplies, amount: "1,250.50", day: today });
    const kit = await add(books.owner, { categoryId: own.Supplies, amount: "799.50", day: today });
    // Last month's, and one archived: in neither the list nor the totals.
    await add(books.owner, { categoryId: own.Rent, amount: "25,000", day: lastMonth.to });
    const gone = await add(books.owner, { categoryId: own.Rent, amount: "99", day: today });
    await archiveExpense(books.owner.tenant, gone.expenseId, { archived: true });

    const listed = await listExpenses(books.owner.tenant, { ...month, archived: false });
    const days = listed.items.map((expense) => expense.day);
    expect([...days].sort().reverse()).toEqual(days);
    expect(listed.items.map((expense) => expense.id)).toEqual(
      expect.arrayContaining([rent.expenseId, power.expenseId, gloves.expenseId, kit.expenseId]),
    );
    expect(listed.items).toHaveLength(4);
    // Today's, the latest added first.
    expect(listed.items.slice(0, 2).map((expense) => expense.id)).toEqual([kit.expenseId, gloves.expenseId]);

    const supplies = await listExpenses(books.owner.tenant, { ...month, categoryId: own.Supplies, archived: false });
    expect(supplies.items.map((expense) => expense.id)).toEqual([kit.expenseId, gloves.expenseId]);
    const archived = await listExpenses(books.owner.tenant, { ...month, archived: true });
    expect(archived.items.map((expense) => expense.id)).toEqual([gone.expenseId]);

    expect(await getExpenseTotals(books.owner.tenant, month)).toEqual({
      totalPaise: 2_500_000 + 340_000 + 125_050 + 79_950,
      categories: [
        { id: own.Rent, name: "Rent", totalPaise: 2_500_000 },
        { id: own.Electricity, name: "Electricity", totalPaise: 340_000 },
        { id: own.Supplies, name: "Supplies", totalPaise: 205_000 },
      ],
    });
    expect((await getExpenseTotals(books.owner.tenant, lastMonth)).totalPaise).toBe(2_500_000);
  });

  it("reads none for whoever does not see expenses, and none of another clinic's", async () => {
    const noOne = await addMember(clinic.clinicId, { permissions: ["patients.view"] });
    expect((await listExpenses(noOne.tenant!, { ...month, archived: false })).items).toEqual([]);
    expect(await getExpenseTotals(noOne.tenant!, month)).toEqual({ totalPaise: 0, categories: [] });
    expect((await listExpenses(other.owner.tenant, { ...month, archived: false })).items).toEqual([]);
    expect((await listExpenses(viewer.tenant!, { ...month, archived: false })).items.length).toBeGreaterThan(0);
  });
});

describe("correcting, archiving and restoring (plan §16; D331, D333)", () => {
  it("corrects one of any month — its own category kept though archived since — audited with what changed", async () => {
    const owner = clinic.owner;
    const { data: fading } = await admin()
      .from("expense_categories")
      .insert({ clinic_id: clinic.clinicId, name: "Courier" })
      .select("id")
      .single();
    const { expenseId } = await add(owner, { categoryId: fading!.id, amount: "450", day: lastMonth.from });
    await admin().from("expense_categories").update({ active: false }).eq("id", fading!.id);

    await changeExpense(
      owner.tenant,
      expenseId,
      anExpense({ categoryId: fading!.id, amount: "480", day: lastMonth.from }),
      "req_fix",
    );
    const { data: audit } = await admin().from("audit_logs").select("action, changes").eq("request_id", "req_fix");
    expect(audit).toEqual([{ action: "UPDATE", changes: { amount_paise: { from: 45_000, to: 48_000 } } }]);
    const { data: saved } = await admin().from("expenses").select("updated_by").eq("id", expenseId).single();
    expect(saved).toEqual({ updated_by: owner.userId });

    // Moved to another category in use; never to an archived one.
    await changeExpense(
      owner.tenant,
      expenseId,
      anExpense({ categoryId: categories.Other, amount: "480", day: lastMonth.from }),
    );
    await expect(
      changeExpense(owner.tenant, expenseId, anExpense({ categoryId: fading!.id, amount: "480", day: lastMonth.from })),
    ).rejects.toMatchObject({ code: "EXPENSE_CATEGORY_ARCHIVED" });
    // Nor dated a day to come — the database's word too.
    const { error } = await owner.tenant.supabase.rpc("change_expense", {
      p_expense_id: expenseId,
      p_expense: {
        category_id: categories.Other,
        amount_paise: 48_000,
        expense_date: addDaysKey(today, 1),
        payment_method: "CASH",
      },
    });
    expect(error?.hint).toBe("VALIDATION_ERROR");
  });

  it("archives one — out of the totals — refuses correcting it then, and restores it, each audited once", async () => {
    const owner = clinic.owner;
    const { expenseId } = await add(owner, { categoryId: categories.Marketing, amount: "2,000" });
    const before = (await getExpenseTotals(owner.tenant, month)).totalPaise;
    await archiveExpense(owner.tenant, expenseId, { archived: true }, "req_arch");
    await archiveExpense(owner.tenant, expenseId, { archived: true }, "req_arch_again");
    expect((await getExpenseTotals(owner.tenant, month)).totalPaise).toBe(before - 200_000);
    const { data: stamped } = await admin().from("expenses").select("archived_by").eq("id", expenseId).single();
    expect(stamped).toEqual({ archived_by: owner.userId });
    await expect(
      changeExpense(owner.tenant, expenseId, anExpense({ categoryId: categories.Marketing })),
    ).rejects.toMatchObject({ code: "EXPENSE_ARCHIVED" });

    await archiveExpense(owner.tenant, expenseId, { archived: false }, "req_back");
    expect((await getExpenseTotals(owner.tenant, month)).totalPaise).toBe(before);
    const { data: audit } = await admin()
      .from("audit_logs")
      .select("action, request_id")
      .eq("entity_id", expenseId)
      .in("action", ["ARCHIVE", "RESTORE"]);
    expect(audit?.map(({ action, request_id }) => [action, request_id])).toEqual(
      expect.arrayContaining([
        ["ARCHIVE", "req_arch"],
        ["RESTORE", "req_back"],
      ]),
    );
    expect(audit).toHaveLength(2);
  });

  it("is for expenses.edit alone, and touches no other clinic's", async () => {
    const { expenseId } = await add(clerk, { categoryId: categories.Rent });
    await expect(
      changeExpense(clerk.tenant!, expenseId, anExpense({ categoryId: categories.Rent })),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    await expect(archiveExpense(clerk.tenant!, expenseId, { archived: true })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    await expect(archiveExpense(other.owner.tenant, expenseId, { archived: true })).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
    const { data: kept } = await admin().from("expenses").select("archived_at").eq("id", expenseId).single();
    expect(kept).toEqual({ archived_at: null });
  });
});

describe("a view-only clinic's expenses (plan §7.2)", () => {
  it("refuses every expense write, changing nothing, and still reads them", async () => {
    const lapsed = await registerClinic();
    const { data } = await admin()
      .from("expense_categories")
      .select("id")
      .eq("clinic_id", lapsed.clinicId)
      .eq("name", "Rent")
      .single();
    const { expenseId } = await add(lapsed.owner, { categoryId: data!.id, amount: "500" });
    await setValidUntil(lapsed.clinicId, addDaysKey(today, -PLATFORM_SETTING_DEFAULTS.graceDays - 30));
    for (const write of [
      () => add(lapsed.owner, { categoryId: data!.id }),
      () => changeExpense(lapsed.owner.tenant, expenseId, anExpense({ categoryId: data!.id, amount: "1" })),
      () => archiveExpense(lapsed.owner.tenant, expenseId, { archived: true }),
    ]) {
      await expect(write()).rejects.toMatchObject({ code: "CLINIC_PLAN_EXPIRED" });
    }
    const { data: kept } = await admin()
      .from("expenses")
      .select("amount_paise, archived_at")
      .eq("id", expenseId)
      .single();
    expect(kept).toEqual({ amount_paise: 50_000, archived_at: null });
    expect((await getExpenseTotals(lapsed.owner.tenant, month)).totalPaise).toBe(50_000);
  });
});
