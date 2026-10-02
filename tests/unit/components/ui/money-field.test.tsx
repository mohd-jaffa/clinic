import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MoneyField } from "@/components/ui/money-field";

describe("MoneyField", () => {
  it("puts ₹ before the amount and opens the decimal pad, holding the text as typed", () => {
    render(<MoneyField label="Fee" defaultValue="1,500" />);
    const field = screen.getByLabelText("Fee");
    expect(field).toHaveAttribute("inputmode", "decimal");
    expect(field).toHaveAttribute("placeholder", "0.00");
    expect(field).toHaveValue("1,500");
    expect(field).toHaveAccessibleDescription("₹");
  });
});
