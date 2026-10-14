import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrescriptionReadout } from "@/features/prescriptions/components/PrescriptionReadout";
import type { PrescriptionItem } from "@/features/prescriptions/types";

const PARACETAMOL: PrescriptionItem = {
  medicine: "Paracetamol",
  strength: "500 mg",
  dose: "1 tab",
  frequency: "1-0-1",
  timing: "AFTER_FOOD",
  durationDays: 5,
  instructions: "Dissolve in water",
};
const BARE: PrescriptionItem = {
  medicine: "Cetirizine",
  strength: null,
  dose: null,
  frequency: null,
  timing: null,
  durationDays: null,
  instructions: null,
};

describe("PrescriptionReadout (plan §13)", () => {
  it("says there is none until one is saved, or while it holds nothing", () => {
    const { unmount } = render(<PrescriptionReadout prescription={null} />);
    expect(screen.getByText("No prescription yet")).toBeInTheDocument();
    unmount();
    render(<PrescriptionReadout prescription={{ items: [], advice: null, printDiagnosis: true }} />);
    expect(screen.getByText("No prescription yet")).toBeInTheDocument();
    expect(screen.queryByText("The diagnosis prints on it")).not.toBeInTheDocument();
  });

  it("reads out each medicine in order: its name and strength, how it is taken, its instructions", () => {
    render(<PrescriptionReadout prescription={{ items: [PARACETAMOL, BARE], advice: null, printDiagnosis: false }} />);
    const [first, second] = within(screen.getByRole("list", { name: "Prescription" })).getAllByRole("listitem");
    expect(first).toHaveTextContent("1Paracetamol 500 mg1 tab · 1-0-1 · After food · 5 daysDissolve in water");
    expect(second).toHaveTextContent(/^2Cetirizine$/);
    expect(screen.queryByText("Advice")).not.toBeInTheDocument();
    expect(screen.queryByText("The diagnosis prints on it")).not.toBeInTheDocument();
  });

  it("reads out the advice alone, and whether the diagnosis prints", () => {
    render(<PrescriptionReadout prescription={{ items: [], advice: "Rest\nFluids", printDiagnosis: true }} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByText("Advice")).toBeInTheDocument();
    expect(screen.getByText(/Rest\s+Fluids/)).toBeInTheDocument();
    expect(screen.getByText("The diagnosis prints on it")).toBeInTheDocument();
  });
});
