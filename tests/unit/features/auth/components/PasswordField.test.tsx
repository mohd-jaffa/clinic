import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { PasswordField } from "@/features/auth/components/PasswordField";

describe("PasswordField", () => {
  it("hides what is typed until asked, says what its button will do, and leaves the keyboard alone", async () => {
    const ref = createRef<HTMLInputElement>();
    render(<PasswordField ref={ref} label="Password" />);
    const field = screen.getByLabelText("Password");

    expect(ref.current).toBe(field);
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveAttribute("autocapitalize", "none");
    expect(field).toHaveAttribute("autocorrect", "off");

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(field).toHaveAttribute("type", "password");
  });
});
