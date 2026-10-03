import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ArchiveEntryButton } from "@/features/clinic/components/ArchiveEntryButton";

describe("ArchiveEntryButton (D80)", () => {
  it("asks to archive, and closes the sheet only once it was archived", async () => {
    const onArchived = vi.fn();
    const archive = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<ArchiveEntryButton archive={archive} archiving={false} onArchived={onArchived} />);

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onArchived).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onArchived).toHaveBeenCalledTimes(1);
  });

  it("is busy while archiving", () => {
    render(<ArchiveEntryButton archive={vi.fn()} archiving onArchived={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Archive" })).toHaveAttribute("aria-busy", "true");
  });
});
