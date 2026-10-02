import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TextAreaField, TextField } from "@/components/ui/text-field";

describe("TextField", () => {
  it("ties its label to its input, so clicking the label focuses the field", async () => {
    render(<TextField label="Full name" />);

    await userEvent.click(screen.getByText("Full name"));
    expect(screen.getByLabelText("Full name")).toHaveFocus();
  });

  it("announces a validation message and points the field at it", () => {
    render(<TextField label="Email" error="Enter a valid email address." />);

    const input = screen.getByLabelText("Email");
    const message = screen.getByRole("alert");

    expect(message).toHaveTextContent("Enter a valid email address.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", message.id);
  });

  it("says nothing when nothing is wrong", () => {
    render(<TextField label="Email" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-describedby");
  });

  it("marks a required field for assistive technology, not only visually", () => {
    render(<TextField label="Full name" required />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-required", "true");
  });

  it("shows a hint until there is a message to show instead, and reads whichever is shown", () => {
    const { rerender } = render(<TextField label="Clinic name" hint="Printed on your bills." />);
    expect(screen.getByLabelText("Clinic name")).toHaveAccessibleDescription("Printed on your bills.");

    rerender(<TextField label="Clinic name" hint="Printed on your bills." error="Enter the clinic's name." />);
    expect(screen.queryByText("Printed on your bills.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Clinic name")).toHaveAccessibleDescription("Enter the clinic's name.");
  });

  it("reads a prefix with the field, and makes room for it", () => {
    render(<TextField label="Mobile number" prefix="+91" hint="For signing in." />);
    const field = screen.getByLabelText("Mobile number");
    expect(field).toHaveAccessibleDescription("+91 For signing in.");
    expect(field).toHaveClass("pl-[4.25rem]");
  });

  it("makes room for an icon, a prefix and a control at its end", () => {
    render(
      <TextField label="Mobile number" prefix="+91" leading={<svg />} trailing={<button type="button">Show</button>} />,
    );
    expect(screen.getByLabelText("Mobile number")).toHaveClass("pl-[6.25rem]", "pr-14");
    expect(screen.getByText("+91")).toHaveClass("left-12");
    expect(screen.getByRole("button", { name: "Show" })).toBeInTheDocument();
  });

  it("makes room for an icon alone", () => {
    render(<TextField label="Search" leading={<svg />} />);
    expect(screen.getByLabelText("Search")).toHaveClass("pl-12");
  });

  it("passes what is typed on to its caller", async () => {
    const onChange = vi.fn();
    render(<TextField label="Name" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText("Name"), "Asha");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("TextAreaField", () => {
  it("is a labelled multi-line field in a soft well that reports its own errors", () => {
    render(<TextAreaField label="Address" required error="Address can be at most 500 characters." />);

    const field = screen.getByRole("textbox", { name: "Address" });
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveClass("rounded-row");
    expect(field).toHaveAttribute("aria-required", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("at most 500");
  });

  it("reads its hint with it, and says when it may be left empty", () => {
    render(<TextAreaField label="Notes" optional hint="Only the clinic sees these." />);
    expect(screen.getByLabelText("Notes (Optional)")).toHaveAccessibleDescription("Only the clinic sees these.");
  });
});
