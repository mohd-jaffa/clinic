import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type Resolver } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { VitalsFields } from "@/features/visits/components/VitalsFields";
import { vitalsInput } from "@/features/visits/vitals";
import { vitalsSchema, type VitalsInput } from "@/lib/validation";

function Fields({ disabled }: { disabled?: boolean }) {
  const form = useForm<VitalsInput>({
    resolver: zodResolver(vitalsSchema) as unknown as Resolver<VitalsInput>,
    defaultValues: vitalsInput(null),
  });
  return (
    <form noValidate onSubmit={form.handleSubmit(() => undefined)}>
      <VitalsFields form={form} disabled={disabled} />
      <button type="submit">Check</button>
    </form>
  );
}

const field = (name: string) => screen.getByRole("textbox", { name });
const bmi = () => screen.getByText(/^BMI/);

describe("VitalsFields (plan §12.2)", () => {
  it("asks for each reading with its unit, a number pad on a phone", () => {
    render(<Fields />);
    expect(screen.getAllByRole("textbox")).toHaveLength(8);
    for (const name of [
      "Systolic (mmHg)",
      "Diastolic (mmHg)",
      "Pulse (/min)",
      "Temperature (°F)",
      "SpO₂ (%)",
      "Respiratory rate (/min)",
      "Weight (kg)",
      "Height (cm)",
    ]) {
      expect(field(name)).toBeEnabled();
    }
    expect(field("Pulse (/min)")).toHaveAttribute("inputmode", "numeric");
    expect(field("Temperature (°F)")).toHaveAttribute("inputmode", "decimal");
  });

  it("works out the BMI as weight and height are typed, and none while either is not a number", async () => {
    render(<Fields />);
    expect(bmi()).toHaveTextContent("BMI —");
    await userEvent.type(field("Weight (kg)"), "64");
    expect(bmi()).toHaveTextContent("BMI —");
    await userEvent.type(field("Height (cm)"), "160");
    expect(bmi()).toHaveTextContent("BMI 25");
    await userEvent.clear(field("Weight (kg)"));
    await userEvent.type(field("Weight (kg)"), "6x");
    expect(bmi()).toHaveTextContent("BMI —");
  });

  it("says what is wrong with a reading under its field", async () => {
    render(<Fields />);
    await userEvent.type(field("Systolic (mmHg)"), "300");
    await userEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Systolic must be from 50 to 260.")).toBeInTheDocument();
  });

  it("can be shown turned off", () => {
    render(<Fields disabled />);
    expect(field("Pulse (/min)")).toBeDisabled();
  });
});
