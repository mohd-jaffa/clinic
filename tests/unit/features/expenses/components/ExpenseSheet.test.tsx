import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExpenseCategory } from "@/features/clinic/types";
import type { Expense } from "@/features/expenses/types";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { add: vi.fn(), change: vi.fn(), archive: vi.fn() } }));
vi.mock("@/features/expenses/api.client", () => ({ ExpensesClient: client }));

const { ExpenseSheet } = await import("@/features/expenses/components/ExpenseSheet");

const RENT = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a51";
const SUPPLIES = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a52";
const OLD = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a53";
const categories: ExpenseCategory[] = [
  { id: RENT, name: "Rent", active: true },
  { id: SUPPLIES, name: "Supplies", active: true },
  { id: OLD, name: "Uniforms", active: false },
];
const uniforms: Expense = {
  id: "e-1",
  category: { id: OLD, name: "Uniforms" },
  description: "Scrubs",
  amountPaise: 450_000,
  day: "2026-10-03",
  method: "CARD",
  archivedAt: null,
};
const onClose = vi.fn();
const draw = (expense: Expense | null = null) =>
  render(<ExpenseSheet open onClose={onClose} expense={expense} categories={categories} />, { wrapper: Providers });
const field = (name: RegExp) => screen.getByRole("textbox", { name });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-10-24T06:00:00Z"), toFake: ["Date"] });
  client.add.mockResolvedValue({ expenseId: "e-9" });
  client.change.mockResolvedValue({ expenseId: "e-1" });
  client.archive.mockResolvedValue({ expenseId: "e-1", archived: true });
});
afterEach(() => vi.useRealTimers());

describe("ExpenseSheet (plan §16; D328, D329, D343)", () => {
  it("adds one: a category picked from the chips in use, the amount, today unless changed, cash unless changed", async () => {
    draw();
    const sheet = screen.getByRole("dialog", { name: "Add expense" });
    const chips = within(sheet).getByRole("radiogroup", { name: "Category" });
    expect(
      within(chips)
        .getAllByRole("radio")
        .map((chip) => chip.textContent),
    ).toEqual(["Rent", "Supplies"]);
    expect(within(chips).queryByRole("radio", { checked: true })).not.toBeInTheDocument();
    expect(
      within(within(sheet).getByRole("radiogroup", { name: "Paid by" })).getByRole("radio", { name: "Cash" }),
    ).toBeChecked();

    // A category must be picked (D343).
    await userEvent.type(field(/^Amount/), "1250.50");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save expense" }));
    expect(await within(sheet).findByText("Choose category.")).toBeInTheDocument();
    expect(client.add).not.toHaveBeenCalled();

    await userEvent.click(within(chips).getByRole("radio", { name: "Supplies" }));
    await userEvent.click(within(sheet).getByRole("radio", { name: "UPI" }));
    await userEvent.type(field(/^Description/), "Gloves");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save expense" }));
    await waitFor(() =>
      expect(client.add).toHaveBeenCalledWith({
        input: { categoryId: SUPPLIES, amount: "1250.50", day: "2026-10-24", method: "UPI", description: "Gloves" },
        key: expect.any(String),
      }),
    );
    expect(onClose).toHaveBeenCalled();
    expect((await screen.findAllByText("₹1,250.50 for Supplies added"))[0]).toBeInTheDocument();
    // No Archive on a new one.
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("opens one with nothing said of it with an empty description", () => {
    draw({ ...uniforms, description: null });
    expect(field(/^Description/)).toHaveValue("");
  });

  it("corrects one as it is, keeping its category though archived since, and archives it, asked first (D333)", async () => {
    draw(uniforms);
    const sheet = screen.getByRole("dialog", { name: "Expense" });
    expect(within(sheet).getByRole("radio", { name: "Uniforms" })).toBeChecked();
    expect(field(/^Amount/)).toHaveValue("4500");
    expect(field(/^Description/)).toHaveValue("Scrubs");
    await userEvent.clear(field(/^Amount/));
    await userEvent.type(field(/^Amount/), "4800");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save expense" }));
    await waitFor(() =>
      expect(client.change).toHaveBeenCalledWith({
        expenseId: "e-1",
        input: { categoryId: OLD, amount: "4800", day: "2026-10-03", method: "CARD", description: "Scrubs" },
      }),
    );

    await userEvent.click(within(sheet).getByRole("button", { name: "Archive" }));
    await userEvent.click(
      within(await screen.findByRole("alertdialog", { name: "Archive ₹4,500 for Uniforms?" })).getByRole("button", {
        name: "Archive",
      }),
    );
    await waitFor(() => expect(client.archive).toHaveBeenCalledWith({ expenseId: "e-1", archived: true }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });
});
