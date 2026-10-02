import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "@/components/ui/segmented-control";

const OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "PAST", label: "Past" },
] as const;

describe("SegmentedControl", () => {
  it("is a real radiogroup, changed by a tap", async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Which views to show" value="ACTIVE" options={OPTIONS} onChange={onChange} />);

    expect(screen.getByRole("radiogroup", { name: "Which views to show" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Active" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Active" })).toHaveClass("text-on-chip");

    await userEvent.click(screen.getByRole("radio", { name: "Past" }));
    expect(onChange).toHaveBeenCalledWith("PAST");
  });

  it("is changed with the arrow keys", async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Views" value="ACTIVE" options={OPTIONS} onChange={onChange} />);
    screen.getByRole("radio", { name: "Active" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("PAST");
  });

  it("glides the raised tile to the choice, one option's width at a time", () => {
    const three = [...OPTIONS, { value: "ALL", label: "All" }] as const;
    const { container, rerender } = render(
      <SegmentedControl label="Views" value="ACTIVE" options={three} onChange={vi.fn()} />,
    );
    const tile = container.querySelector<HTMLElement>("[aria-hidden=true]");
    expect(tile?.style.width).toMatch(/0\.333.*100% - 0\.5rem/);
    expect(tile?.style.transform).toBe("translateX(0%)");
    rerender(<SegmentedControl label="Views" value="ALL" options={three} onChange={vi.fn()} />);
    expect(tile?.style.transform).toBe("translateX(200%)");
  });

  it("raises no tile when the value is none of the options", () => {
    const { container } = render(
      <SegmentedControl label="Views" value={"GONE" as "ACTIVE"} options={OPTIONS} onChange={vi.fn()} />,
    );
    expect(container.querySelector("[aria-hidden=true]")).toBeNull();
  });
});
