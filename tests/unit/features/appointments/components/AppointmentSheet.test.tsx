import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import type { AppointmentDetail } from "@/features/appointments/types";
import { ApiError } from "@/lib/api/client";
import { aCalendarAppointment, anAppointmentDetail } from "@tests/support/appointments";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { client, auth, read } = vi.hoisted(() => ({
  client: { setStatus: vi.fn(), arrive: vi.fn() },
  auth: { current: {} as ReturnType<typeof authStub> },
  read: {
    current: {} as { data?: AppointmentDetail; error?: unknown; mutate: () => void; isValidating: boolean },
  },
}));
vi.mock("@/features/appointments/api.client", () => ({ AppointmentsClient: client }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/appointments/hooks/useAppointment", () => ({ useAppointment: () => read.current }));

const { AppointmentSheet } = await import("@/features/appointments/components/AppointmentSheet");

const ALL: Permission[] = ["patients.view", "appointments.view", "appointments.edit", "appointments.cancel"];
const handlers = { onClose: vi.fn(), onReschedule: vi.fn(), onEditNotes: vi.fn(), onCancel: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  // Now, in Kochi: Tuesday 13 October 2026, 10:07 AM; the appointment was at 9:00.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T04:37:00Z"));
  auth.current = authStub({ role: "STAFF", permissions: ALL });
  read.current = { data: anAppointmentDetail({ notes: "Bring the X-ray" }), mutate: vi.fn(), isValidating: false };
  client.setStatus.mockImplementation(async ({ status }: { status: string }) => ({ id: "a-1", status }));
  client.arrive.mockResolvedValue({ id: "a-1", patientId: "p-1", doctorId: "d-1", token: 7 });
});
afterEach(() => vi.useRealTimers());

const draw = (appointment = aCalendarAppointment(), linkProfile = true) =>
  render(
    <Providers>
      <AppointmentSheet appointment={appointment} open linkProfile={linkProfile} {...handlers} />
    </Providers>,
  );
const sheet = () => screen.getByRole("dialog", { name: "Rohan Mehta" });
const actions = () => within(sheet()).queryByRole("group", { name: "What to do" });

describe("AppointmentSheet (plan §11.2; D160 – D165)", () => {
  it("says who, when, with whom, what kind and where it stands, its notes and who booked it", () => {
    draw();
    expect(within(sheet()).getByText("Scheduled")).toBeInTheDocument();
    expect(within(sheet()).getByText("P-1012 · Consultation")).toBeInTheDocument();
    const facts = within(sheet())
      .getAllByRole("definition")
      .map((value) => value.textContent);
    expect(facts).toEqual([
      "Tuesday, 13 Oct 2026 · 9:00 AM – 9:15 AM",
      "Maya Rao",
      "Consultation",
      "Bring the X-ray",
      "Priya Nair, 10 Oct",
    ]);
    expect(within(sheet()).getByRole("link", { name: "Open Rohan Mehta’s profile" })).toHaveAttribute(
      "href",
      "/patients/p-1",
    );
  });

  it("opens on what the calendar holds while the rest arrives, and says when it cannot", async () => {
    read.current = { mutate: vi.fn(), isValidating: false };
    const { rerender } = draw(aCalendarAppointment({ doctorName: null }), false);
    expect(within(sheet()).getByText("No longer on the team")).toBeInTheDocument();
    expect(within(sheet()).getByRole("region", { name: "Loading…" })).toBeInTheDocument();
    expect(actions()).not.toBeInTheDocument();
    expect(within(sheet()).queryByRole("link")).not.toBeInTheDocument();

    read.current = { error: new Error("down"), mutate: vi.fn(), isValidating: false };
    rerender(
      <Providers>
        <AppointmentSheet appointment={aCalendarAppointment()} open linkProfile={false} {...handlers} />
      </Providers>,
    );
    expect(within(sheet()).getByText("This appointment couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Try again" }));
    expect(read.current.mutate).toHaveBeenCalled();
  });

  it("confirms at a tap, closing with a card (D165)", async () => {
    vi.setSystemTime(new Date("2026-10-13T02:00:00Z"));
    draw();
    await userEvent.click(within(actions()!).getByRole("button", { name: "Confirm" }));
    expect(client.setStatus).toHaveBeenCalledWith({ id: "a-1", status: "CONFIRMED" });
    await waitFor(() => expect(handlers.onClose).toHaveBeenCalled());
    // The sheet stays open here, so the card is drawn over it as well as on the page.
    expect(screen.getAllByText("Confirmed Rohan Mehta · 13 Oct, 9:00 AM").length).toBeGreaterThan(0);
  });

  it("asks before a no-show, once its time has come (D163)", async () => {
    draw();
    await userEvent.click(within(actions()!).getByRole("button", { name: "No-show" }));
    const ask = screen.getByRole("alertdialog", { name: "Mark Rohan Mehta a no-show?" });
    await userEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    expect(client.setStatus).not.toHaveBeenCalled();

    await userEvent.click(within(actions()!).getByRole("button", { name: "No-show" }));
    await userEvent.click(
      within(screen.getByRole("alertdialog", { name: "Mark Rohan Mehta a no-show?" })).getByRole("button", {
        name: "No-show",
      }),
    );
    expect(client.setStatus).toHaveBeenCalledWith({ id: "a-1", status: "NO_SHOW" });
    expect((await screen.findAllByText("Rohan Mehta marked a no-show · 13 Oct, 9:00 AM")).length).toBeGreaterThan(0);
  });

  it("says why a status was refused, and stays open", async () => {
    client.setStatus.mockRejectedValue(
      new ApiError(422, "APPOINTMENT_STATUS_NOT_ALLOWED", "Refresh and try again.", "req_1"),
    );
    vi.setSystemTime(new Date("2026-10-13T02:00:00Z"));
    draw();
    await userEvent.click(within(actions()!).getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("That wasn’t changed")).toBeInTheDocument();
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it("hands Reschedule its detail, and Cancel to the screen", async () => {
    draw();
    await userEvent.click(within(actions()!).getByRole("button", { name: "Reschedule" }));
    expect(handlers.onReschedule).toHaveBeenCalledWith(read.current.data);
    await userEvent.click(within(actions()!).getByRole("button", { name: "Cancel appointment" }));
    expect(handlers.onCancel).toHaveBeenCalled();
  });

  it("offers a walk-in its notes, says its token and that it was added at the desk", async () => {
    const walkIn = { source: "WALK_IN" as const, status: "ARRIVED" as const, token: 3 };
    read.current = { data: anAppointmentDetail(walkIn), mutate: vi.fn(), isValidating: false };
    draw(aCalendarAppointment(walkIn));
    expect(within(sheet()).getByText("#3")).toBeInTheDocument();
    expect(within(sheet()).getByText("Added at the desk")).toBeInTheDocument();
    expect(within(actions()!).queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
    await userEvent.click(within(actions()!).getByRole("button", { name: "Edit notes" }));
    expect(handlers.onEditNotes).toHaveBeenCalledWith(read.current.data);
  });

  it("says who cancelled one, when and why — the account gone, the day alone", () => {
    const cancelled = {
      status: "CANCELLED" as const,
      cancelledAt: "2026-10-12T06:00:00Z",
      cancelledBy: null,
      cancelReason: "Patient asked",
      bookedBy: null,
    };
    read.current = { data: anAppointmentDetail(cancelled), mutate: vi.fn(), isValidating: false };
    draw(aCalendarAppointment({ status: "CANCELLED" }));
    const facts = within(sheet())
      .getAllByRole("definition")
      .map((value) => value.textContent);
    expect(facts.slice(-3)).toEqual(["10 Oct", "12 Oct", "Patient asked"]);
  });

  it("offers nothing for an archived patient, saying why", () => {
    read.current = { data: anAppointmentDetail({ patientArchived: true }), mutate: vi.fn(), isValidating: false };
    draw();
    expect(actions()).not.toBeInTheDocument();
    expect(within(sheet()).getByText(/This patient is archived/)).toBeInTheDocument();
  });

  it("offers nothing in a view-only clinic, saying why — and nothing to someone who may only see", () => {
    const viewOnly = authStub({ role: "STAFF", permissions: ALL });
    auth.current = { ...viewOnly, subscription: { ...viewOnly.subscription!, state: "READ_ONLY" } };
    const { unmount } = draw();
    expect(actions()).not.toBeInTheDocument();
    expect(within(sheet()).getByText(/view-only/)).toBeInTheDocument();
    unmount();

    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "appointments.view"] });
    draw();
    expect(actions()).not.toBeInTheDocument();
    expect(within(sheet()).queryByText(/view-only/)).not.toBeInTheDocument();
  });

  it("marks a patient arrived on the day, Arrived leading, and gives their token on the card (D164, D173)", async () => {
    draw();
    const group = actions()!;
    expect(within(group).getAllByRole("button")[0]).toHaveAccessibleName("Arrived");
    await userEvent.click(within(group).getByRole("button", { name: "Arrived" }));
    expect(client.arrive).toHaveBeenCalledWith("a-1");
    await waitFor(() => expect(handlers.onClose).toHaveBeenCalled());
    expect((await screen.findAllByText("Rohan Mehta is #7 with Maya Rao")).length).toBeGreaterThan(0);
  });

  it("says why an arrival was refused, and names a doctor gone from the team on the card", async () => {
    client.arrive.mockRejectedValueOnce(new ApiError(422, "APPOINTMENT_NOT_TODAY", "Only today's.", "req_1"));
    const { unmount } = draw();
    await userEvent.click(within(actions()!).getByRole("button", { name: "Arrived" }));
    expect(await screen.findByText("That wasn’t marked arrived")).toBeInTheDocument();
    unmount();

    read.current = { data: anAppointmentDetail({ doctorName: null }), mutate: vi.fn(), isValidating: false };
    draw(aCalendarAppointment({ doctorName: null }));
    await userEvent.click(within(actions()!).getByRole("button", { name: "Arrived" }));
    expect((await screen.findAllByText("Rohan Mehta is #7 with No longer on the team")).length).toBeGreaterThan(0);
  });

  it("leads with Confirm on a day to come, when there is no arriving yet", () => {
    const later = { day: "2026-10-14", scheduledAt: "2026-10-14T03:30:00Z" };
    read.current = { data: anAppointmentDetail(later), mutate: vi.fn(), isValidating: false };
    draw(aCalendarAppointment(later));
    const buttons = within(actions()!).getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName("Confirm");
    expect(within(actions()!).queryByRole("button", { name: "Arrived" })).not.toBeInTheDocument();
  });
});
