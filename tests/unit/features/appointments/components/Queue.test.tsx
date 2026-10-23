import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarAppointment, QueueAppointment } from "@/features/appointments/types";
import { aQueueAppointment } from "@tests/support/appointments";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { auth, adding, query, doctors, asked, sheet, client, counted, toBill } = vi.hoisted(() => ({
  client: { arrive: vi.fn(), remind: vi.fn(), sendIn: vi.fn(), done: vi.fn(), next: vi.fn() },
  auth: { current: {} as ReturnType<typeof authStub> },
  adding: { current: { open: false, show: vi.fn(), close: vi.fn() } },
  query: {
    current: {
      data: [] as QueueAppointment[] | undefined,
      error: undefined as unknown,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    },
  },
  doctors: { current: [] as { id: string; name: string }[] | undefined },
  asked: vi.fn(),
  sheet: { doctorId: undefined as string | undefined },
  counted: vi.fn(),
  toBill: { count: 0, drawn: [] as { doctorId: string; total?: number }[] },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/appointments/api.client", () => ({ AppointmentsClient: client }));
vi.mock("@/hooks/useAddForm", () => ({ useAddForm: () => adding.current }));
vi.mock("@/features/team/hooks/useDoctors", () => ({ useDoctors: () => ({ data: doctors.current }) }));
vi.mock("@/features/appointments/hooks/useQueue", () => ({
  useQueue: (doctorId: string) => {
    asked(doctorId);
    return query.current;
  },
}));
vi.mock("@/features/appointments/components/WalkInSheet", () => ({
  WalkInSheet: ({ open, doctorId }: { open: boolean; doctorId: string }) => {
    sheet.doctorId = doctorId;
    return open ? <div role="dialog" aria-label="Add a walk-in" /> : null;
  },
}));
vi.mock("@/features/billing/hooks/useToBillCount", () => ({
  useToBillCount: (enabled: boolean, doctorId?: string) => {
    counted(enabled, doctorId);
    return { data: enabled ? { count: toBill.count } : undefined };
  },
}));
// The To bill section is tested on its own: here, where it sits, and for whom.
vi.mock("@/features/appointments/components/QueueToBill", () => ({
  QueueToBill: (props: { doctorId: string; total?: number }) => {
    toBill.drawn.push(props);
    return (
      <section id="to-bill" aria-label="To bill">
        <h2>To bill</h2>
      </section>
    );
  },
}));
vi.mock("@/features/appointments/components/AppointmentPanel", () => ({
  AppointmentPanel: ({ appointment, open }: { appointment: CalendarAppointment | null; open: boolean }) =>
    open ? <div role="dialog" aria-label={appointment!.patientName} /> : null,
}));

const { Queue } = await import("@/features/appointments/components/Queue");

const draw = () =>
  render(
    <Providers>
      <Queue />
    </Providers>,
  );

const today = [
  aQueueAppointment({
    id: "in",
    patientName: "Rohan Mehta",
    status: "IN_PROGRESS",
    token: 3,
    startedAt: "2026-10-13T05:17:00Z",
    visitId: "v-in",
  }),
  aQueueAppointment({
    id: "wait",
    patientName: "Anita Rao",
    status: "ARRIVED",
    source: "WALK_IN",
    token: 4,
    arrivedAt: "2026-10-13T05:05:00Z",
  }),
  aQueueAppointment({ id: "come", patientName: "Kiran Das", scheduledAt: "2026-10-13T06:30:00Z" }),
  aQueueAppointment({
    id: "done",
    patientName: "Farah Khan",
    status: "COMPLETED",
    token: 1,
    completedAt: "2026-10-13T04:20:00Z",
  }),
];

beforeEach(() => {
  vi.clearAllMocks();
  // Now, in Kochi: Tuesday 13 October 2026, 11:00 AM.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T05:30:00Z"));
  auth.current = authStub();
  adding.current = { open: false, show: vi.fn(), close: vi.fn() };
  doctors.current = [
    { id: "d-1", name: "Maya Rao" },
    { id: "d-2", name: "Arun Sen" },
  ];
  query.current = { data: today, error: undefined, isLoading: false, isValidating: false, mutate: vi.fn() };
  sheet.doctorId = undefined;
  toBill.count = 0;
  toBill.drawn = [];
});
afterEach(() => vi.useRealTimers());

const section = (name: RegExp) => screen.getByRole("heading", { name }).closest("section")!;

describe("Queue (plan §11.4; D168 – D175)", () => {
  it("opens on every doctor's for the desk: who is in in the lake, then Waiting, With doctor, Still to come and Done", () => {
    draw();
    expect(asked).toHaveBeenLastCalledWith("");
    expect(screen.getByRole("heading", { level: 1, name: "Queue" })).toBeInTheDocument();
    expect(screen.getByText("Tuesday, 13 Oct 2026")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All doctors" })).toBeChecked();

    const lake = screen.getByRole("region", { name: "With doctor: Rohan Mehta" });
    expect(lake).toHaveTextContent("Token 03Rohan MehtaWith Maya Rao · 13 min");
    expect(within(section(/^Waiting/)).getByRole("listitem")).toHaveTextContent("Anita Rao");
    expect(within(section(/^With doctor/)).getByRole("listitem")).toHaveTextContent("Rohan Mehta");
    expect(within(section(/^Still to come/)).getByRole("listitem")).toHaveTextContent("Kiran Das");
    expect(within(section(/^Done/)).getByRole("listitem")).toHaveTextContent("Farah Khan");
    expect(screen.getByRole("button", { name: "Done (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Kiran Das arrived" })).toBeInTheDocument();
  });

  it("for whoever reads bills: To bill after With doctor, the pin saying how many wait, Done once settled (D318, D337 – D340)", () => {
    toBill.count = 3;
    query.current.data = [
      ...today,
      aQueueAppointment({
        id: "unbilled",
        patientName: "Vikram Shah",
        status: "COMPLETED",
        token: 2,
        completedAt: "2026-10-13T05:00:00Z",
        billingStatus: "TO_BILL",
      }),
    ];
    draw();
    expect(counted).toHaveBeenLastCalledWith(true, undefined);
    expect(toBill.drawn.at(-1)).toEqual({ doctorId: "", total: 3 });
    const titles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(titles.indexOf("To bill")).toBe(titles.findIndex((title) => title?.startsWith("With doctor")) + 1);
    expect(titles.findIndex((title) => title?.startsWith("Still to come"))).toBe(titles.indexOf("To bill") + 1);
    expect(screen.getByRole("link", { name: "3 to bill" })).toHaveAttribute("href", "#to-bill");
    // Done once billed: Vikram waits in To bill.
    expect(within(section(/^Done/)).getAllByRole("listitem")).toHaveLength(1);
    expect(section(/^Done/)).not.toHaveTextContent("Vikram Shah");
  });

  it("counts and lists one doctor's To bill on their queue, and has no pin with none waiting", async () => {
    draw();
    expect(screen.queryByRole("link", { name: /to bill$/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Maya Rao" }));
    expect(counted).toHaveBeenLastCalledWith(true, "d-1");
    expect(toBill.drawn.at(-1)).toEqual({ doctorId: "d-1", total: 0 });
  });

  it("has no To bill, pin or count for whoever does not read bills, and lists every patient done (D339)", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "appointments.view"] });
    toBill.count = 3;
    query.current.data = [
      ...today,
      aQueueAppointment({ id: "unbilled", status: "COMPLETED", billingStatus: "TO_BILL" }),
    ];
    draw();
    expect(counted).toHaveBeenLastCalledWith(false, undefined);
    expect(toBill.drawn).toEqual([]);
    expect(screen.queryByRole("heading", { name: "To bill" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /to bill$/ })).not.toBeInTheDocument();
    expect(within(section(/^Done/)).getAllByRole("listitem")).toHaveLength(2);
  });

  it("says the room is free when no one is in, each section when it holds no one, and no Done to open", () => {
    query.current.data = [];
    draw();
    expect(screen.getByRole("region", { name: "With doctor" })).toHaveTextContent("The room is free");
    expect(screen.getByText("No one is waiting")).toBeInTheDocument();
    expect(screen.getByText("No one is with the doctor")).toBeInTheDocument();
    expect(screen.getByText("No one else is booked today")).toBeInTheDocument();
    expect(screen.getByText("No one is done yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Done/ })).not.toBeInTheDocument();
  });

  it("opens a doctor on their own, switches doctors, and has no switcher with one doctor (D170)", async () => {
    auth.current = authStub({ role: "DOCTOR" });
    doctors.current = [
      { id: "d-1", name: "Maya Rao" },
      { id: "doctor-1", name: "Arun Sen" },
    ];
    const { unmount } = draw();
    expect(asked).toHaveBeenLastCalledWith("doctor-1");
    expect(screen.getByRole("radio", { name: "Arun Sen" })).toBeChecked();
    expect(sheet.doctorId).toBe("doctor-1");
    await userEvent.click(screen.getByRole("radio", { name: "Maya Rao" }));
    expect(asked).toHaveBeenLastCalledWith("d-1");
    unmount();

    doctors.current = [{ id: "d-1", name: "Maya Rao" }];
    draw();
    expect(screen.queryByRole("radiogroup", { name: "Whose queue" })).not.toBeInTheDocument();
  });

  it("opens a patient tapped in any section", async () => {
    draw();
    await userEvent.click(within(section(/^Waiting/)).getByRole("button", { name: "Anita Rao" }));
    expect(screen.getByRole("dialog", { name: "Anita Rao" })).toBeInTheDocument();
  });

  it("adds a walk-in from its button, on the doctor showing (D171, D175)", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Add walk-in" }));
    expect(adding.current.show).toHaveBeenCalled();
    expect(sheet.doctorId).toBe("");
  });

  it("adds and arrives nothing for a member who may not, nor in a view-only clinic, saying why", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "appointments.view"] });
    const { unmount } = draw();
    expect(screen.queryByRole("button", { name: "Add walk-in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /arrived/ })).not.toBeInTheDocument();
    unmount();

    const viewOnly = authStub();
    auth.current = { ...viewOnly, subscription: { ...viewOnly.subscription!, state: "READ_ONLY" } };
    draw();
    expect(screen.queryByRole("button", { name: "Add walk-in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /arrived/ })).not.toBeInTheDocument();
    expect(screen.getByText(/view-only/)).toBeInTheDocument();
  });

  it("waits for the doctors without failing, and for someone with no membership opens on every doctor", () => {
    doctors.current = undefined;
    auth.current = { ...authStub(), membership: null };
    draw();
    expect(asked).toHaveBeenLastCalledWith("");
  });

  it("stands in while it loads, and says when it could not, with Try again", async () => {
    query.current = { data: undefined, error: undefined, isLoading: true, isValidating: false, mutate: vi.fn() };
    const { rerender } = draw();
    expect(screen.getByRole("region", { name: "Loading…" })).toBeInTheDocument();
    query.current = {
      data: undefined,
      error: new Error("down"),
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    };
    rerender(
      <Providers>
        <Queue />
      </Providers>,
    );
    expect(screen.getByText("The queue couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(query.current.mutate).toHaveBeenCalled();
  });

  it("names a doctor gone from the team in the lake", () => {
    query.current.data = [aQueueAppointment({ status: "IN_PROGRESS", token: 3, doctorName: null })];
    draw();
    const lake = screen.getByRole("region", { name: "With doctor: Rohan Mehta" });
    expect(lake).toHaveTextContent("With No longer on the team");
    expect(lake).not.toHaveTextContent("Urgent");
  });

  it("tags one marked urgent in the lake (D201)", () => {
    query.current.data = [aQueueAppointment({ status: "IN_PROGRESS", token: 3, urgentAt: "2026-10-13T05:00:00Z" })];
    draw();
    expect(screen.getByRole("region", { name: "With doctor: Rohan Mehta" })).toHaveTextContent(
      "With Maya Rao · Just nowUrgent",
    );
  });

  it("moves the queue from the lake and the rows: Done, Next patient and Open visit beside who is in, Send in on who waits (D193, D195)", async () => {
    client.next.mockResolvedValue({ sent: null });
    draw();
    const lake = screen.getByRole("region", { name: "With doctor: Rohan Mehta" });
    expect(within(lake).getByRole("button", { name: "Mark Rohan Mehta done" })).toBeInTheDocument();
    expect(within(lake).getByRole("link", { name: "Open Rohan Mehta's visit" })).toHaveAttribute(
      "href",
      "/visits/v-in",
    );
    await userEvent.click(within(lake).getByRole("button", { name: "Next patient after Rohan Mehta" }));
    expect(client.next).toHaveBeenCalledWith({ doctorId: "d-1", appointmentId: "in" });
    expect(within(section(/^With doctor/)).getByRole("link", { name: "Rohan Mehta" })).toHaveAttribute(
      "href",
      "/visits/v-in",
    );
    expect(within(section(/^Waiting/)).getByRole("button", { name: "Send Anita Rao in" })).toBeInTheDocument();
  });

  it("opens the detail of the patient in from their name in the lake (D172)", async () => {
    draw();
    await userEvent.click(
      within(screen.getByRole("region", { name: "With doctor: Rohan Mehta" })).getByRole("button", {
        name: /^Rohan Mehta$/,
      }),
    );
    expect(screen.getByRole("dialog", { name: "Rohan Mehta" })).toBeInTheDocument();
  });

  it("asks before sending someone in to a doctor who has someone in (D192)", async () => {
    draw();
    await userEvent.click(within(section(/^Waiting/)).getByRole("button", { name: "Send Anita Rao in" }));
    expect(await screen.findByRole("alertdialog", { name: "Rohan Mehta is still with Maya Rao" })).toBeInTheDocument();
    expect(client.sendIn).not.toHaveBeenCalled();
  });

  it("offers Next patient with the room free on one doctor's queue while someone waits — not on every doctor's (D196)", async () => {
    query.current.data = today.filter((appointment) => appointment.status !== "IN_PROGRESS");
    const { unmount } = draw();
    expect(screen.queryByRole("button", { name: /next patient/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Maya Rao" }));
    expect(
      within(screen.getByRole("region", { name: "With doctor" })).getByRole("button", {
        name: "Send in Maya Rao's next patient",
      }),
    ).toBeInTheDocument();
    expect(
      within(section(/^With doctor/)).getByRole("button", { name: "Send in Maya Rao's next patient" }),
    ).toBeInTheDocument();
    unmount();

    query.current.data = [];
    draw();
    await userEvent.click(screen.getByRole("radio", { name: "Maya Rao" }));
    expect(screen.queryByRole("button", { name: /next patient/ })).not.toBeInTheDocument();
  });

  it("moves nothing for a member who may not, nor in a view-only clinic — though a visit is still opened", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "appointments.view", "visits.view"] });
    const { unmount } = draw();
    expect(screen.queryByRole("button", { name: /Send .* in|done|Next patient/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Rohan Mehta's visit" })).toBeInTheDocument();
    unmount();

    const viewOnly = authStub();
    auth.current = { ...viewOnly, subscription: { ...viewOnly.subscription!, state: "READ_ONLY" } };
    draw();
    expect(screen.queryByRole("button", { name: /Send .* in|done|Next patient/ })).not.toBeInTheDocument();
  });
});
