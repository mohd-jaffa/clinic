import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DateField } from "@/components/ui/date-field";

describe("DateField", () => {
  it("ties its label to the calendar's control, which says the day, and passes a chosen day on", async () => {
    const onChange = vi.fn();
    render(<DateField label="Date" required value="2026-09-20" onChange={onChange} hint="The day it was paid." />);
    const control = screen.getByLabelText(/Date/, { selector: "button" });
    expect(control).toHaveAccessibleName("Date 20 Sep 2026");
    expect(control).toHaveAccessibleDescription("The day it was paid.");

    await userEvent.click(control);
    await userEvent.click(screen.getByRole("button", { name: "Friday, 18 Sep 2026" }));
    expect(onChange).toHaveBeenCalledWith("2026-09-18");
  });

  it("says what is wrong beside it, read with the control", () => {
    render(<DateField label="Date" value="" onChange={vi.fn()} error="Choose a date." />);
    const control = screen.getByLabelText(/Date/, { selector: "button" });
    expect(control).toHaveAttribute("data-invalid", "true");
    expect(control).toHaveAccessibleDescription("Choose a date.");
  });
});
