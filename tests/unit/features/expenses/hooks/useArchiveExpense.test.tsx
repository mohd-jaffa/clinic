import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Expense } from "@/features/expenses/types";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { add: vi.fn(), change: vi.fn(), archive: vi.fn() } }));
vi.mock("@/features/expenses/api.client", () => ({ ExpensesClient: client }));

const { useArchiveExpense } = await import("@/features/expenses/hooks/useArchiveExpense");

const rent: Expense = {
  id: "e-1",
  category: { id: "c-1", name: "Rent" },
  description: null,
  amountPaise: 2_500_000,
  day: "2026-10-01",
  method: "BANK_TRANSFER",
  archivedAt: null,
};
const archived = vi.fn();

function Archive() {
  const { archive, restore, restoring, archiving } = useArchiveExpense();
  return (
    <>
      <button type="button" aria-busy={archiving} onClick={async () => archived(await archive(rent))}>
        Archive it
      </button>
      <button type="button" aria-busy={restoring === rent.id} onClick={() => void restore(rent)}>
        Restore it
      </button>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  client.archive.mockImplementation(async ({ archived: to }: { archived: boolean }) => ({
    expenseId: "e-1",
    archived: to,
  }));
});

describe("useArchiveExpense (plan §16; D331)", () => {
  it("asks first, then archives it and says so — answering whether it was", async () => {
    render(<Archive />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Archive it" }));
    const ask = await screen.findByRole("alertdialog", { name: "Archive ₹25,000 for Rent?" });
    expect(ask).toHaveTextContent("It leaves the month’s totals.");
    await userEvent.click(within(ask).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(client.archive).toHaveBeenCalledWith({ expenseId: "e-1", archived: true }));
    expect(archived).toHaveBeenCalledWith(true);
    expect((await screen.findAllByText("Expense archived"))[0]).toBeInTheDocument();
  });

  it("archives nothing when the ask is put aside", async () => {
    render(<Archive />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Archive it" }));
    await userEvent.click(
      within(await screen.findByRole("alertdialog", { name: "Archive ₹25,000 for Rent?" })).getByRole("button", {
        name: "Cancel",
      }),
    );
    await waitFor(() => expect(archived).toHaveBeenCalledWith(false));
    expect(client.archive).not.toHaveBeenCalled();
  });

  it("restores it unasked, and says why when it could not", async () => {
    render(<Archive />, { wrapper: Providers });
    await userEvent.click(screen.getByRole("button", { name: "Restore it" }));
    await waitFor(() => expect(client.archive).toHaveBeenCalledWith({ expenseId: "e-1", archived: false }));
    expect((await screen.findAllByText("Expense restored"))[0]).toBeInTheDocument();
    client.archive.mockRejectedValue(new ApiError(422, "CLINIC_PLAN_EXPIRED", "View-only."));
    await userEvent.click(screen.getByRole("button", { name: "Restore it" }));
    expect(await screen.findByRole("alertdialog", { name: "The expense wasn’t changed" })).toBeInTheDocument();
  });
});
