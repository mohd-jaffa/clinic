import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { optionsFrom, SelectField } from "@/components/ui/select-field";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/constants/statuses";

const options = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
];

describe("SelectField", () => {
  it("offers what it was given in the app's own list, and reports the choice", async () => {
    const onChange = vi.fn();
    render(<SelectField label="Paid with" required options={options} value="CASH" onChange={onChange} />);
    const field = screen.getByRole("combobox", { name: "Paid with" });
    expect(field).toHaveTextContent("Cash");
    expect(field).toHaveAttribute("aria-required", "true");

    await userEvent.click(field);
    await userEvent.click(screen.getByRole("option", { name: "UPI" }));
    expect(onChange).toHaveBeenCalledWith("UPI");
  });

  it("reads its hint with it, or its message in the hint's place", () => {
    const { rerender } = render(
      <SelectField label="Paid with" options={options} value="CASH" onChange={vi.fn()} hint="How the money came in." />,
    );
    expect(screen.getByRole("combobox", { name: "Paid with" })).toHaveAccessibleDescription("How the money came in.");

    rerender(
      <SelectField
        label="Paid with"
        options={options}
        value="CASH"
        onChange={vi.fn()}
        hint="How the money came in."
        error="Choose a method."
      />,
    );
    const field = screen.getByRole("combobox", { name: "Paid with" });
    expect(field).toHaveAccessibleDescription("Choose a method.");
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("says when it may be left on its placeholder", () => {
    render(<SelectField label="Doctor" optional options={options} value="" onChange={vi.fn()} placeholder="Any" />);
    expect(screen.getByRole("combobox", { name: "Doctor (Optional)" })).toHaveTextContent("Any");
  });
});

describe("optionsFrom", () => {
  it("pairs each stored value with the words a person reads", () => {
    expect(optionsFrom(PAYMENT_METHODS, PAYMENT_METHOD_LABELS)[1]).toEqual({ value: "UPI", label: "UPI" });
    expect(optionsFrom(PAYMENT_METHODS, PAYMENT_METHOD_LABELS)).toHaveLength(PAYMENT_METHODS.length);
  });
});
