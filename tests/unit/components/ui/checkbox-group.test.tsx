import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { CheckboxGroup, type CheckboxOption } from "@/components/ui/checkbox-group";

type Grant = "patients.view" | "patients.edit" | "payments.view";

const OPTIONS: CheckboxOption<Grant>[] = [
  { value: "patients.view", label: "See patients", disabled: true, hint: "Needed by the others." },
  { value: "patients.edit", label: "Edit patients" },
  { value: "payments.view", label: "See payments" },
];

function Grants({ onChange }: { onChange: (value: Grant[]) => void }) {
  const [value, setValue] = useState<Grant[]>(["patients.view"]);
  return (
    <CheckboxGroup
      label="Permissions"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      hint="What this member may do."
    />
  );
}

describe("CheckboxGroup", () => {
  it("is a named group of checkboxes, each read with its hint", () => {
    render(<Grants onChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Permissions" })).toHaveAccessibleDescription("What this member may do.");
    const needed = screen.getByRole("checkbox", { name: "See patients" });
    expect(needed).toBeChecked();
    expect(needed).toBeDisabled();
    expect(needed).toHaveAccessibleDescription("Needed by the others.");
  });

  it("turns each on and off, keeping the others", async () => {
    const onChange = vi.fn();
    render(<Grants onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Edit patients" }));
    expect(onChange).toHaveBeenLastCalledWith(["patients.view", "patients.edit"]);
    await userEvent.click(screen.getByText("See payments"));
    expect(onChange).toHaveBeenLastCalledWith(["patients.view", "patients.edit", "payments.view"]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Edit patients" }));
    expect(onChange).toHaveBeenLastCalledWith(["patients.view", "payments.view"]);
  });

  it("says what is wrong in place of its hint", () => {
    render(
      <CheckboxGroup
        label="Permissions"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
        hint="Choose."
        error="Choose one."
      />,
    );
    const group = screen.getByRole("group", { name: "Permissions" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Choose one.");
    expect(screen.queryByText("Choose.")).not.toBeInTheDocument();
  });
});
