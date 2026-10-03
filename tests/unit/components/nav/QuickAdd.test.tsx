import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AddButton } from "@/components/nav/QuickAdd";

describe("AddButton", () => {
  it.each(["bar", "rail", "sidebar"] as const)("in the %s, is named Add and says it opens a dialog", async (look) => {
    const onClick = vi.fn();
    const { rerender } = render(<AddButton look={look} open={false} onClick={onClick} />);
    const add = screen.getByRole("button", { name: "Add" });

    expect(add).toHaveAttribute("aria-haspopup", "dialog");
    expect(add).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(add);
    expect(onClick).toHaveBeenCalledOnce();

    rerender(<AddButton look={look} open onClick={onClick} />);
    expect(add).toHaveAttribute("aria-expanded", "true");
  });

  it("writes its name under the ＋ in the bar, and keeps it for a screen reader on the rail", () => {
    render(
      <>
        <AddButton look="bar" open={false} onClick={vi.fn()} />
        <AddButton look="rail" open={false} onClick={vi.fn()} />
      </>,
    );
    const [bar, rail] = screen.getAllByRole("button", { name: "Add" });
    expect(bar).toHaveTextContent("Add");
    expect(rail).toHaveTextContent("");
    expect(rail).toHaveAttribute("title", "Add");
  });
});
