import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImportStep } from "@/features/patients/components/ImportStep";

describe("ImportStep (D131)", () => {
  it("names its section by its title, says what it asks, and puts its way on under it", () => {
    render(
      <ImportStep title="Choose a file" hint="A CSV or Excel file." actions={<button type="button">Next</button>}>
        <p>Inside</p>
      </ImportStep>,
    );
    const step = screen.getByRole("region", { name: "Choose a file" });
    expect(step).toHaveTextContent("A CSV or Excel file.");
    expect(step).toHaveTextContent("Inside");
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("needs neither a hint nor actions", () => {
    render(<ImportStep title="Import" />);
    expect(screen.getByRole("region", { name: "Import" }).querySelectorAll("p")).toHaveLength(0);
  });
});
