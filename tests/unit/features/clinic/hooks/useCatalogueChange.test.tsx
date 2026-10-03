import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCatalogueChange } from "@/features/clinic/hooks/useCatalogueChange";
import type { ExpenseCategory } from "@/features/clinic/types";
import { ApiError } from "@/lib/api/client";
import { anExpenseCategory } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const change = vi.fn();
const rent = anExpenseCategory();
const card = { title: "Archive Rent?", message: "New expenses won’t offer it." };

const renderChange = () =>
  renderHook(() => useCatalogueChange<ExpenseCategory>({ change, list: "/api/expense-categories" }), {
    wrapper: Providers,
  }).result;

let hook: ReturnType<typeof renderChange>;
beforeEach(() => {
  change.mockReset();
  hook = renderChange();
});

describe("useCatalogueChange (D80)", () => {
  it("archives only once asked, says so, and answers that it did", async () => {
    let finish: (value: ExpenseCategory) => void = () => {};
    change.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    let answer: Promise<boolean>;
    act(() => {
      answer = hook.current.archive(rent, card);
    });
    const ask = await screen.findByRole("alertdialog", { name: "Archive Rent?" });
    expect(ask).toHaveTextContent("New expenses won’t offer it.");
    expect(hook.current.archiving).toBe(false);
    await userEvent.click(within(ask).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(hook.current.archiving).toBe(true));
    await act(async () => finish({ ...rent, active: false }));

    expect(await answer!).toBe(true);
    expect(hook.current.archiving).toBe(false);
    expect(change).toHaveBeenCalledWith({ id: "c-1", active: false });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rent archived"));
  });

  it("does nothing when the question is put aside", async () => {
    let answer: Promise<boolean>;
    act(() => {
      answer = hook.current.archive(rent, card);
    });
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(await answer!).toBe(false);
    expect(change).not.toHaveBeenCalled();
  });

  it("says why it could not archive the last one, and answers that it did not (D83)", async () => {
    change.mockRejectedValue(
      new ApiError(
        422,
        "EXPENSE_CATEGORY_REQUIRED",
        "Keep at least one expense category — every expense is filed under one.",
      ),
    );
    let answer: Promise<boolean>;
    act(() => {
      answer = hook.current.archive(rent, card);
    });
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archive" }));
    expect(await answer!).toBe(false);
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t changed" })).toHaveTextContent(
      "Keep at least one expense category",
    );
  });

  it("restores without asking, marks which one meanwhile, and says so", async () => {
    let finish: (value: ExpenseCategory) => void = () => {};
    change.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    let done: Promise<void>;
    act(() => {
      done = hook.current.restore({ ...rent, active: false });
    });
    expect(hook.current.restoring).toBe("c-1");
    // A restore is not an archive: the sheet's Archive stays as it was.
    await waitFor(() => expect(hook.current.archiving).toBe(false));
    await act(async () => {
      finish(rent);
      await done;
    });
    expect(change).toHaveBeenCalledWith({ id: "c-1", active: true });
    expect(hook.current.restoring).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Rent restored");
  });
});
