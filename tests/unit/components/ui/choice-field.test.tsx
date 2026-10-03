import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChoiceField } from "@/components/ui/choice-field";

const options = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
] as const;

describe("ChoiceField", () => {
  it("is a radio group named by its visible label, with nothing chosen until one is", async () => {
    const onChange = vi.fn();
    render(<ChoiceField label="Gender" required value="" options={options} onChange={onChange} />);
    const group = screen.getByRole("radiogroup", { name: "Gender" });
    expect(screen.getByText("Gender")).toHaveTextContent("Gender *");
    expect(screen.getByRole("radio", { name: "Male" })).not.toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Female" }));
    expect(onChange).toHaveBeenCalledWith("FEMALE");
    expect(group).not.toHaveAttribute("aria-describedby");
  });

  it("says its hint, or its refusal in place of it, beside the group", () => {
    const { rerender } = render(
      <ChoiceField label="Gender" hint="As they say" value="MALE" options={options} onChange={vi.fn()} />,
    );
    const group = screen.getByRole("radiogroup", { name: "Gender" });
    expect(group).toHaveAccessibleDescription("As they say");
    expect(screen.getByRole("radio", { name: "Male" })).toBeChecked();
    expect(screen.getByText("Gender")).not.toHaveTextContent("*");

    rerender(
      <ChoiceField
        label="Gender"
        hint="As they say"
        error="Choose gender."
        value=""
        options={options}
        onChange={vi.fn()}
      />,
    );
    expect(group).toHaveAccessibleDescription("Choose gender.");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose gender.");
  });
});
