import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Visit, Vitals } from "@/features/visits/types";
import { ApiError } from "@/lib/api/client";
import { anAppointmentDetail } from "@tests/support/appointments";
import { Providers } from "@tests/support/providers";

const { client, refresh, read, keys } = vi.hoisted(() => ({
  client: { saveWaitingVitals: vi.fn() },
  refresh: vi.fn(),
  read: {
    current: {} as { data?: Partial<Visit>; error?: unknown; mutate: () => void; isValidating: boolean },
  },
  keys: [] as (string | null)[],
}));
vi.mock("@/features/visits/api.client", () => ({ VisitsClient: client }));
vi.mock("@/lib/query/useRevalidate", () => ({ useRevalidate: () => refresh }));
vi.mock("@/lib/query/useApiQuery", () => ({
  useApiQuery: (key: string | null) => {
    keys.push(key);
    return key === null ? { mutate: vi.fn(), isValidating: false } : read.current;
  },
}));

const { WaitingVitalsSheet } = await import("@/features/visits/components/WaitingVitalsSheet");

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
const TAKEN: Vitals = { ...NONE, weightKg: 58, heightCm: 160 };

/** What the appointment's change makes stale: its calendar, its detail, the queue, its patient's summary and timeline. */
const APPOINTMENT_ROUTES = [
  "/api/appointments",
  "/api/appointments/booked",
  "/api/appointments/a-1",
  "/api/queue",
  "/api/patients/p-1/summary",
  "/api/patients/p-1/timeline",
];

const handlers = { onClose: vi.fn(), onDone: vi.fn() };
const sheetOf = (visitId: string | null, open = true) => (
  <Providers>
    <WaitingVitalsSheet
      appointment={anAppointmentDetail({ status: "ARRIVED", token: 4, visitId })}
      open={open}
      {...handlers}
    />
  </Providers>
);
const sheet = () => screen.getByRole("dialog", { name: "Vitals for Rohan Mehta" });
const field = (name: string) => within(sheet()).getByRole("textbox", { name });
const save = () => userEvent.click(within(sheet()).getByRole("button", { name: "Save vitals" }));

beforeEach(() => {
  vi.clearAllMocks();
  keys.length = 0;
  refresh.mockResolvedValue(undefined);
  read.current = { data: { vitals: TAKEN }, mutate: vi.fn(), isValidating: false };
  client.saveWaitingVitals.mockResolvedValue({ visitId: "v-1", vitals: TAKEN });
});

describe("WaitingVitalsSheet (D203)", () => {
  it("takes a waiting patient's first vitals, reading no visit, and closes everything with a card", async () => {
    render(sheetOf(null));
    expect(keys.every((key) => key === null)).toBe(true);
    expect(field("Pulse (/min)")).toHaveValue("");
    await userEvent.type(field("Pulse (/min)"), "80");
    await save();
    await waitFor(() =>
      expect(client.saveWaitingVitals).toHaveBeenCalledWith({
        appointmentId: "a-1",
        input: {
          vitals: {
            systolic: "",
            diastolic: "",
            pulse: "80",
            temperatureF: "",
            spo2: "",
            respiratoryRate: "",
            weightKg: "",
            heightCm: "",
          },
          seen: null,
        },
      }),
    );
    expect(handlers.onDone).toHaveBeenCalled();
    expect((await screen.findAllByText("Vitals saved for Rohan Mehta"))[0]).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledWith(APPOINTMENT_ROUTES);
  });

  it("reads the visit their vitals opened only once opened, then changes the readings from that copy", async () => {
    const { rerender } = render(sheetOf("v-1", false));
    expect(keys.every((key) => key === null)).toBe(true);
    rerender(sheetOf("v-1"));
    expect(keys.at(-1)).toBe("/api/visits/v-1");
    expect(field("Weight (kg)")).toHaveValue("58");
    await userEvent.type(field("Pulse (/min)"), "80");
    await save();
    await waitFor(() => expect(client.saveWaitingVitals).toHaveBeenCalled());
    expect(client.saveWaitingVitals.mock.calls[0][0].input.seen).toEqual(TAKEN);
    expect(refresh).toHaveBeenCalledWith([...APPOINTMENT_ROUTES, "/api/visits/v-1"]);

    // Still read after it closes: closing it again reads the same.
    rerender(sheetOf("v-1", false));
    expect(keys.at(-1)).toBe("/api/visits/v-1");
  });

  it("starts empty for a visit with no readings yet", () => {
    read.current = { data: { vitals: null }, mutate: vi.fn(), isValidating: false };
    render(sheetOf("v-1"));
    expect(field("Weight (kg)")).toHaveValue("");
  });

  it("stands in while the visit loads, and says when it could not, with Try again", async () => {
    read.current = { mutate: vi.fn(), isValidating: false };
    const { rerender } = render(sheetOf("v-1"));
    expect(within(sheet()).getByRole("region", { name: "Loading…" })).toBeInTheDocument();
    expect(within(sheet()).queryByRole("textbox")).not.toBeInTheDocument();

    read.current = { error: new Error("down"), mutate: vi.fn(), isValidating: false };
    rerender(sheetOf("v-1"));
    expect(within(sheet()).getByText("This visit couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Try again" }));
    expect(read.current.mutate).toHaveBeenCalled();
  });

  it("reads again when someone took them meanwhile, and not for any other failure", async () => {
    client.saveWaitingVitals.mockRejectedValueOnce(new ApiError(409, "VISIT_CHANGED", "Changed."));
    client.saveWaitingVitals.mockRejectedValueOnce(new ApiError(422, "APPOINTMENT_STATUS_NOT_ALLOWED", "No."));
    render(sheetOf("v-1"));
    await userEvent.type(field("Pulse (/min)"), "80");
    await save();
    const refused = await screen.findByRole("alertdialog", { name: "That wasn’t saved" });
    expect(refresh).toHaveBeenCalledWith([...APPOINTMENT_ROUTES, "/api/visits/v-1"]);
    expect(handlers.onDone).not.toHaveBeenCalled();
    await userEvent.click(within(refused).getByRole("button", { name: "Close" }));
    refresh.mockClear();
    await save();
    await waitFor(() => expect(client.saveWaitingVitals).toHaveBeenCalledTimes(2));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps what is typed when someone takes them meanwhile, showing theirs, which Use theirs takes", async () => {
    const { rerender } = render(sheetOf("v-1"));
    await userEvent.type(field("Pulse (/min)"), "80");
    read.current = { data: { vitals: { ...TAKEN, pulse: 76 } }, mutate: vi.fn(), isValidating: false };
    rerender(sheetOf("v-1"));
    // The sheet has the card's own announcer too: the notice is the status that says so.
    const notice = within(sheet())
      .getAllByRole("status")
      .find((status) => status.textContent?.includes("Someone saved this meanwhile"))!;
    expect(within(notice).getByText("76")).toBeInTheDocument();
    expect(field("Pulse (/min)")).toHaveValue("80");
    await userEvent.click(within(notice).getByRole("button", { name: "Use theirs" }));
    expect(field("Pulse (/min)")).toHaveValue("76");
  });
});
