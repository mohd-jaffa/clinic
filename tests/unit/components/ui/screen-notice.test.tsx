import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScreenNotice } from "@/components/ui/screen-notice";

describe("ScreenNotice", () => {
  it("says what went wrong, announced, marked as well as tinted", () => {
    render(<ScreenNotice>{"We couldn't load the queue."}</ScreenNotice>);
    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent("We couldn't load the queue.");
    expect(notice).toHaveClass("bg-coral-soft");
    expect(notice.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("can say something quietly", () => {
    render(<ScreenNotice tone="info">Nothing to show for this day.</ScreenNotice>);
    expect(screen.getByRole("alert")).toHaveClass("text-muted");
  });
});
