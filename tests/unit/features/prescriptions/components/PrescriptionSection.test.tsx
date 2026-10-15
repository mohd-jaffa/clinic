import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import type { PatientAlert } from "@/features/patients/types";
import type { Prescription, PrescriptionItem, PrescriptionTemplate } from "@/features/prescriptions/types";
import type { Visit } from "@/features/visits/types";
import { ApiError } from "@/lib/api/client";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { client, templatesClient, templates, refresh, auth } = vi.hoisted(() => ({
  client: { save: vi.fn() },
  templatesClient: { add: vi.fn(), change: vi.fn() },
  templates: { current: [] as PrescriptionTemplate[] },
  refresh: vi.fn(),
  auth: { current: {} as ReturnType<typeof authStub> },
}));
vi.mock("@/features/prescriptions/api.client", () => ({
  PrescriptionsClient: client,
  TemplatesClient: templatesClient,
}));
vi.mock("@/features/prescriptions/hooks/useTemplates", () => ({
  useTemplates: () => ({ data: templates.current }),
}));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
// The suggestions are the line's to test: here, none are ever found.
vi.mock("@/features/prescriptions/hooks/useMedicineSuggestions", () => ({
  useMedicineSuggestions: () => ({ data: undefined }),
}));

const { PrescriptionSection } = await import("@/features/prescriptions/components/PrescriptionSection");

const PENICILLIN: PatientAlert = { id: "al-1", kind: "ALLERGY", label: "Penicillin", note: null, active: true };
const DIABETES: PatientAlert = { id: "al-2", kind: "CONDITION", label: "Diabetes", note: null, active: true };

const PARACETAMOL: PrescriptionItem = {
  medicine: "Paracetamol",
  strength: "500 mg",
  dose: "1 tab",
  frequency: "1-0-1",
  timing: "AFTER_FOOD",
  durationDays: 5,
  instructions: null,
};

const aPrescription = (overrides: Partial<Prescription> = {}): Prescription => ({
  id: "rx-1",
  items: [PARACETAMOL],
  advice: "Plenty of fluids",
  printDiagnosis: false,
  typedBy: null,
  ...overrides,
});

/** Asha Iyer's visit with Maya Rao, who has her registration number. */
const aVisit = (overrides: Partial<Visit> = {}): Visit => ({
  id: "v-1",
  status: "OPEN",
  billingStatus: null,
  day: "2026-10-13",
  startedAt: "2026-10-13T05:00:00Z",
  completedAt: null,
  patient: {
    id: "p-1",
    name: "Asha Iyer",
    number: 1012,
    phone: "+919876543210",
    dateOfBirth: "1990-04-12",
    gender: "FEMALE",
    archived: false,
  },
  doctorId: "d-1",
  doctorName: "Maya Rao",
  doctorRegistration: "KMC 12345",
  prescription: null,
  previousPrescription: null,
  appointment: { id: "a-1", status: "IN_PROGRESS", token: 7, urgentAt: null },
  alerts: [PENICILLIN, DIABETES],
  complaint: null,
  diagnosis: null,
  notes: null,
  followUpOn: null,
  vitals: null,
  ...overrides,
});

const view = (visit: Visit, writes: boolean) => (
  <Providers>
    <PrescriptionSection visit={visit} writes={writes} />
  </Providers>
);
const draw = (overrides: Partial<Visit> = {}, writes = true) => render(view(aVisit(overrides), writes));
const section = () => screen.getByRole("region", { name: "Prescription" });
const save = () => within(section()).queryByRole("button", { name: "Save prescription" });
const add = () => within(section()).queryByRole("button", { name: "Add medicine" });
const line = (n: number) => within(section()).getByRole("group", { name: `Medicine ${n}` });
const medicine = (n: number) => within(line(n)).getByRole("combobox", { name: "Medicine" });

/** What a saved line holds, as the server hands it back. */
const saved = (items: PrescriptionItem[], advice: string | null = null) => ({
  prescription: { items, advice, printDiagnosis: false },
});

const NURSE: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit", "prescriptions.write"];

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub({ role: "STAFF", permissions: NURSE });
  refresh.mockResolvedValue(undefined);
  templates.current = [];
});

describe("PrescriptionSection for whoever may only read (plan §13)", () => {
  it("reads it out, naming who typed it for the doctor (D45)", () => {
    const { unmount } = draw({ prescription: aPrescription({ typedBy: "Priya Nair" }) }, false);
    expect(section()).toHaveTextContent("Paracetamol 500 mg");
    expect(within(section()).getByText("Typed by Priya Nair")).toBeInTheDocument();
    expect(within(section()).queryByRole("textbox")).not.toBeInTheDocument();
    expect(save()).not.toBeInTheDocument();
    expect(within(section()).queryByText(/registration number/)).not.toBeInTheDocument();
    unmount();

    draw({ prescription: aPrescription() }, false);
    expect(within(section()).queryByText(/Typed by/)).not.toBeInTheDocument();
  });

  it("says there is none yet", () => {
    draw({}, false);
    expect(within(section()).getByText("No prescription yet")).toBeInTheDocument();
    expect(within(section()).queryByText(/Typed by/)).not.toBeInTheDocument();
  });
});

describe("PrescriptionSection before the doctor has a registration number (D213)", () => {
  it("writes nothing, says why and where it is added — with Open Team for whoever manages the team", () => {
    auth.current = authStub();
    const { unmount } = draw({ doctorRegistration: null, prescription: aPrescription({ typedBy: "Priya Nair" }) });
    expect(section()).toHaveTextContent(
      "Maya Rao has no registration number yet, so a prescription can’t be written in their name.",
    );
    expect(section()).toHaveTextContent("It’s added in Team, with the doctor’s details.");
    expect(within(section()).getByRole("link", { name: "Open Team" })).toHaveAttribute("href", "/team");
    expect(section()).toHaveTextContent("Paracetamol 500 mg");
    expect(within(section()).getByText("Typed by Priya Nair")).toBeInTheDocument();
    expect(add()).not.toBeInTheDocument();
    unmount();

    auth.current = authStub({ role: "STAFF", permissions: NURSE });
    draw({ doctorRegistration: null, doctorName: null });
    expect(section()).toHaveTextContent("No longer on the team has no registration number yet");
    expect(within(section()).queryByRole("link", { name: "Open Team" })).not.toBeInTheDocument();
    expect(within(section()).getByText("No prescription yet")).toBeInTheDocument();
  });

  it("offers Open Team to no one outside a clinic", () => {
    auth.current = { ...authStub(), membership: null };
    draw({ doctorRegistration: null });
    expect(within(section()).queryByRole("link", { name: "Open Team" })).not.toBeInTheDocument();
  });
});

describe("PrescriptionSection for whoever writes it (D210)", () => {
  it("has the patient's allergies above it — or says there are none", () => {
    const { unmount } = draw();
    const chips = within(section()).getByRole("list", { name: "Alerts" });
    expect(
      within(chips)
        .getAllByRole("listitem")
        .map((chip) => chip.textContent),
    ).toEqual(["Allergy: Penicillin"]);
    unmount();

    draw({ alerts: [DIABETES] });
    expect(within(section()).getByText("No allergies recorded")).toBeInTheDocument();
    expect(within(section()).queryByRole("list", { name: "Alerts" })).not.toBeInTheDocument();
  });

  it("adds a medicine, its name in focus, and saves the whole from no copy with Save prescription", async () => {
    client.save.mockResolvedValue(
      saved([{ ...PARACETAMOL, strength: null, dose: null, frequency: null, timing: null, durationDays: null }]),
    );
    draw();
    expect(save()).not.toBeInTheDocument();
    await userEvent.click(add()!);
    expect(medicine(1)).toHaveFocus();
    await userEvent.type(medicine(1), "Paracetamol");
    await userEvent.click(save()!);
    expect(client.save).toHaveBeenCalledWith({
      visitId: "v-1",
      input: {
        prescription: {
          items: [
            {
              medicine: "Paracetamol",
              strength: "",
              dose: "",
              frequency: "",
              timing: "",
              durationDays: "",
              instructions: "",
            },
          ],
          advice: "",
          printDiagnosis: false,
        },
        seen: null,
      },
    });
    expect((await screen.findAllByText("Prescription saved"))[0]).toBeInTheDocument();
    await waitFor(() => expect(save()).not.toBeInTheDocument());
    expect(medicine(1)).toHaveValue("Paracetamol");
  });

  it("holds the prescription saved in its fields, and saves from that copy — who typed it named under it", async () => {
    client.save.mockResolvedValue(saved([PARACETAMOL], "Rest"));
    draw({ prescription: aPrescription({ typedBy: "Priya Nair" }) });
    expect(medicine(1)).toHaveValue("Paracetamol");
    expect(within(line(1)).getByRole("textbox", { name: "Days" })).toHaveValue("5");
    expect(within(section()).getByRole("textbox", { name: "Advice" })).toHaveValue("Plenty of fluids");
    expect(within(section()).getByText("Typed by Priya Nair")).toBeInTheDocument();

    await userEvent.clear(within(section()).getByRole("textbox", { name: "Advice" }));
    await userEvent.type(within(section()).getByRole("textbox", { name: "Advice" }), "Rest");
    await userEvent.click(within(section()).getByRole("checkbox", { name: "Print the diagnosis" }));
    await userEvent.click(save()!);
    expect(client.save).toHaveBeenCalledWith({
      visitId: "v-1",
      input: {
        prescription: {
          items: [
            {
              medicine: "Paracetamol",
              strength: "500 mg",
              dose: "1 tab",
              frequency: "1-0-1",
              timing: "AFTER_FOOD",
              durationDays: "5",
              instructions: "",
            },
          ],
          advice: "Rest",
          printDiagnosis: true,
        },
        seen: { items: [PARACETAMOL], advice: "Plenty of fluids", printDiagnosis: false },
      },
    });
  });

  it("asks before saving a medicine that names an allergy (D212): Cancel saves nothing, Save anyway saves", async () => {
    client.save.mockResolvedValue(saved([{ ...PARACETAMOL, medicine: "Penicillin V" }]));
    draw();
    await userEvent.click(add()!);
    await userEvent.type(medicine(1), " Penicillin V ");
    await userEvent.click(add()!);
    await userEvent.type(medicine(2), "Paracetamol");
    await userEvent.click(save()!);
    const asked = await screen.findByRole("alertdialog", { name: "Save it with an allergy?" });
    expect(asked).toHaveTextContent("Penicillin V matches the allergy to Penicillin. Check it before saving.");
    await userEvent.click(within(asked).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(client.save).not.toHaveBeenCalled();

    await userEvent.click(save()!);
    await userEvent.click(
      within(await screen.findByRole("alertdialog", { name: "Save it with an allergy?" })).getByRole("button", {
        name: "Save anyway",
      }),
    );
    await waitFor(() => expect(client.save).toHaveBeenCalledTimes(1));
  });

  it("refuses a line with no medicine, beside it, and sends nothing", async () => {
    draw();
    await userEvent.click(add()!);
    await userEvent.click(save()!);
    expect(await within(line(1)).findByText("Medicine needs a value.")).toBeInTheDocument();
    expect(client.save).not.toHaveBeenCalled();
  });

  it("moves a medicine and removes one", async () => {
    draw({
      prescription: aPrescription({
        items: [PARACETAMOL, { ...PARACETAMOL, medicine: "Cetirizine", strength: "10 mg" }],
      }),
    });
    await userEvent.click(within(line(2)).getByRole("button", { name: "Move medicine 2 up" }));
    expect(medicine(1)).toHaveValue("Cetirizine");
    expect(medicine(2)).toHaveValue("Paracetamol");
    expect(save()).toBeInTheDocument();
    await userEvent.click(within(line(1)).getByRole("button", { name: "Move medicine 1 down" }));
    expect(medicine(1)).toHaveValue("Paracetamol");
    await userEvent.click(within(line(1)).getByRole("button", { name: "Remove medicine 1" }));
    expect(medicine(1)).toHaveValue("Cetirizine");
    expect(within(section()).queryByRole("group", { name: "Medicine 2" })).not.toBeInTheDocument();
  });

  it("offers no more medicines than a prescription holds", () => {
    draw({ prescription: aPrescription({ items: Array.from({ length: 30 }, () => PARACETAMOL) }) });
    expect(add()).not.toBeInTheDocument();
  });

  it("reads the visit again when someone saved it meanwhile — and not for any other failure", async () => {
    client.save.mockRejectedValueOnce(new ApiError(409, "VISIT_CHANGED", "Changed."));
    client.save.mockRejectedValueOnce(new ApiError(422, "PRESCRIPTION_NEEDS_REGISTRATION", "No number."));
    draw();
    await userEvent.click(add()!);
    await userEvent.type(medicine(1), "Paracetamol");
    await userEvent.click(save()!);
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t saved" })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledWith(["/api/visits/v-1"]);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    refresh.mockClear();
    await userEvent.click(save()!);
    await waitFor(() => expect(client.save).toHaveBeenCalledTimes(2));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps what is typed when someone saves meanwhile, showing theirs, which Use theirs takes (D206)", async () => {
    const { rerender } = draw();
    await userEvent.click(add()!);
    await userEvent.type(medicine(1), "Ibuprofen");
    rerender(view(aVisit({ prescription: aPrescription() }), true));
    const notice = within(section()).getByRole("status");
    expect(notice).toHaveTextContent("Paracetamol 500 mg");
    expect(medicine(1)).toHaveValue("Ibuprofen");
    await userEvent.click(within(notice).getByRole("button", { name: "Use theirs" }));
    expect(medicine(1)).toHaveValue("Paracetamol");
    expect(within(section()).getByRole("textbox", { name: "Advice" })).toHaveValue("Plenty of fluids");
    expect(within(section()).queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("PrescriptionSection's printout (D221, D222)", () => {
  const print = () => within(section()).queryByRole("link", { name: "Print Asha Iyer’s prescription" });
  const download = () => within(section()).queryByRole("button", { name: "Download Asha Iyer’s prescription" });

  it("offers Print and Download for a saved prescription with a medicine — to whoever reads it too", () => {
    const { unmount } = draw({ prescription: aPrescription() }, false);
    expect(print()).toHaveAttribute("href", "/api/visits/v-1/prescription.pdf");
    expect(download()).toBeInTheDocument();
    unmount();

    draw({ prescription: aPrescription() });
    expect(print()).toBeInTheDocument();
    expect(download()).toBeInTheDocument();
    expect(save()).not.toBeInTheDocument();
  });

  it("has nothing to print with no prescription, no medicine on it, or a doctor with no registration number", () => {
    for (const [overrides, writes] of [
      [{ prescription: null }, false],
      [{ prescription: null }, true],
      [{ prescription: aPrescription({ items: [] }) }, false],
      [{ prescription: aPrescription({ items: [] }) }, true],
      [{ prescription: aPrescription(), doctorRegistration: null }, false],
      [{ prescription: aPrescription(), doctorRegistration: null }, true],
    ] as const) {
      const { unmount } = draw(overrides, writes);
      expect(print()).not.toBeInTheDocument();
      expect(download()).not.toBeInTheDocument();
      unmount();
    }
  });

  it("gives way to Save while there are unsaved changes, so a printout never misses what is typed", async () => {
    draw({ prescription: aPrescription() });
    await userEvent.type(within(section()).getByRole("textbox", { name: "Advice" }), ". Rest");
    expect(save()).toBeInTheDocument();
    expect(print()).not.toBeInTheDocument();
    expect(download()).not.toBeInTheDocument();
  });
});

describe("PrescriptionSection's Repeat and templates (D236 – D241)", () => {
  const advice = () => within(section()).getByRole("textbox", { name: "Advice" });
  const before = {
    day: "2026-10-06",
    doctorName: "Ravi Kumar",
    advice: "Rest",
    items: [{ ...PARACETAMOL, medicine: "Cetirizine", strength: "10 mg" }],
  };

  it("adds the prescription before after what is typed, its advice on a new line, and says so", async () => {
    draw({ prescription: aPrescription(), previousPrescription: before });
    await userEvent.click(within(section()).getByRole("button", { name: "Repeat 6 Oct · Dr. Ravi Kumar" }));
    expect(medicine(1)).toHaveValue("Paracetamol");
    expect(medicine(2)).toHaveValue("Cetirizine");
    expect(within(line(2)).getByRole("textbox", { name: "Strength" })).toHaveValue("10 mg");
    expect(advice()).toHaveValue("Plenty of fluids\nRest");
    expect(save()).toBeInTheDocument();
    expect((await screen.findAllByText("Added from 6 Oct · Dr. Ravi Kumar"))[0]).toBeInTheDocument();
  });

  it("adds a template picked from the sheet, its advice filling an empty box", async () => {
    templates.current = [{ id: "t-1", name: "Viral fever", advice: "Fluids", active: true, items: [PARACETAMOL] }];
    draw();
    await userEvent.click(within(section()).getByRole("button", { name: "Templates" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Viral fever/ }));
    expect(medicine(1)).toHaveValue("Paracetamol");
    expect(advice()).toHaveValue("Fluids");
    expect((await screen.findAllByText("Added from “Viral fever”"))[0]).toBeInTheDocument();
  });

  it("leaves the advice as it is when theirs is already there", async () => {
    draw({ prescription: aPrescription(), previousPrescription: { ...before, advice: "Plenty of fluids" } });
    await userEvent.click(within(section()).getByRole("button", { name: /^Repeat/ }));
    expect(medicine(2)).toHaveValue("Cetirizine");
    expect(advice()).toHaveValue("Plenty of fluids");
  });

  it("adds nothing past the most a prescription holds, and says why", async () => {
    draw({
      prescription: aPrescription({ items: Array.from({ length: 30 }, () => PARACETAMOL) }),
      previousPrescription: before,
    });
    await userEvent.click(within(section()).getByRole("button", { name: /^Repeat/ }));
    expect(await screen.findByRole("alertdialog", { name: "Too many medicines" })).toHaveTextContent(
      "A prescription holds at most 30 medicines, and this adds 1. Remove some first.",
    );
    expect(within(section()).queryByRole("group", { name: "Medicine 31" })).not.toBeInTheDocument();
    expect(save()).not.toBeInTheDocument();
  });
});

describe("PrescriptionSection's Save as template (D239, D240, D243)", () => {
  const saveAs = () => within(section()).queryByRole("button", { name: "Save as template" });
  const asDoctor = () => {
    const stub = authStub({ role: "DOCTOR", permissions: NURSE });
    auth.current = { ...stub, membership: { ...stub.membership!, doctorId: "d-1" } };
  };

  it("is the visit's doctor's, once there is a medicine", async () => {
    const { unmount } = draw({ prescription: aPrescription() });
    expect(saveAs()).not.toBeInTheDocument();
    unmount();

    asDoctor();
    draw();
    expect(saveAs()).not.toBeInTheDocument();
    await userEvent.click(add()!);
    expect(saveAs()).toBeInTheDocument();
  });

  it("checks the medicines first, then names what is on the screen as a template of the doctor's own", async () => {
    asDoctor();
    templatesClient.add.mockResolvedValue({ id: "t-1", name: "Fever", advice: null, active: true, items: [] });
    draw();
    await userEvent.click(add()!);
    await userEvent.click(saveAs()!);
    expect(await within(line(1)).findByText("Medicine needs a value.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.type(medicine(1), "Paracetamol");
    await userEvent.type(within(section()).getByRole("textbox", { name: "Advice" }), "Rest");
    await userEvent.click(saveAs()!);
    const sheet = await screen.findByRole("dialog", { name: "Save as template" });
    await userEvent.type(within(sheet).getByRole("textbox", { name: /Template name/ }), "Fever");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save as template" }));
    await waitFor(() =>
      expect(templatesClient.add).toHaveBeenCalledWith({
        template: {
          name: "Fever",
          items: [expect.objectContaining({ medicine: "Paracetamol" })],
          advice: "Rest",
        },
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // The prescription itself is not saved by it.
    expect(client.save).not.toHaveBeenCalled();
    expect(save()).toBeInTheDocument();
  });
});
