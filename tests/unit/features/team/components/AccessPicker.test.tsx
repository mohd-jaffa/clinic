import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { PERMISSION_PRESET_SETS, PERMISSION_TEXT, PERMISSIONS, type Permission } from "@/constants/permissions";
import { AccessPicker } from "@/features/team/components/AccessPicker";

function Harness({ allowed = PERMISSIONS, error }: { allowed?: readonly Permission[]; error?: string }) {
  const [value, setValue] = useState<Permission[]>([]);
  return <AccessPicker value={value} allowed={allowed} error={error} onChange={setValue} />;
}

const box = (name: string) => screen.getByRole("checkbox", { name });
const preset = (name: string) => screen.getByRole("radio", { name });

describe("AccessPicker (plan §8.3, D89)", () => {
  it("starts from a preset, shown as the one the ticks are, grouped by part of the clinic", async () => {
    render(<Harness />);
    expect(screen.getByRole("heading", { name: "What they can do" })).toBeInTheDocument();
    expect(preset("Custom")).toBeChecked();
    expect(screen.getByRole("group", { name: "Billing" })).toBeInTheDocument();

    await userEvent.click(preset("Receptionist"));
    expect(preset("Receptionist")).toBeChecked();
    for (const permission of PERMISSION_PRESET_SETS.RECEPTIONIST.permissions) {
      expect(box(PERMISSION_TEXT[permission].label), permission).toBeChecked();
    }
    expect(box("Give discounts")).not.toBeChecked();
  });

  it("ticks what a permission needs with it, locks it while needed, and turns the preset Custom", async () => {
    render(<Harness />);
    await userEvent.click(box("Give discounts"));
    expect(box("See patients")).toBeChecked();
    expect(box("Bill and collect")).toBeChecked();
    expect(box("See patients")).toBeDisabled();
    expect(preset("Custom")).toBeChecked();

    await userEvent.click(box("Give discounts"));
    expect(box("Give discounts")).not.toBeChecked();
    expect(box("Bill and collect")).toBeChecked();
    expect(box("Bill and collect")).toBeEnabled();
  });

  it("shows what this person may not give, unchangeable, and says why", () => {
    render(<Harness allowed={["patients.view", "patients.create"]} error="Some of these need others ticked too." />);
    expect(box("Manage the team")).toBeDisabled();
    expect(box("Manage the team")).toHaveAccessibleDescription("Only the owner can give this.");
    expect(box("See clinical records")).toHaveAccessibleDescription("You don’t have this yourself.");
    expect(box("Add patients")).toBeEnabled();
    expect(within(screen.getByRole("alert")).getByText("Some of these need others ticked too.")).toBeInTheDocument();
  });
});
