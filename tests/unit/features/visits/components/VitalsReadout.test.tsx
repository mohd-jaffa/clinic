import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VitalsReadout } from "@/features/visits/components/VitalsReadout";
import type { Vitals } from "@/features/visits/types";

const NONE: Vitals = {
  systolic: null,
  diastolic: null,
  pulse: null,
  temperatureF: null,
  spo2: null,
  respiratoryRate: null,
  weightKg: null,
  heightCm: null,
};

/** Each reading as read out: its value, then what it is. */
const readings = () =>
  screen
    .getAllByRole("definition")
    .map((value, index) => [value.textContent, screen.getAllByRole("term")[index].textContent]);

describe("VitalsReadout (plan §32.1)", () => {
  it("says nothing is recorded until a reading is taken", () => {
    const { rerender } = render(<VitalsReadout vitals={null} />);
    expect(screen.getByText("Nothing recorded")).toBeInTheDocument();
    rerender(<VitalsReadout vitals={NONE} />);
    expect(screen.getByText("Nothing recorded")).toBeInTheDocument();
  });

  it("reads each taken reading out with its unit, blood pressure as one, and the BMI", () => {
    render(
      <VitalsReadout
        vitals={{ ...NONE, systolic: 120, diastolic: 80, temperatureF: 98.6, spo2: 97, weightKg: 64.25, heightCm: 160 }}
      />,
    );
    expect(readings()).toEqual([
      ["120/80", "Blood pressure (mmHg)"],
      ["98.6", "Temperature (°F)"],
      ["97", "SpO₂ (%)"],
      ["64.25", "Weight (kg)"],
      ["160", "Height (cm)"],
      ["25.1", "BMI"],
    ]);
  });

  it("leaves out blood pressure with one reading, and the BMI without both weight and height", () => {
    render(<VitalsReadout vitals={{ ...NONE, systolic: 120, pulse: 72, weightKg: 64 }} />);
    expect(readings()).toEqual([
      ["72", "Pulse (/min)"],
      ["64", "Weight (kg)"],
    ]);
  });
});
