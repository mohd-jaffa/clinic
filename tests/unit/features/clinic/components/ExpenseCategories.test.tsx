import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authStub } from "@tests/support/auth";
import { anExpenseCategory } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const { auth, client, query } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { add: vi.fn(), change: vi.fn() },
  query: { current: {} as Record<string, unknown> },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/clinic/api.client", () => ({ ExpenseCategoriesClient: client }));
vi.mock("@/features/clinic/hooks/useExpenseCategories", () => ({ useExpenseCategories: () => query.current }));

const { ExpenseCategories } = await import("@/features/clinic/components/ExpenseCategories");

const categories = [
  anExpenseCategory(),
  anExpenseCategory({ id: "c-2", name: "Electricity" }),
  anExpenseCategory({ id: "c-8", name: "Marketing", active: false }),
];

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  query.current = { data: categories, isLoading: false };
  client.change.mockImplementation(async ({ id, active }: { id: string; active: boolean }) => ({
    ...categories.find((category) => category.id === id)!,
    active,
  }));
});

const draw = () =>
  render(
    <Providers>
      <ExpenseCategories />
    </Providers>,
  );

describe("ExpenseCategories (plan §9, D40, D81)", () => {
  it("names itself and how many categories there are, in the clinic's order", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Expense categories" })).toBeInTheDocument();
    expect(screen.getByText("2 categories")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Expense categories" }))
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual(["Rent", "Electricity"]);
    expect(screen.getByText("New categories join the end of the list.")).toBeInTheDocument();
  });

  it("opens a category's sheet to rename it, and an empty one to add one", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Electricity" }));
    const sheet = screen.getByRole("dialog", { name: "Rename category" });
    expect(within(sheet).getByRole("textbox", { name: /^Name/ })).toHaveValue("Electricity");
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: "Add category" }));
    expect(screen.getByRole("dialog", { name: "Add an expense category" })).toBeInTheDocument();
  });

  it("restores an archived category (D80)", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Show archived (1)" }));
    await userEvent.click(screen.getByRole("button", { name: "Restore Marketing" }));
    expect(client.change).toHaveBeenCalledWith({ id: "c-8", active: true });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Marketing restored"));
  });

  it("says why when it cannot load", () => {
    query.current = { isLoading: false, error: new Error("down") };
    draw();
    expect(screen.getByText("The expense categories couldn't be loaded.")).toBeInTheDocument();
  });
});
