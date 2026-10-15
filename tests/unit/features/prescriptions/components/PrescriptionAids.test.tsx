import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrescriptionItem, PrescriptionTemplate, PreviousPrescription } from "@/features/prescriptions/types";
import type { Visit } from "@/features/visits/types";
import { todayKey } from "@/lib/dates/calendar";
import { Providers } from "@tests/support/providers";

const { templates } = vi.hoisted(() => ({
  templates: { read: vi.fn(), current: {} as { data?: PrescriptionTemplate[]; error?: unknown; mutate?: () => void } },
}));
vi.mock("@/features/prescriptions/hooks/useTemplates", () => ({
  useTemplates: (doctorId: string | null) => {
    templates.read(doctorId);
    return templates.current;
  },
}));

const { PrescriptionAids } = await import("@/features/prescriptions/components/PrescriptionAids");

const PARACETAMOL: PrescriptionItem = {
  medicine: "Paracetamol",
  strength: "500 mg",
  dose: "1 tab",
  frequency: "1-0-1",
  timing: "AFTER_FOOD",
  durationDays: 5,
  instructions: null,
};
const item = (medicine: string): PrescriptionItem => ({ ...PARACETAMOL, medicine });

const year = todayKey().slice(0, 4);
const before: PreviousPrescription = {
  day: `${year}-10-12`,
  doctorName: "Ravi Kumar",
  advice: "Rest",
  items: [PARACETAMOL],
};

const aVisit = (overrides: Partial<Visit> = {}) =>
  ({ id: "v-1", doctorId: "d-1", doctorName: "Maya Rao", previousPrescription: null, ...overrides }) as Visit;

const onAdd = vi.fn();
const draw = (overrides: Partial<Visit> = {}, own = true) =>
  render(
    <Providers>
      <PrescriptionAids visit={aVisit(overrides)} own={own} onAdd={onAdd} />
    </Providers>,
  );

const template = (overrides: Partial<PrescriptionTemplate>): PrescriptionTemplate => ({
  id: "t-1",
  name: "Viral fever",
  advice: "Plenty of fluids",
  active: true,
  items: [PARACETAMOL],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  templates.current = { data: [] };
});

describe("Repeat (D236)", () => {
  it("names the day and doctor of the prescription before, and adds it in a tap", async () => {
    draw({ previousPrescription: before });
    await userEvent.click(screen.getByRole("button", { name: "Repeat 12 Oct · Dr. Ravi Kumar" }));
    expect(onAdd).toHaveBeenCalledWith({ items: [PARACETAMOL], advice: "Rest", from: "12 Oct · Dr. Ravi Kumar" });
  });

  it("says the year of another year's, and a doctor no longer on the team", async () => {
    draw({ previousPrescription: { ...before, day: "2025-03-02", doctorName: null } });
    await userEvent.click(screen.getByRole("button", { name: "Repeat 2 Mar 2025 · No longer on the team" }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ from: "2 Mar 2025 · No longer on the team" }));
  });

  it("is not there when the patient has none before", () => {
    draw();
    expect(screen.queryByRole("button", { name: /^Repeat/ })).not.toBeInTheDocument();
  });
});

describe("Templates (D241)", () => {
  const sheet = () => screen.getByRole("dialog");

  it("reads the doctor's templates only once opened, and offers those in use, each with its medicines", async () => {
    templates.current = {
      data: [
        template({ items: [PARACETAMOL, item("Cetirizine"), item("Dolo")] }),
        template({ id: "t-2", name: "Post-extraction", items: [], advice: "Cold food" }),
        template({ id: "t-3", name: "Old", active: false }),
      ],
    };
    draw();
    expect(templates.read).toHaveBeenLastCalledWith(null);
    await userEvent.click(screen.getByRole("button", { name: "Templates" }));
    expect(templates.read).toHaveBeenLastCalledWith("d-1");
    expect(within(sheet()).getByRole("heading", { name: "Templates" })).toBeInTheDocument();
    const rows = within(sheet()).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Viral feverParacetamol, Cetirizine +1",
      "Post-extractionAdvice only",
    ]);

    await userEvent.click(within(sheet()).getByRole("button", { name: /^Post-extraction/ }));
    expect(onAdd).toHaveBeenCalledWith({ items: [], advice: "Cold food", from: "“Post-extraction”" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("names the doctor's for whoever types for them, and says when there are none", async () => {
    draw({}, false);
    await userEvent.click(screen.getByRole("button", { name: "Templates" }));
    expect(within(sheet()).getByRole("heading", { name: "Maya Rao’s templates" })).toBeInTheDocument();
    expect(sheet()).toHaveTextContent("No templates yet");
    expect(sheet()).toHaveTextContent("Maya Rao hasn’t saved any yet.");
  });

  it("tells the doctor where one is made, and a doctor no longer on the team is named so", async () => {
    const { unmount } = draw();
    await userEvent.click(screen.getByRole("button", { name: "Templates" }));
    expect(sheet()).toHaveTextContent("Save a prescription as a template, or start one in My account.");
    unmount();

    draw({ doctorName: null }, false);
    await userEvent.click(screen.getByRole("button", { name: "Templates" }));
    expect(within(sheet()).getByRole("heading", { name: "No longer on the team’s templates" })).toBeInTheDocument();
  });

  it("stands rows in while they load, and says why they could not, with Try again", async () => {
    templates.current = {};
    const { unmount } = draw();
    await userEvent.click(screen.getByRole("button", { name: "Templates" }));
    expect(within(sheet()).getByLabelText("Loading…")).toHaveAttribute("aria-busy", "true");
    unmount();

    const mutate = vi.fn();
    templates.current = { error: new Error("down"), mutate };
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Templates" }));
    expect(sheet()).toHaveTextContent("The templates couldn't be loaded.");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Try again" }));
    expect(mutate).toHaveBeenCalled();
  });
});
