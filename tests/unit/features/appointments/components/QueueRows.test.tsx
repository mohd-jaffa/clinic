import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aQueueAppointment } from "@tests/support/appointments";
import { Providers } from "@tests/support/providers";

const { client } = vi.hoisted(() => ({ client: { arrive: vi.fn() } }));
vi.mock("@/features/appointments/api.client", () => ({ AppointmentsClient: client }));

const { ComingRow, DoneRow, QueueSection, tokenNumeral, WaitingRow, WithDoctorRow } =
  await import("@/features/appointments/components/QueueRows");

// Now, in Kochi: Tuesday 13 October 2026, 11:00 AM.
const now = new Date("2026-10-13T05:30:00Z");
const onOpen = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  client.arrive.mockResolvedValue({ id: "a-1", patientId: "p-1", doctorId: "d-1", token: 6 });
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
});

describe("WaitingRow (D168)", () => {
  it("says the token, the name, Walk-in or the booked time, how long they have waited, and the doctor on every doctor's", async () => {
    const walkIn = aQueueAppointment({
      status: "ARRIVED",
      source: "WALK_IN",
      token: 4,
      arrivedAt: "2026-10-13T05:05:00Z",
    });
    const { rerender } = inList(<WaitingRow appointment={walkIn} now={now} showDoctor onOpen={onOpen} />);
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
            onOpen={onOpen}
          />
        </ul>
      </Providers>,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("Rohan Mehta9:00 AM · Just now");
  });
});

describe("WithDoctorRow", () => {
  it("says who is in, with which doctor, and for how long — a doctor gone named so", async () => {
    const inside = aQueueAppointment({ status: "IN_PROGRESS", token: 3, startedAt: "2026-10-13T05:17:00Z" });
    const { rerender } = inList(<WithDoctorRow appointment={inside} now={now} onOpen={onOpen} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("Token 03Rohan MehtaWith Maya Rao · 13 min");
    await userEvent.click(screen.getByRole("button", { name: "Rohan Mehta" }));
    expect(onOpen).toHaveBeenCalledWith(inside);
    rerender(
      <Providers>
        <ul>
          <WithDoctorRow appointment={{ ...inside, doctorName: null }} now={now} onOpen={onOpen} />
        </ul>
      </Providers>,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent("With No longer on the team");
  });
});

describe("ComingRow (D172, D174)", () => {
  it("says the booked time, how late once it has passed, the kind and the doctor — and marks them arrived on the row", async () => {
    const late = aQueueAppointment({ scheduledAt: "2026-10-13T04:55:00Z", doctorName: null });
    inList(<ComingRow appointment={late} now={now} showDoctor canArrive onOpen={onOpen} />);
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
    inList(<ComingRow appointment={aQueueAppointment()} now={now} showDoctor={false} canArrive onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Mark Rohan Mehta arrived" }));
    expect(await screen.findByRole("alertdialog", { name: "That wasn’t marked arrived" })).toBeInTheDocument();
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
