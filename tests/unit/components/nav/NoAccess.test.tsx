import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NoAccess } from "@/components/nav/NoAccess";

describe("NoAccess (plan §31.2)", () => {
  it("says the screen is not open to them, who can open it, and the way home", () => {
    render(<NoAccess />);
    expect(screen.getByRole("heading", { level: 1, name: "This screen isn’t open to you" })).toBeInTheDocument();
    expect(screen.getByText("Your clinic’s owner can give you access to it.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/home");
  });
});
