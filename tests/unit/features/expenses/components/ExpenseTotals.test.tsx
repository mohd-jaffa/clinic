import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Providers } from "@tests/support/providers";

const { totals } = vi.hoisted(() => ({
  totals: { current: {} as { data?: unknown; error?: unknown; mutate?: () => void } },
}));
vi.mock("@/features/expenses/hooks/useExpenseTotals", () => ({ useExpenseTotals: () => totals.current }));

const { ExpenseTotals } = await import("@/features/expenses/components/ExpenseTotals");

const onCategory = vi.fn();
const october = { from: "2026-10-01", to: "2026-10-31" };
const draw = (categoryId = "") =>
  render(<ExpenseTotals range={october} categoryId={categoryId} onCategory={onCategory} />, { wrapper: Providers });

beforeEach(() => {
  vi.clearAllMocks();
  totals.current = {
    data: {
      totalPaise: 2_625_050,
      categories: [
        { id: "c-1", name: "Rent", totalPaise: 2_500_000 },
        { id: "c-2", name: "Supplies", totalPaise: 125_050 },
      ],
    },
  };
});

describe("ExpenseTotals (plan §16; D330, D331)", () => {
  it("says what was spent in the month, and each category's total, tapped to keep the list to it", async () => {
    draw();
    expect(screen.getByText("Spent in October 2026")).toBeInTheDocument();
    expect(screen.getByText("₹26,250.50")).toBeInTheDocument();
    const byCategory = screen.getByRole("list", { name: "By category" });
    const rent = within(byCategory).getByRole("button", { name: "Show only Rent: ₹25,000" });
    expect(rent).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(rent);
    expect(onCategory).toHaveBeenCalledWith("c-1");
    expect(screen.queryByRole("button", { name: "Show all" })).not.toBeInTheDocument();
  });

  it("shows the category kept to, tapped again — or Show all — for every one", async () => {
    draw("c-2");
    const supplies = screen.getByRole("button", { name: "Show only Supplies: ₹1,250.50" });
    expect(supplies).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(supplies);
    expect(onCategory).toHaveBeenLastCalledWith("");
    await userEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(onCategory).toHaveBeenCalledTimes(2);
  });

  it("lists no categories in a month with none, stands in while it loads, and says when it could not", async () => {
    totals.current = { data: { totalPaise: 0, categories: [] } };
    const { unmount } = draw();
    expect(screen.getByText("₹0")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "By category" })).not.toBeInTheDocument();
    unmount();
    totals.current = {};
    const loading = draw();
    expect(screen.getByRole("region", { name: "Loading…" })).toBeInTheDocument();
    loading.unmount();
    const mutate = vi.fn();
    totals.current = { error: new Error("down"), mutate };
    draw();
    expect(screen.getByText("The month's totals couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
  });
});
