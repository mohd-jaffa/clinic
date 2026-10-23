// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import type { ExpensePayload } from "@/lib/validation";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe } = vi.hoisted(() => ({ logActionSafe: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));

const { archiveExpense, changeExpense, createExpense, getExpenseTotals, listExpenses } =
  await import("@/features/expenses/api");

function tenantWith(options: FakeSupabaseOptions) {
  const fake = fakeSupabase(options);
  const tenant = { supabase: fake.client, clinicId: "clinic-1", actorId: "user-1" } as unknown as Tenant;
  return { ...fake, tenant };
}

const refused = (hint: string) => ({ error: { ...postgrestError("P0001"), hint } });

const row = {
  id: "e-1",
  description: "AC repair, room 2",
  amount_paise: 180_000,
  expense_date: "2026-10-23",
  payment_method: "CASH",
  archived_at: null,
  category: { id: "c-1", name: "Maintenance" },
};

const expense: ExpensePayload = {
  categoryId: "c-1",
  amountPaise: 180_000,
  day: "2026-10-23",
  method: "CASH",
  description: "AC repair, room 2",
};
const columns = {
  category_id: "c-1",
  description: "AC repair, room 2",
  amount_paise: 180_000,
  expense_date: "2026-10-23",
  payment_method: "CASH",
};

beforeEach(() => vi.clearAllMocks());

describe("listExpenses (plan §16; D330 – D332)", () => {
  it("reads a page of a month's expenses in use, newest first, with each one's category, in one query", async () => {
    const { tenant, queries } = tenantWith({ answer: () => ({ data: [row] }) });
    expect(await listExpenses(tenant, { from: "2026-10-01", to: "2026-10-31", archived: false, cursor: 20 })).toEqual({
      items: [
        {
          id: "e-1",
          category: { id: "c-1", name: "Maintenance" },
          description: "AC repair, room 2",
          amountPaise: 180_000,
          day: "2026-10-23",
          method: "CASH",
          archivedAt: null,
        },
      ],
      nextCursor: null,
    });
    expect(queries[0].table).toBe("expenses");
    expect(queries[0].calls).toEqual([
      ["select", expect.stringContaining("category:expense_categories!expenses_category_id_clinic_id_fkey(id, name)")],
      ["eq", "clinic_id", "clinic-1"],
      ["gte", "expense_date", "2026-10-01"],
      ["lte", "expense_date", "2026-10-31"],
      ["is", "archived_at", null],
      ["order", "expense_date", { ascending: false }],
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
      ["range", 20, 40],
    ]);
  });

  it("keeps to one category, or to the archived, from the first page — and says what it was refused", async () => {
    const { tenant, queries } = tenantWith({ answer: () => ({ data: [] }) });
    await listExpenses(tenant, { from: "2026-10-01", to: "2026-10-31", categoryId: "c-1", archived: true });
    expect(queries[0].calls).toEqual(
      expect.arrayContaining([
        ["not", "archived_at", "is", null],
        ["eq", "category_id", "c-1"],
        ["range", 0, 20],
      ]),
    );
    const down = tenantWith({ answer: () => ({ error: postgrestError("XX000") }) });
    await expect(
      listExpenses(down.tenant, { from: "2026-10-01", to: "2026-10-31", archived: false }),
    ).rejects.toBeDefined();
  });
});

describe("getExpenseTotals (plan §16; D330, D331)", () => {
  it("reads the month's total and each category's from expense_totals", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({
        data: [
          { category_id: "c-1", category_name: "Rent", total_paise: 2_500_000 },
          { category_id: "c-2", category_name: "Supplies", total_paise: 125_050 },
          { category_id: null, category_name: null, total_paise: 2_625_050 },
        ],
      }),
    });
    expect(await getExpenseTotals(tenant, { from: "2026-10-01", to: "2026-10-31" })).toEqual({
      totalPaise: 2_625_050,
      categories: [
        { id: "c-1", name: "Rent", totalPaise: 2_500_000 },
        { id: "c-2", name: "Supplies", totalPaise: 125_050 },
      ],
    });
    expect(rpcs).toEqual([{ name: "expense_totals", args: { p_from: "2026-10-01", p_to: "2026-10-31" } }]);
  });

  it("is nothing for a month with none, and says what it was refused", async () => {
    const none = tenantWith({ rpc: () => ({ data: null }) });
    expect(await getExpenseTotals(none.tenant, { from: "2026-10-01", to: "2026-10-31" })).toEqual({
      totalPaise: 0,
      categories: [],
    });
    const { tenant } = tenantWith({ rpc: () => ({ error: postgrestError("42501") }) });
    await expect(getExpenseTotals(tenant, { from: "2026-10-01", to: "2026-10-31" })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});

describe("createExpense (plan §16; D328, D329)", () => {
  it("adds it through create_expense once per key, audited with its values when this call added it", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => ({ data: { expense_id: "e-1", created: true } }) });
    expect(await createExpense(tenant, expense, "key-1", "req_e")).toEqual({ expenseId: "e-1" });
    expect(rpcs).toEqual([{ name: "create_expense", args: { p_expense: columns, p_idempotency_key: "key-1" } }]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "CREATE",
      entityType: "expenses",
      entityId: "e-1",
      changes: Object.fromEntries(
        Object.entries(columns).map(([column, value]) => [column, { from: null, to: value }]),
      ),
      requestId: "req_e",
    });
  });

  it("audits nothing for a repeat, and says what it was refused", async () => {
    const again = tenantWith({ rpc: () => ({ data: { expense_id: "e-1", created: false } }) });
    await createExpense(again.tenant, expense, "key-1");
    expect(logActionSafe).not.toHaveBeenCalled();
    const { tenant } = tenantWith({ rpc: () => refused("EXPENSE_CATEGORY_ARCHIVED") });
    await expect(createExpense(tenant, expense, "key-1")).rejects.toMatchObject({ code: "EXPENSE_CATEGORY_ARCHIVED" });
  });
});

describe("changeExpense (plan §16; D333)", () => {
  it("corrects it through change_expense, audited with what changed, from what to what", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({ data: { before: { ...columns, amount_paise: 150_000 }, after: columns } }),
    });
    expect(await changeExpense(tenant, "e-1", expense, "req_c")).toEqual({ expenseId: "e-1" });
    expect(rpcs).toEqual([{ name: "change_expense", args: { p_expense_id: "e-1", p_expense: columns } }]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "UPDATE",
      entityType: "expenses",
      entityId: "e-1",
      changes: { amount_paise: { from: 150_000, to: 180_000 } },
      requestId: "req_c",
    });
  });

  it("audits nothing when nothing changed, and says what it was refused", async () => {
    const same = tenantWith({ rpc: () => ({ data: { before: columns, after: columns } }) });
    await changeExpense(same.tenant, "e-1", expense);
    expect(logActionSafe).not.toHaveBeenCalled();
    const { tenant } = tenantWith({ rpc: () => refused("EXPENSE_ARCHIVED") });
    await expect(changeExpense(tenant, "e-1", expense)).rejects.toMatchObject({ code: "EXPENSE_ARCHIVED" });
  });
});

describe("archiveExpense (plan §16; D331)", () => {
  it("archives or restores it through archive_expense, audited when it changed", async () => {
    const archiving = tenantWith({ rpc: () => ({ data: { previously: false } }) });
    expect(await archiveExpense(archiving.tenant, "e-1", { archived: true }, "req_a")).toEqual({
      expenseId: "e-1",
      archived: true,
    });
    expect(archiving.rpcs).toEqual([{ name: "archive_expense", args: { p_expense_id: "e-1", p_archived: true } }]);
    expect(logActionSafe).toHaveBeenCalledWith(archiving.tenant, {
      action: "ARCHIVE",
      entityType: "expenses",
      entityId: "e-1",
      requestId: "req_a",
    });
    const restoring = tenantWith({ rpc: () => ({ data: { previously: true } }) });
    await archiveExpense(restoring.tenant, "e-1", { archived: false });
    expect(logActionSafe).toHaveBeenLastCalledWith(restoring.tenant, expect.objectContaining({ action: "RESTORE" }));
  });

  it("audits nothing when it already was, and says what it was refused", async () => {
    const already = tenantWith({ rpc: () => ({ data: { previously: true } }) });
    await archiveExpense(already.tenant, "e-1", { archived: true });
    expect(logActionSafe).not.toHaveBeenCalled();
    const { tenant } = tenantWith({ rpc: () => refused("RECORD_NOT_FOUND") });
    await expect(archiveExpense(tenant, "e-1", { archived: true })).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
  });
});
