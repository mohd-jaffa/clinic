import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditTreatmentSheet, NewTreatmentSheet } from "@/features/treatments/components/TreatmentForms";
import type { Treatment } from "@/features/treatments/types";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { Providers } from "@tests/support/providers";
import { aTreatment } from "@tests/support/treatments";

const { client, refresh, services, doctors } = vi.hoisted(() => ({
  client: { create: vi.fn(), change: vi.fn() },
  refresh: vi.fn(),
  services: { current: undefined as unknown },
  doctors: { current: undefined as unknown },
}));
vi.mock("@/features/treatments/api.client", () => ({ TreatmentsClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));
vi.mock("@/features/clinic/hooks/useServices", () => ({ useServices: () => ({ data: services.current }) }));
vi.mock("@/features/team/hooks/useDoctors", () => ({ useDoctors: () => ({ data: doctors.current }) }));

const MAYA = "11111111-1111-4111-8111-111111111111";
const RAVI = "22222222-2222-4222-8222-222222222222";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const VISIT = "44444444-4444-4444-8444-444444444444";
const onClose = vi.fn();
const onDone = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockResolvedValue(undefined);
  services.current = [
    { id: "s-1", name: "Root canal", category: "PROCEDURE", pricePaise: 450000, active: true },
    { id: "s-2", name: "Root planing", category: "PROCEDURE", pricePaise: 150050, active: true },
    { id: "s-3", name: "Root X-ray", category: "INVESTIGATION", pricePaise: 50000, active: true },
    { id: "s-4", name: "Root old", category: "PROCEDURE", pricePaise: 100, active: false },
  ];
  doctors.current = [
    { id: MAYA, name: "Maya Rao" },
    { id: RAVI, name: "Ravi Iyer" },
  ];
});

const drawNew = (visitId: string | null, firstDoctor = "") =>
  render(
    <Providers>
      <NewTreatmentSheet patientId={PATIENT} visitId={visitId} firstDoctor={firstDoctor} open onClose={onClose} />
    </Providers>,
  );
const nameField = () => screen.getByRole("combobox", { name: /^Treatment/ });

describe("NewTreatmentSheet in a visit (D252, D258)", () => {
  it("begins today, a procedure from the price list filling its name and estimate, with what was done", async () => {
    client.create.mockResolvedValue({ id: "t-1", name: "Root canal" });
    drawNew(VISIT);
    const sheet = screen.getByRole("dialog", { name: "New treatment" });
    expect(within(sheet).getByRole("radio", { name: "Start today" })).toBeChecked();
    expect(within(sheet).queryByRole("combobox", { name: /^Doctor/ })).not.toBeInTheDocument();
    await userEvent.type(nameField(), "root");
    // Active procedures only, with their prices.
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Root canal₹4,500", "Root planing₹1,500.50"]);
    await userEvent.click(options[0]);
    expect(nameField()).toHaveValue("Root canal");
    expect(within(sheet).getByRole("textbox", { name: /^Estimated cost/ })).toHaveValue("4500");
    await userEvent.type(within(sheet).getByRole("textbox", { name: "What was done today" }), "Access opened");
    await userEvent.click(within(sheet).getByRole("button", { name: "Add treatment" }));
    await waitFor(() =>
      expect(client.create).toHaveBeenCalledWith({
        patientId: PATIENT,
        visitId: VISIT,
        doctorId: "",
        start: "IN_PROGRESS",
        name: "Root canal",
        description: "",
        estimatedCost: "4500",
        note: "Access opened",
        nextDueOn: "",
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("asks for nothing done when it is only planned, and stays open when not added", async () => {
    client.create.mockRejectedValue(new Error("down"));
    drawNew(VISIT);
    await userEvent.click(screen.getByRole("radio", { name: "Plan it" }));
    expect(screen.queryByRole("textbox", { name: "What was done today" })).not.toBeInTheDocument();
    await userEvent.type(nameField(), "Crown");
    await userEvent.click(screen.getByRole("button", { name: "Add treatment" }));
    await waitFor(() => expect(client.create).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("refuses one with no name, and offers nothing until something is typed or with no price list", async () => {
    drawNew(VISIT);
    await userEvent.click(screen.getByRole("button", { name: "Add treatment" }));
    expect(await screen.findByText("Treatment needs a value.")).toBeInTheDocument();
    expect(client.create).not.toHaveBeenCalled();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    services.current = undefined;
    drawNew(VISIT);
    await userEvent.type(screen.getAllByRole("combobox", { name: /^Treatment/ })[1], "root");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});

describe("NewTreatmentSheet from the profile (D252, D259)", () => {
  it("is planned for the doctor chosen, its next sitting set by a chip", async () => {
    client.create.mockResolvedValue({ id: "t-2", name: "Crown" });
    drawNew(null, MAYA);
    const sheet = screen.getByRole("dialog", { name: "New treatment" });
    expect(within(sheet).getByRole("radio", { name: "Plan it" })).toBeChecked();
    expect(within(sheet).getByRole("combobox", { name: /^Doctor/ })).toHaveTextContent("Maya Rao");
    await userEvent.type(nameField(), "Crown");
    await userEvent.click(within(sheet).getByRole("radio", { name: "2 weeks" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Add treatment" }));
    await waitFor(() =>
      expect(client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          visitId: null,
          doctorId: MAYA,
          start: "PLANNED",
          nextDueOn: addDaysKey(todayKey(), 14),
        }),
      ),
    );
  });

  it("asks for a doctor when none is chosen, with no list of doctors yet", async () => {
    doctors.current = undefined;
    drawNew(null);
    await userEvent.type(nameField(), "Crown");
    await userEvent.click(screen.getByRole("button", { name: "Add treatment" }));
    expect(await screen.findByText("Choose doctor.")).toBeInTheDocument();
    expect(client.create).not.toHaveBeenCalled();
  });
});

describe("EditTreatmentSheet (D251, D252)", () => {
  const drawEdit = (treatment: Treatment) => {
    const view = (next: Treatment) => (
      <Providers>
        <EditTreatmentSheet treatment={next} visitId={null} open onClose={onClose} onDone={onDone} />
      </Providers>
    );
    const drawn = render(view(treatment));
    return (next: Treatment) => drawn.rerender(view(next));
  };

  it("holds its details, hands it to another doctor while open, and saves from the copy read", async () => {
    client.change.mockResolvedValue({
      name: "Root canal",
      description: null,
      estimatedCostPaise: 450000,
      doctorId: RAVI,
    });
    drawEdit(aTreatment({ doctorId: MAYA, description: "Upper molar" }));
    const sheet = screen.getByRole("dialog", { name: "Edit treatment" });
    expect(nameField()).toHaveValue("Root canal");
    expect(within(sheet).getByRole("textbox", { name: /^Description/ })).toHaveValue("Upper molar");
    expect(within(sheet).getByRole("textbox", { name: /^Estimated cost/ })).toHaveValue("4500");
    await userEvent.click(within(sheet).getByRole("combobox", { name: /^Doctor/ }));
    await userEvent.click(screen.getByRole("option", { name: "Ravi Iyer" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(client.change).toHaveBeenCalledWith({
        id: "t-1",
        input: {
          part: "DETAILS",
          changes: { name: "Root canal", description: "Upper molar", estimatedCost: "4500", doctorId: RAVI },
          seen: { name: "Root canal", description: "Upper molar", estimatedCostPaise: 450000, doctorId: MAYA },
        },
      }),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("offers only the doctor it has while the clinic's are not read yet", () => {
    doctors.current = undefined;
    drawEdit(aTreatment());
    expect(screen.getByRole("combobox", { name: /^Doctor/ })).toHaveTextContent("Maya Rao");
  });

  it("keeps a doctor who has left among the choices; and, closed, offers no doctor", async () => {
    drawEdit(aTreatment({ doctorId: "gone", doctorName: null, estimatedCostPaise: null }));
    expect(screen.getByRole("combobox", { name: /^Doctor/ })).toHaveTextContent("No longer on the team");
    expect(screen.getByRole("textbox", { name: /^Estimated cost/ })).toHaveValue("");
    drawEdit(aTreatment({ id: "b", status: "COMPLETED", name: "Crown" }));
    expect(screen.getAllByRole("dialog", { name: "Edit treatment" })[1]).not.toHaveTextContent("Doctor");
  });

  it("shows theirs beside what is typed when it changed meanwhile, picking a procedure too", async () => {
    const redraw = drawEdit(aTreatment());
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), "Root");
    await userEvent.click((await screen.findAllByRole("option"))[1]);
    expect(nameField()).toHaveValue("Root planing");
    redraw(aTreatment({ name: "Root canal (UL6)", description: "Theirs", estimatedCostPaise: null }));
    const theirs = (await screen.findByText("Someone saved this meanwhile")).closest("[role=status]")!;
    expect(theirs).toHaveTextContent("TreatmentRoot canal (UL6)");
    expect(theirs).toHaveTextContent("DescriptionTheirs");
    expect(theirs).not.toHaveTextContent("Estimated cost");
    redraw(aTreatment({ name: "Root canal (UL6)", description: null }));
    await waitFor(() => expect(theirs).toHaveTextContent("Estimated cost₹4,500"));
  });
});
