import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SectionHeading } from "@/components/ui/section-heading";

describe("SectionHeading", () => {
  it("names its section with how many it holds", () => {
    render(<SectionHeading id="waiting" title="Waiting" count={4} />);
    expect(screen.getByRole("heading", { level: 2, name: "Waiting 4" })).toHaveAttribute("id", "waiting");
  });

  it("leads to the whole list, named in full where the label is not enough", () => {
    render(
      <SectionHeading
        id="due"
        title="Follow-ups due"
        viewAll={{ label: "View all", name: "View all follow-ups", href: "/follow-ups" }}
      >
        <span>Today</span>
      </SectionHeading>,
    );
    expect(screen.getByRole("link", { name: "View all follow-ups" })).toHaveAttribute("href", "/follow-ups");
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("shows another view of the same screen", async () => {
    const onClick = vi.fn();
    render(<SectionHeading id="bill" title="To bill" viewAll={{ label: "View all", onClick }} />);
    await userEvent.click(screen.getByRole("button", { name: "View all" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
