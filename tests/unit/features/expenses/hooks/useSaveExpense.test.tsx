import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Expense } from "@/features/expenses/types";
import { ApiError } from "@/lib/api/client";
import type { ExpenseInput } from "@/lib/validation";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { add: vi.fn(), change: vi.fn(), archive: vi.fn() } }));
vi.mock("@/features/expenses/api.client", () => ({ ExpensesClient: client }));

const { useSaveExpense } = await import("@/features/expenses/hooks/useSaveExpense");

const input = {
  categoryId: "c-1",
  amount: "1,250.50",
  day: "2026-10-19",
  method: "UPI",
  description: "",
} as ExpenseInput;
const rent: Expense = {
  id: "e-1",
  category: { id: "c-1", name: "Rent" },
  description: null,
  amountPaise: 2_500_000,
  day: "2026-10-01",
  method: "BANK_TRANSFER",
  archivedAt: null,
};
const onDone = vi.fn();

function Save({ expense = null }: { expense?: Expense | null }) {
  const { save, submitting } = useSaveExpense({ expense, onDone });
  return (
    <button type="button" aria-busy={submitting} onClick={() => void save(input, "Supplies")}>
      Save
    </button>
  );
}
const tap = () => userEvent.click(screen.getByRole("button", { name: "Save" }));

beforeEach(() => {
  vi.clearAllMocks();
  client.add.mockResolvedValue({ expenseId: "e-9" });
  client.change.mockResolvedValue({ expenseId: "e-1" });
});

describe("useSaveExpense (plan §16; D328, D333)", () => {
  it("adds a new one once per key, closes, and says what was added — the next tap a new key", async () => {
    render(<Save />, { wrapper: Providers });
    await tap();
    await tap();
    const [first, second] = client.add.mock.calls.map(([sent]) => sent as { input: ExpenseInput; key: string });
    expect(first.input).toBe(input);
    expect(second.key).not.toBe(first.key);
    expect(onDone).toHaveBeenCalled();
    expect((await screen.findAllByText("₹1,250.50 for Supplies added"))[0]).toBeInTheDocument();
  });

  it("keeps its key when the add fails, to send again, and says why", async () => {
    client.add.mockRejectedValue(new ApiError(422, "EXPENSE_CATEGORY_ARCHIVED", "That category is archived."));
    render(<Save />, { wrapper: Providers });
    await tap();
    expect(await screen.findByRole("alertdialog", { name: "The expense wasn’t added" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await tap();
    await waitFor(() => expect(client.add).toHaveBeenCalledTimes(2));
    const [first, second] = client.add.mock.calls.map(([sent]) => sent as { key: string });
    expect(second.key).toBe(first.key);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("corrects one, closes and says it was saved — or says why not", async () => {
    const { unmount } = render(<Save expense={rent} />, { wrapper: Providers });
    await tap();
    await waitFor(() => expect(client.change).toHaveBeenCalledWith({ expenseId: "e-1", input }));
    expect(onDone).toHaveBeenCalled();
    expect((await screen.findAllByText("Expense saved"))[0]).toBeInTheDocument();
    unmount();
    client.change.mockRejectedValue(new ApiError(422, "EXPENSE_ARCHIVED", "This expense is archived."));
    render(<Save expense={rent} />, { wrapper: Providers });
    await tap();
    expect(await screen.findByRole("alertdialog", { name: "The expense wasn’t saved" })).toBeInTheDocument();
  });
});
