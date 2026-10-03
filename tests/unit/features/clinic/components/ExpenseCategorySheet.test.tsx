import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExpenseCategory } from "@/features/clinic/types";
import { ApiError } from "@/lib/api/client";
import { anExpenseCategory } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { add: vi.fn(), change: vi.fn() } }));
vi.mock("@/features/clinic/api.client", () => ({ ExpenseCategoriesClient: client }));

const { ExpenseCategorySheet } = await import("@/features/clinic/components/ExpenseCategorySheet");

const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  client.add.mockImplementation(async ({ name }: { name: string }) => anExpenseCategory({ id: "c-10", name }));
  client.change.mockImplementation(
    async ({ id, details, active }: { id: string; details?: object; active?: boolean }) =>
      anExpenseCategory({ id, ...details, ...(active !== undefined && { active }) }),
  );
});

/** The sheet as a screen holds it: open until it closes itself. */
function Harness({ category }: { category: ExpenseCategory | null }) {
  const [open, setOpen] = useState(true);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return <ExpenseCategorySheet open={open} onClose={close} category={category} />;
}

const draw = (category: ExpenseCategory | null) =>
  render(
    <Providers>
      <Harness category={category} />
    </Providers>,
  );

const field = (name: RegExp) => within(screen.getByRole("dialog")).getByRole("textbox", { name });

describe("ExpenseCategorySheet (plan §9, D40)", () => {
  it("adds a category by its name", async () => {
    draw(null);
    const sheet = screen.getByRole("dialog", { name: "Add an expense category" });
    expect(within(sheet).queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Name needs a value.")).toBeInTheDocument();

    await userEvent.type(field(/^Name/), "Lab fees");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.add).toHaveBeenCalledWith({ name: "Lab fees" }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Lab fees added");
  });

  it("renames a category, starting from its name", async () => {
    draw(anExpenseCategory());
    expect(field(/^Name/)).toHaveValue("Rent");
    await userEvent.clear(field(/^Name/));
    await userEvent.type(field(/^Name/), "Lease");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.change).toHaveBeenCalledWith({ id: "c-1", details: { name: "Lease" } }));
    expect(screen.getByRole("status")).toHaveTextContent("Lease saved");
  });

  it("says when another category has the name", async () => {
    client.add.mockRejectedValue(
      new ApiError(409, "EXPENSE_CATEGORY_ALREADY_EXISTS", "Another expense category already has this name."),
    );
    draw(null);
    await userEvent.type(field(/^Name/), "Rent");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alertdialog", { name: "The category wasn’t saved" })).toHaveTextContent(
      "Another expense category already has this name.",
    );
  });

  it("archives the category once asked, then closes (D80)", async () => {
    draw(anExpenseCategory());
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    const ask = screen.getByRole("alertdialog", { name: "Archive Rent?" });
    expect(ask).toHaveTextContent("New expenses won’t offer it.");
    await userEvent.click(within(ask).getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(client.change).toHaveBeenCalledWith({ id: "c-1", active: false });
  });
});
