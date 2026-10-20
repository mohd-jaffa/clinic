import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BillListItem } from "@/features/billing/types";

const { list } = vi.hoisted(() => ({
  list: { current: {} as { data?: unknown }, asked: vi.fn() },
}));
vi.mock("@/features/billing/hooks/useBills", () => ({
  useBills: (...args: unknown[]) => {
    list.asked(...args);
    return list.current;
  },
}));

const { BillsList } = await import("@/features/billing/components/BillsList");

const bill: BillListItem = {
  id: "b-1",
  number: "2026-27/0042",
  issuedAt: "2020-01-14T05:30:00Z",
  totalPaise: 90_000,
  patient: { id: "p-1", name: "Asha Rao", number: 1042 },
  settlement: { paidPaise: 50_000, duePaise: 40_000 },
  state: "PART_PAID",
};
const range = { kind: "TODAY" as const, from: "2026-10-19", to: "2026-10-19" };

beforeEach(() => {
  vi.clearAllMocks();
  list.current = { data: [bill, { ...bill, id: "b-2", state: "VOID", settlement: null }] };
});

describe("BillsList (plan §15.4; D320)", () => {
  it("lists the bills of the days picked — patient, number, day, total and state — each opening its page", () => {
    render(<BillsList range={range} onRange={vi.fn()} shown="ALL" onShown={vi.fn()} />);
    expect(list.asked).toHaveBeenLastCalledWith({ kind: "TODAY", from: "2026-10-19", to: "2026-10-19" }, undefined);
    const [partPaid, voided] = within(screen.getByRole("list", { name: "Bills" })).getAllByRole("listitem");
    expect(partPaid).toHaveTextContent("2026-27/0042 · 14 Jan 2020");
    expect(partPaid).toHaveTextContent("₹900");
    expect(within(partPaid).getByText("Part paid")).toBeInTheDocument();
    expect(within(partPaid).getByRole("link", { name: /^Asha Rao/ })).toHaveAttribute("href", "/bills/b-1");
    expect(within(voided).getByText("Void")).toBeInTheDocument();
  });

  it("keeps to a state, and picks other days", async () => {
    const onShown = vi.fn();
    const onRange = vi.fn();
    const { rerender } = render(<BillsList range={range} onRange={onRange} shown="ALL" onShown={onShown} />);
    await userEvent.click(screen.getByRole("radio", { name: "Unpaid" }));
    expect(onShown).toHaveBeenCalledWith("UNPAID");
    rerender(<BillsList range={range} onRange={onRange} shown="UNPAID" onShown={onShown} />);
    expect(list.asked).toHaveBeenLastCalledWith(range, "UNPAID");
    await userEvent.click(screen.getByRole("radio", { name: "This month" }));
    expect(onRange).toHaveBeenCalledWith(expect.objectContaining({ kind: "MONTH" }));
  });

  it("says when no bill was issued on those days", () => {
    list.current = { data: [] };
    render(<BillsList range={range} onRange={vi.fn()} shown="ALL" onShown={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "No bills on these days" })).toBeInTheDocument();
  });
});
