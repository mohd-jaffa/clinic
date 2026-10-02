import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import { Lake } from "@/components/ui/lake";

describe("Lake", () => {
  it("holds the patient with the doctor, their token read with what it is, and what to do next", () => {
    render(
      <Lake label="With the doctor" lead="07" leadLabel="Token" title="Rohan Mehta" detail="34 M · 6 min">
        <Button label="Done" />
        <Button label="Next patient" variant="secondary" />
      </Lake>,
    );
    const lake = screen.getByRole("region", { name: "With the doctor" });
    expect(lake).toHaveClass("rounded-lake", "bg-ground");
    expect(screen.getByText("07")).toHaveTextContent("Token 07");
    expect(screen.getByText("Rohan Mehta")).toBeInTheDocument();
    expect(screen.getByText("34 M · 6 min")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next patient" })).toBeInTheDocument();
  });

  it("holds a warm line when no one is in", () => {
    render(<Lake label="With the doctor" title="No one is with Dr Meera" />);
    const lake = screen.getByRole("region", { name: "With the doctor" });
    expect(lake).toHaveTextContent("No one is with Dr Meera");
    expect(lake.querySelectorAll("button")).toHaveLength(0);
  });

  it("reads a bare numeral as it is", () => {
    render(<Lake label="Next" lead="08" title="Priya Iyer" />);
    expect(screen.getByText("08")).toHaveTextContent(/^08$/);
  });
});
