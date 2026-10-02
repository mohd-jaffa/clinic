import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhoneField } from "@/components/ui/phone-field";

describe("PhoneField", () => {
  it("puts +91 before the number, opens the number pad, and reads it out with any message", () => {
    render(<PhoneField label="Mobile number" error="Enter a valid mobile number." />);
    const field = screen.getByLabelText("Mobile number");
    expect(field).toHaveAttribute("type", "tel");
    expect(field).toHaveAttribute("inputmode", "tel");
    expect(field).toHaveAttribute("autocomplete", "tel-national");
    expect(field).toHaveAccessibleDescription("+91 Enter a valid mobile number.");
  });
});
