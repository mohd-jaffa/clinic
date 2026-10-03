import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound, { metadata } from "@/app/not-found";

describe("the not-found screen", () => {
  it("says the page is not here, and leads home", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { level: 1, name: "This page isn’t here" })).toBeInTheDocument();
    expect(screen.getByText("The link may be out of date, or the address mistyped.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/home");
  });

  it("names the tab after itself", () => {
    expect(metadata.title).toBe("This page isn’t here");
  });
});
