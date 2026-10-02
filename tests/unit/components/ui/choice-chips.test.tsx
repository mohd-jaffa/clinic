import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChoiceChips } from "@/components/ui/choice-chips";

const OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "DENTAL", label: "Dental" },
  { value: "COOKIES", label: "Cookies" },
] as const;

describe("ChoiceChips", () => {
  it("is a radiogroup of pills, the chosen one filled", async () => {
    const onChange = vi.fn();
    render(<ChoiceChips label="Category" value="ALL" options={OPTIONS} onChange={onChange} />);
    expect(screen.getByRole("radiogroup", { name: "Category" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "All" })).toHaveClass("bg-chip");
    expect(screen.getByRole("radio", { name: "Dental" })).toHaveClass("bg-surface");

    await userEvent.click(screen.getByRole("radio", { name: "Cookies" }));
    expect(onChange).toHaveBeenCalledWith("COOKIES");
  });

  it("scrolls sideways by default, or lays a short set out over lines where each must be seen", () => {
    const { unmount } = render(<ChoiceChips label="Category" value="ALL" options={OPTIONS} onChange={vi.fn()} />);
    expect(screen.getByRole("radiogroup")).toHaveClass("overflow-x-auto");
    unmount();
    render(<ChoiceChips label="Method" value="ALL" options={OPTIONS} onChange={vi.fn()} wrap />);
    expect(screen.getByRole("radiogroup")).toHaveClass("flex-wrap");
    expect(screen.getByRole("radiogroup")).not.toHaveClass("overflow-x-auto");
  });

  it("moves the choice with the arrow keys", async () => {
    const onChange = vi.fn();
    render(<ChoiceChips label="Category" value="ALL" options={OPTIONS} onChange={onChange} />);
    screen.getByRole("radio", { name: "All" }).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith("COOKIES");
  });
});
