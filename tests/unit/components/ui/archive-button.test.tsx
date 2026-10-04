import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ArchiveButton } from "@/components/ui/archive-button";

describe("ArchiveButton (D80, D122)", () => {
  it("asks to archive, and closes the sheet only once it was archived", async () => {
    const onArchived = vi.fn();
    const archive = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<ArchiveButton archive={archive} archiving={false} onArchived={onArchived} />);

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onArchived).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onArchived).toHaveBeenCalledTimes(1);
  });

  it("is busy while archiving", () => {
    render(<ArchiveButton archive={vi.fn()} archiving onArchived={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Archive" })).toHaveAttribute("aria-busy", "true");
  });
});
