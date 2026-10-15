import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Visit, Vitals } from "@/features/visits/types";
import { ApiError } from "@/lib/api/client";
import { Providers } from "@tests/support/providers";

const { client, refresh } = vi.hoisted(() => ({
  client: { saveVitals: vi.fn() },
  refresh: vi.fn(),
}));
vi.mock("@/features/visits/api.client", () => ({ VisitsClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));

const { VitalsSection } = await import("@/features/visits/components/VitalsSection");

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
const TAKEN: Vitals = { ...NONE, systolic: 120, diastolic: 80, pulse: 72 };

const aVisit = (vitals: Vitals | null): Visit => ({
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
  alerts: [],
  complaint: null,
  diagnosis: null,
  notes: null,
  followUpOn: null,
  vitals,
});

const draw = (vitals: Vitals | null, writes = true) =>
  render(
    <Providers>
      <VitalsSection visit={aVisit(vitals)} writes={writes} />
    </Providers>,
  );
const section = () => screen.getByRole("region", { name: "Vitals" });
const field = (name: string) => within(section()).getByRole("textbox", { name });
const save = () => within(section()).queryByRole("button", { name: "Save vitals" });

beforeEach(() => {
  vi.clearAllMocks();
  refresh.mockResolvedValue(undefined);
});

describe("VitalsSection (plan §12.2; D202, D206)", () => {
  it("reads them out to whoever may only read", () => {
    draw(TAKEN, false);
    expect(within(section()).getByText("120/80")).toBeInTheDocument();
    expect(within(section()).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("holds the readings in their fields, offering Save vitals once something is typed", async () => {
    draw(TAKEN);
    expect(field("Systolic (mmHg)")).toHaveValue("120");
    expect(field("Pulse (/min)")).toHaveValue("72");
    expect(field("Temperature (°F)")).toHaveValue("");
    expect(save()).not.toBeInTheDocument();
    await userEvent.type(field("Temperature (°F)"), "98.6");
    expect(save()).toBeInTheDocument();
  });

  it("saves what is typed from the copy read, says so, and starts again from what was saved", async () => {
    const saved = { ...TAKEN, temperatureF: 98.6 };
    client.saveVitals.mockResolvedValue({ visitId: "v-1", vitals: saved });
    draw(TAKEN);
    await userEvent.type(field("Temperature (°F)"), "98.6");
    await userEvent.click(save()!);
    expect(client.saveVitals).toHaveBeenCalledWith({
      id: "v-1",
      input: {
        vitals: {
          systolic: "120",
          diastolic: "80",
          pulse: "72",
          temperatureF: "98.6",
          spo2: "",
          respiratoryRate: "",
          weightKg: "",
          heightCm: "",
        },
        seen: TAKEN,
      },
    });
    expect((await screen.findAllByText("Vitals saved"))[0]).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledWith(["/api/visits/v-1"]);
    expect(field("Temperature (°F)")).toHaveValue("98.6");
    await waitFor(() => expect(save()).not.toBeInTheDocument());
  });

  it("saves nothing while a reading is wrong, saying why under it", async () => {
    draw(null);
    await userEvent.type(field("Pulse (/min)"), "999");
    await userEvent.click(save()!);
    expect(await within(section()).findByText("Pulse must be from 20 to 250.")).toBeInTheDocument();
    expect(client.saveVitals).not.toHaveBeenCalled();
  });

  it("reads the visit again when someone saved them meanwhile, and says it wasn't saved", async () => {
    client.saveVitals.mockRejectedValue(new ApiError(409, "VISIT_CHANGED", "Changed."));
    draw(null);
    await userEvent.type(field("Pulse (/min)"), "80");
    await userEvent.click(save()!);
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t saved" })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledWith(["/api/visits/v-1"]);
  });

  it("reads nothing again for any other failure", async () => {
    client.saveVitals.mockRejectedValueOnce(new ApiError(422, "PATIENT_ARCHIVED", "Archived."));
    client.saveVitals.mockRejectedValueOnce(new Error("offline"));
    draw(null);
    await userEvent.type(field("Pulse (/min)"), "80");
    await userEvent.click(save()!);
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t saved" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(save()!);
    await waitFor(() => expect(client.saveVitals).toHaveBeenCalledTimes(2));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps what is typed when someone saves meanwhile, showing theirs, which Use theirs takes", async () => {
    const { rerender } = draw(TAKEN);
    await userEvent.type(field("SpO₂ (%)"), "97");
    const theirs = { ...TAKEN, pulse: 88 };
    rerender(
      <Providers>
        <VitalsSection visit={aVisit(theirs)} writes />
      </Providers>,
    );
    const notice = within(section()).getByRole("status");
    expect(notice).toHaveTextContent("Someone saved this meanwhile");
    expect(within(notice).getByText("88")).toBeInTheDocument();
    expect(field("SpO₂ (%)")).toHaveValue("97");
    expect(field("Pulse (/min)")).toHaveValue("72");

    await userEvent.click(within(notice).getByRole("button", { name: "Use theirs" }));
    expect(field("Pulse (/min)")).toHaveValue("88");
    expect(field("SpO₂ (%)")).toHaveValue("");
    expect(within(section()).queryByRole("status")).not.toBeInTheDocument();
  });
});
