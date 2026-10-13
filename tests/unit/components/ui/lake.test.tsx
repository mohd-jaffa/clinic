import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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

  it("opens what there is to know of them from their name, when told what (D172)", async () => {
    const onOpen = vi.fn();
    render(<Lake label="With the doctor: Rohan Mehta" lead="07" title="Rohan Mehta" onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Rohan Mehta" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("carries a tag under the line about them (D201)", () => {
    render(<Lake label="With the doctor" lead="07" title="Rohan Mehta" detail="6 min" tag={<span>Urgent</span>} />);
    expect(screen.getByRole("region", { name: "With the doctor" })).toHaveTextContent("07Rohan Mehta6 minUrgent");
  });
});
