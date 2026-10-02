import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FIELD_BASE, FIELD_WELL, FieldError, FieldHint, FieldLabel } from "@/components/ui/field";

describe("the field's well", () => {
  it("is a capsule with an edge that shows where to type, coral when something is wrong", () => {
    expect(FIELD_WELL).toContain(FIELD_BASE);
    expect(FIELD_WELL).toContain("rounded-full");
    expect(FIELD_BASE).toContain("border-edge");
    expect(FIELD_BASE).toContain("aria-[invalid=true]:border-coral");
  });
});

describe("FieldLabel", () => {
  it("marks a required field with a star a screen reader skips", () => {
    render(<FieldLabel htmlFor="name" label="Full name" required />);
    const label = screen.getByText("Full name");
    expect(label).toHaveClass("font-bold");
    expect(label.querySelector('[aria-hidden="true"]')).toHaveTextContent("*");
  });

  it("says a field is optional, in words", () => {
    render(<FieldLabel htmlFor="email" label="Email" optional />);
    expect(screen.getByText("Email")).toHaveTextContent("Email (Optional)");
  });
});

describe("FieldHint", () => {
  it("shows only when it has an id to be read by", () => {
    const { rerender } = render(<FieldHint hint="Printed on your bills." />);
    expect(screen.queryByText("Printed on your bills.")).not.toBeInTheDocument();
    rerender(<FieldHint id="hint" hint="Printed on your bills." />);
    expect(screen.getByText("Printed on your bills.")).toHaveAttribute("id", "hint");
  });
});

describe("FieldError", () => {
  it("is announced, marked as well as coloured", () => {
    render(<FieldError id="error" message="Enter a valid mobile number." />);
    const message = screen.getByRole("alert");
    expect(message).toHaveTextContent("Enter a valid mobile number.");
    expect(message.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("says nothing when nothing is wrong", () => {
    render(<FieldError message={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
