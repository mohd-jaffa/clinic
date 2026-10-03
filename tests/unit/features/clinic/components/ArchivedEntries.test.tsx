import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ArchivedEntries } from "@/features/clinic/components/ArchivedEntries";
import { anExpenseCategory } from "@tests/support/clinic";

const archived = [anExpenseCategory({ id: "c-8", name: "Marketing", active: false })];

describe("ArchivedEntries (D80)", () => {
  it("is nothing at all while none is archived", () => {
    const { container } = render(<ArchivedEntries entries={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps them behind Show archived, each with what it was and Restore", async () => {
    const onRestore = vi.fn();
    render(<ArchivedEntries entries={archived} describe={() => "Was ₹300"} onRestore={onRestore} />);
    const toggle = screen.getByRole("button", { name: "Show archived (1)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list", { name: "Archived" })).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide archived" })).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("list", { name: "Archived" });
    expect(list).toHaveTextContent("MarketingWas ₹300");
    await userEvent.click(within(list).getByRole("button", { name: "Restore Marketing" }));
    expect(onRestore).toHaveBeenCalledWith(archived[0]);

    await userEvent.click(screen.getByRole("button", { name: "Hide archived" }));
    expect(screen.queryByRole("list", { name: "Archived" })).not.toBeInTheDocument();
  });

  it("shows the one being restored as busy, and offers no Restore while view-only", async () => {
    const { rerender } = render(<ArchivedEntries entries={archived} onRestore={vi.fn()} restoring="c-8" />);
    await userEvent.click(screen.getByRole("button", { name: "Show archived (1)" }));
    expect(screen.getByRole("button", { name: "Restore Marketing" })).toHaveAttribute("aria-busy", "true");

    rerender(<ArchivedEntries entries={archived} />);
    expect(screen.queryByRole("button", { name: "Restore Marketing" })).not.toBeInTheDocument();
  });
});
