import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aQueueAppointment } from "@tests/support/appointments";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({
  client: { arrive: vi.fn(), remind: vi.fn(), sendIn: vi.fn(), done: vi.fn(), next: vi.fn() },
}));
vi.mock("@/features/appointments/api.client", () => ({ AppointmentsClient: client }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => authStub() }));

const { ComingRow, DoneRow, InRoomButtons, NextPatientButton, QueueSection, tokenNumeral, WaitingRow, WithDoctorRow } =
  await import("@/features/appointments/components/QueueRows");

// Now, in Kochi: Tuesday 13 October 2026, 11:00 AM.
const now = new Date("2026-10-13T05:30:00Z");
const onOpen = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  client.arrive.mockResolvedValue({ id: "a-1", patientId: "p-1", doctorId: "d-1", token: 6 });
  client.sendIn.mockResolvedValue({ visitId: "v-1" });
  client.done.mockResolvedValue({ appointmentId: "a-1" });
  client.next.mockResolvedValue({ sent: null });
});

const inList = (row: ReactNode) =>
  render(
    <Providers>
      <ul>{row}</ul>
    </Providers>,
  );

describe("tokenNumeral", () => {
  it("writes a token in two figures, and none as nothing", () => {
    expect(tokenNumeral(7)).toBe("07");
    expect(tokenNumeral(12)).toBe("12");
    expect(tokenNumeral(null)).toBe("");
  });
});

describe("QueueSection (D168)", () => {
  it("names its count, lists its rows, and says so quietly when it holds none", () => {
    const { rerender } = render(
      <QueueSection title="Waiting" count={1} empty="No one is waiting">
        <li>Rohan Mehta</li>
      </QueueSection>,
    );
    expect(screen.getByRole("heading", { name: "Waiting 1" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Waiting" })).toHaveTextContent("Rohan Mehta");
    rerender(
      <QueueSection title="Waiting" count={0} empty="No one is waiting">
        {null}
      </QueueSection>,
    );
    expect(screen.getByText("No one is waiting")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("offers what may be done about an empty section beside its line (D196)", () => {
    render(
      <QueueSection
        title="With doctor"
        count={0}
        empty="No one is with the doctor"
        action={<button>Next patient</button>}
      >
        {null}
      </QueueSection>,
    );
    expect(screen.getByRole("button", { name: "Next patient" })).toBeInTheDocument();
  });
});

describe("WaitingRow (D168)", () => {
  it("says the token, the name, Walk-in or the booked time, how long they have waited, and the doctor on every doctor's", async () => {
    const walkIn = aQueueAppointment({
      status: "ARRIVED",
      source: "WALK_IN",
      token: 4,
      arrivedAt: "2026-10-13T05:05:00Z",
    });
    const { rerender } = inList(
      <WaitingRow appointment={walkIn} now={now} showDoctor inRoom={[]} canMove={false} onOpen={onOpen} />,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("Token 04Rohan MehtaWalk-in · 25 min · Maya Rao");
    await userEvent.click(screen.getByRole("button", { name: "Rohan Mehta" }));
    expect(onOpen).toHaveBeenCalledWith(walkIn);

    rerender(
      <Providers>
        <ul>
          <WaitingRow
            appointment={aQueueAppointment({
              status: "ARRIVED",
              token: 5,
              arrivedAt: "2026-10-13T05:30:00Z",
              doctorName: null,
            })}
            now={now}
            showDoctor={false}
            inRoom={[]}
            canMove={false}
            onOpen={onOpen}
          />
        </ul>
      </Providers>,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("Rohan Mehta9:00 AM · Just now");
    expect(screen.queryByRole("button", { name: "Send Rohan Mehta in" })).not.toBeInTheDocument();
  });

  it("says a patient stepped out, quieter, first on their line (D198)", () => {
    const away = aQueueAppointment({
      status: "ARRIVED",
      token: 6,
      arrivedAt: "2026-10-13T05:05:00Z",
      steppedOutAt: "2026-10-13T05:20:00Z",
    });
    inList(<WaitingRow appointment={away} now={now} showDoctor={false} inRoom={[]} canMove={false} onOpen={onOpen} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("Rohan MehtaStepped out · 9:00 AM · 25 min");
  });

  it("leads the line of one marked urgent with the tag, keeping the rest (D201)", () => {
    const urgent = aQueueAppointment({
      status: "ARRIVED",
      token: 6,
      arrivedAt: "2026-10-13T05:05:00Z",
      steppedOutAt: "2026-10-13T05:20:00Z",
      urgentAt: "2026-10-13T05:10:00Z",
    });
    inList(
      <WaitingRow appointment={urgent} now={now} showDoctor={false} inRoom={[]} canMove={false} onOpen={onOpen} />,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("Rohan MehtaUrgent Stepped out · 9:00 AM · 25 min");
    expect(screen.getByText("Urgent")).toHaveClass("text-coral");
  });

  it("sends them in from the row, for whoever may (D172, D192)", async () => {
    const waiting = aQueueAppointment({ status: "ARRIVED", token: 4, arrivedAt: "2026-10-13T05:05:00Z" });
    inList(<WaitingRow appointment={waiting} now={now} showDoctor={false} inRoom={[]} canMove onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Send Rohan Mehta in" }));
    expect(client.sendIn).toHaveBeenCalledWith({ appointmentId: "a-1" });
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("WithDoctorRow", () => {
  it("says who is in, with which doctor, and for how long — a doctor gone named so", async () => {
    const inside = aQueueAppointment({ status: "IN_PROGRESS", token: 3, startedAt: "2026-10-13T05:17:00Z" });
    const { rerender } = inList(<WithDoctorRow appointment={inside} now={now} canMove={false} onOpen={onOpen} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("Token 03Rohan MehtaWith Maya Rao · 13 min");
    await userEvent.click(screen.getByRole("button", { name: "Rohan Mehta" }));
    expect(onOpen).toHaveBeenCalledWith(inside);
    rerender(
      <Providers>
        <ul>
          <WithDoctorRow appointment={{ ...inside, doctorName: null }} now={now} canMove={false} onOpen={onOpen} />
        </ul>
      </Providers>,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("With No longer on the team");
  });

  it("keeps the Urgent tag on one marked so while they are in (D201)", () => {
    const urgent = aQueueAppointment({
      status: "IN_PROGRESS",
      token: 3,
      startedAt: "2026-10-13T05:17:00Z",
      urgentAt: "2026-10-13T05:00:00Z",
    });
    inList(<WithDoctorRow appointment={urgent} now={now} canMove={false} onOpen={onOpen} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("Token 03Rohan MehtaUrgent With Maya Rao · 13 min");
  });

  it("opens the visit for whoever reads visits, and offers Done and Next patient on the row (D193, D195)", async () => {
    const inside = aQueueAppointment({ status: "IN_PROGRESS", token: 3, visitId: "v-3" });
    inList(<WithDoctorRow appointment={inside} now={now} canMove onOpen={onOpen} />);
    expect(screen.getByRole("link", { name: "Rohan Mehta" })).toHaveAttribute("href", "/visits/v-3");
    await userEvent.click(screen.getByRole("button", { name: "Mark Rohan Mehta done" }));
    expect(client.done).toHaveBeenCalledWith("a-1");
    await userEvent.click(screen.getByRole("button", { name: "Next patient after Rohan Mehta" }));
    expect(client.next).toHaveBeenCalledWith({ doctorId: "d-1", appointmentId: "a-1" });
  });
});

describe("InRoomButtons and NextPatientButton (D193, D196)", () => {
  it("mark the patient in done or move on, and send in the lowest token with the room free", async () => {
    render(
      <Providers>
        <InRoomButtons appointment={aQueueAppointment({ status: "IN_PROGRESS" })} />
        <NextPatientButton doctorId="d-1" doctorName={null} />
      </Providers>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Send in No longer on the team's next patient" }));
    expect(client.next).toHaveBeenCalledWith({ doctorId: "d-1", appointmentId: undefined });
  });
});

describe("ComingRow (D172, D174)", () => {
  it("says the booked time, how late once it has passed, the kind and the doctor — and marks them arrived on the row", async () => {
    const late = aQueueAppointment({ scheduledAt: "2026-10-13T04:55:00Z", doctorName: null });
    inList(<ComingRow appointment={late} now={now} showDoctor canRemind={false} canArrive onOpen={onOpen} />);
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("Rohan Mehta10:25 AM · Late 35 min · Consultation · No longer on the team");
    expect(within(row).getByText("Late 35 min")).toHaveClass("text-coral");

    await userEvent.click(within(row).getByRole("button", { name: "Mark Rohan Mehta arrived" }));
    expect(client.arrive).toHaveBeenCalledWith("a-1");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Rohan Mehta is #6 with No longer on the team"),
    );
    await userEvent.click(within(row).getByRole("button", { name: "Rohan Mehta" }));
    expect(onOpen).toHaveBeenCalledWith(late);
  });

  it("says nothing of lateness before the time, and offers no Arrived to someone who may not", () => {
    inList(
      <ComingRow
        appointment={aQueueAppointment({ scheduledAt: "2026-10-13T06:30:00Z" })}
        now={now}
        showDoctor={false}
        canRemind={false}
        canArrive={false}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("Rohan Mehta12:00 PM · Consultation");
    expect(screen.queryByRole("button", { name: /arrived/ })).not.toBeInTheDocument();
  });

  it("says why an arrival was refused", async () => {
    const { ApiError } = await import("@/lib/api/client");
    client.arrive.mockRejectedValue(new ApiError(409, "APPOINTMENT_SLOT_TAKEN", "Taken.", "req_1"));
    inList(
      <ComingRow
        appointment={aQueueAppointment()}
        now={now}
        showDoctor={false}
        canRemind={false}
        canArrive
        onOpen={onOpen}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Mark Rohan Mehta arrived" }));
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t marked arrived" })).toBeInTheDocument();
  });
});

describe("ComingRow's reminder (D179)", () => {
  it("offers a WhatsApp reminder beside Arrived, and says when they have been reminded", () => {
    inList(
      <ComingRow
        appointment={aQueueAppointment({ scheduledAt: "2026-10-13T06:30:00Z", remindedAt: "2026-10-12T05:00:00Z" })}
        now={now}
        showDoctor={false}
        canRemind
        canArrive={false}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("12:00 PM · Consultation · Reminded");
    expect(screen.getByRole("link", { name: "Remind Rohan Mehta on WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /arrived/ })).not.toBeInTheDocument();
  });
});

describe("DoneRow", () => {
  it("says the token, the name, when they were done and the doctor on every doctor's", async () => {
    const done = aQueueAppointment({ status: "COMPLETED", token: 1, completedAt: "2026-10-13T04:20:00Z" });
    const { rerender } = inList(<DoneRow appointment={done} showDoctor onOpen={onOpen} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("Token 01Rohan MehtaDone 9:50 AM · Maya Rao");
    await userEvent.click(screen.getByRole("button", { name: "Rohan Mehta" }));
    expect(onOpen).toHaveBeenCalledWith(done);
    rerender(
      <Providers>
        <ul>
          <DoneRow appointment={done} showDoctor={false} onOpen={onOpen} />
        </ul>
      </Providers>,
    );
    expect(screen.getByRole("listitem")).not.toHaveTextContent("Maya Rao");
  });
});
