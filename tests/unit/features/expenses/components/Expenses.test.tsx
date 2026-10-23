import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Expense } from "@/features/expenses/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, adding, drawn, sheets, categories } = vi.hoisted(() => ({
  categories: { current: [{ id: "c-1", name: "Rent", active: true }] as unknown[] | undefined },
  auth: { current: {} as ReturnType<typeof authStub> },
  adding: { current: { open: false, show: vi.fn(), close: vi.fn() } },
  drawn: { totals: [] as unknown[], lists: [] as unknown[] },
  sheets: [] as { open: boolean; expense?: Expense | null }[],
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/hooks/useAddForm", () => ({ useAddForm: () => adding.current }));
vi.mock("@/features/clinic/hooks/useExpenseCategories", () => ({
  useExpenseCategories: () => ({ data: categories.current }),
}));
vi.mock("@/features/expenses/components/ExpenseTotals", () => ({
  ExpenseTotals: (props: { categoryId: string; onCategory: (id: string) => void }) => {
    drawn.totals.push(props);
    return (
      <button type="button" onClick={() => props.onCategory("c-1")}>
        Rent total
      </button>
    );
  },
}));
const RENT: Expense = {
  id: "e-1",
  category: { id: "c-1", name: "Rent" },
  description: null,
  amountPaise: 100,
  day: "2026-10-01",
  method: "CASH",
  archivedAt: null,
};
vi.mock("@/features/expenses/components/ExpenseList", () => ({
  ExpenseList: (props: { canEdit: boolean; onOpen: (expense: Expense) => void }) => {
    drawn.lists.push(props);
    return (
      <button type="button" onClick={() => props.onOpen(RENT)}>
        Open rent
      </button>
    );
  },
}));
vi.mock("@/features/expenses/components/ExpenseSheet", () => ({
  ExpenseSheet: (props: { open: boolean; expense?: Expense | null }) => {
    sheets.push(props);
    return props.open ? <div role="dialog" aria-label={props.expense ? "Expense" : "Add expense"} /> : null;
  },
}));

const { Expenses } = await import("@/features/expenses/components/Expenses");

const draw = () => render(<Expenses />, { wrapper: Providers });
const lastOf = <T,>(list: T[]) => list.at(-1) as T;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-10-24T06:00:00Z"), toFake: ["Date"] });
  auth.current = authStub();
  adding.current = { open: false, show: vi.fn(), close: vi.fn() };
  drawn.totals = [];
  drawn.lists = [];
  sheets.length = 0;
  categories.current = [{ id: "c-1", name: "Rent", active: true }];
});
afterEach(() => vi.useRealTimers());

describe("Expenses (plan §16; D328 – D333, D344)", () => {
  it("opens on this month, with none after it, and moves back a month — every category again", async () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Expenses" })).toBeInTheDocument();
    expect(screen.getByText("October 2026")).toBeInTheDocument();
    expect(lastOf(drawn.totals)).toMatchObject({ range: { from: "2026-10-01", to: "2026-10-31" }, categoryId: "" });
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Rent total" }));
    expect(lastOf(drawn.lists)).toMatchObject({ categoryId: "c-1", categoryName: "Rent" });
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(lastOf(drawn.lists)).toMatchObject({
      range: { from: "2026-09-01", to: "2026-09-30" },
      categoryId: "",
      categoryName: null,
    });
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("October 2026")).toBeInTheDocument();
  });

  it("adds from Add expense — or the ＋ — and opens a row to correct it, for whoever may (D67, D344)", async () => {
    adding.current = { open: true, show: vi.fn(), close: vi.fn() };
    draw();
    expect(screen.getByRole("dialog", { name: "Add expense" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add expense" }));
    expect(adding.current.show).toHaveBeenCalled();
    expect(lastOf(drawn.lists)).toMatchObject({ canEdit: true });
    await userEvent.click(screen.getByRole("button", { name: "Open rent" }));
    expect(screen.getByRole("dialog", { name: "Expense" })).toBeInTheDocument();
  });

  it("adds and corrects nothing without the permissions, nor in a view-only clinic, which says why", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["expenses.view"] });
    const { unmount } = draw();
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
    expect(lastOf(drawn.lists)).toMatchObject({ canEdit: false });
    expect(sheets).toEqual([]);
    unmount();
    const stub = authStub();
    auth.current = { ...stub, subscription: { ...stub.subscription!, state: "READ_ONLY" } };
    draw();
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
    expect(screen.getByText(/view-only/)).toBeInTheDocument();
  });

  it("waits for the categories without failing, the picked one named once they come", async () => {
    categories.current = undefined;
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Rent total" }));
    expect(lastOf(drawn.lists)).toMatchObject({ categoryId: "c-1", categoryName: null });
  });

  it("asks nothing of someone with no clinic", () => {
    auth.current = { ...authStub(), membership: null };
    draw();
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
  });
});
