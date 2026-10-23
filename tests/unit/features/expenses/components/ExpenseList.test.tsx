import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Expense } from "@/features/expenses/types";
import { Providers } from "@tests/support/providers";

type Pages = { data?: unknown; error?: unknown; hasMore?: boolean; loadMore?: () => void; mutate?: () => void };
const { lists, asked, client } = vi.hoisted(() => ({
  lists: { current: {} as Pages, archived: {} as Pages },
  asked: vi.fn(),
  client: { add: vi.fn(), change: vi.fn(), archive: vi.fn() },
}));
vi.mock("@/features/expenses/hooks/useExpenses", () => ({
  useExpenses: (range: unknown, options: { archived?: boolean; enabled?: boolean } = {}) => {
    asked(range, options);
    return options.archived ? lists.archived : lists.current;
  },
}));
vi.mock("@/features/expenses/api.client", () => ({ ExpensesClient: client }));

const { ExpenseList } = await import("@/features/expenses/components/ExpenseList");

const expense = (overrides: Partial<Expense>): Expense => ({
  id: "e-1",
  category: { id: "c-1", name: "Rent" },
  description: null,
  amountPaise: 2_500_000,
  day: "2026-10-01",
  method: "BANK_TRANSFER",
  archivedAt: null,
  ...overrides,
});
const october = { from: "2026-10-01", to: "2026-10-31" };
const onOpen = vi.fn();
const draw = (props: { categoryId?: string; categoryName?: string | null; canEdit?: boolean } = {}) =>
  render(
    <ExpenseList
      range={october}
      categoryId={props.categoryId ?? ""}
      categoryName={props.categoryName ?? null}
      canEdit={props.canEdit ?? true}
      onOpen={onOpen}
    />,
    { wrapper: Providers },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-10-24T06:00:00Z"), toFake: ["Date"] });
  lists.current = {
    data: [
      expense({
        id: "e-3",
        category: { id: "c-2", name: "Supplies" },
        description: "Gloves",
        amountPaise: 125_050,
        day: "2026-10-24",
        method: "UPI",
      }),
      expense({
        id: "e-2",
        category: { id: "c-3", name: "Electricity" },
        amountPaise: 340_000,
        day: "2026-10-24",
        method: "UPI",
      }),
      expense({ id: "e-1" }),
    ],
  };
  lists.archived = { data: [] };
});
afterEach(() => vi.useRealTimers());

describe("ExpenseList (plan §16; D330 – D332, D344)", () => {
  it("groups the month's expenses by day, newest first — Today, 1 Oct — each its category, line and amount", () => {
    draw();
    expect(asked).toHaveBeenCalledWith(october, { categoryId: undefined });
    const today = within(screen.getByRole("list", { name: "Today" })).getAllByRole("listitem");
    expect(today.map((row) => row.textContent)).toEqual(["SuppliesGloves · UPI₹1,250.50", "ElectricityUPI₹3,400"]);
    expect(within(screen.getByRole("list", { name: "1 Oct" })).getByRole("listitem")).toHaveTextContent(
      "RentBank transfer₹25,000",
    );
  });

  it("opens a row's sheet for whoever may correct it, and leaves it as it is for anyone else (D344)", async () => {
    const { unmount } = draw();
    await userEvent.click(within(screen.getByRole("list", { name: "1 Oct" })).getByRole("button", { name: "Rent" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "e-1" }));
    unmount();
    draw({ canEdit: false });
    expect(within(screen.getByRole("list", { name: "1 Oct" })).queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps to the category picked, and says when the month has none of it — or none at all", () => {
    lists.current = { data: [] };
    const { unmount } = draw({ categoryId: "c-2", categoryName: "Supplies" });
    expect(asked).toHaveBeenCalledWith(october, { categoryId: "c-2" });
    expect(screen.getByRole("heading", { name: "No Supplies this month" })).toBeInTheDocument();
    unmount();
    draw();
    expect(screen.getByRole("heading", { name: "No expenses this month" })).toBeInTheDocument();
  });

  it("shows the month's archived when asked — read only then — with Restore for whoever may (D331)", async () => {
    lists.archived = { data: [expense({ id: "e-9", archivedAt: "2026-10-20T05:00:00Z", amountPaise: 99_900 })] };
    draw();
    expect(asked).toHaveBeenCalledWith(october, { categoryId: undefined, archived: true, enabled: false });
    await userEvent.click(screen.getByRole("button", { name: "Show archived" }));
    expect(asked).toHaveBeenLastCalledWith(october, { categoryId: undefined, archived: true, enabled: true });
    const archived = within(screen.getByRole("list", { name: "Show archived" })).getByRole("listitem");
    expect(archived).toHaveTextContent("Rent1 Oct · Bank transfer₹999");
    client.archive.mockResolvedValue({ expenseId: "e-9", archived: false });
    await userEvent.click(within(archived).getByRole("button", { name: "Restore ₹999 for Rent" }));
    expect(client.archive).toHaveBeenCalledWith({ expenseId: "e-9", archived: false });
  });

  it("offers no Restore without leave to correct, and says when nothing is archived", async () => {
    lists.archived = { data: [expense({ id: "e-9", archivedAt: "2026-10-20T05:00:00Z" })] };
    const { unmount } = draw({ canEdit: false });
    await userEvent.click(screen.getByRole("button", { name: "Show archived" }));
    expect(screen.queryByRole("button", { name: /^Restore/ })).not.toBeInTheDocument();
    unmount();
    lists.archived = { data: [] };
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Show archived" }));
    expect(screen.getByText("Nothing archived this month")).toBeInTheDocument();
  });
});
