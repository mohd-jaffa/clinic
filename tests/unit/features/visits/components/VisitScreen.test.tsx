import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import type { VisitHeader } from "@/features/visits/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { client, auth, read } = vi.hoisted(() => ({
  client: { done: vi.fn(), next: vi.fn() },
  auth: { current: {} as ReturnType<typeof authStub> },
  read: {
    current: {} as { data?: VisitHeader; error?: unknown; mutate: () => void; isValidating: boolean },
  },
}));
vi.mock("@/features/appointments/api.client", () => ({ AppointmentsClient: client }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/visits/hooks/useVisit", () => ({ useVisit: () => read.current }));

const { VisitScreen } = await import("@/features/visits/components/VisitScreen");

const DESK: Permission[] = ["patients.view", "appointments.view", "appointments.edit", "visits.view"];

/** A visit in progress: Asha Iyer with Maya Rao, token 7, in since 10:30 AM in Kochi. */
const aVisit = (overrides: Partial<VisitHeader> = {}): VisitHeader => ({
  id: "v-1",
  status: "OPEN",
  billingStatus: null,
  day: "2026-10-13",
  startedAt: "2026-10-13T05:00:00Z",
  completedAt: null,
  patient: { id: "p-1", name: "Asha Iyer", number: 1012, dateOfBirth: "1990-04-12", gender: "FEMALE", archived: false },
  doctorId: "d-1",
  doctorName: "Maya Rao",
  appointment: { id: "a-1", status: "IN_PROGRESS", token: 7, urgentAt: null },
  alerts: [{ id: "al-1", kind: "ALLERGY", label: "Penicillin", note: null, active: true }],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Now, in Kochi: Tuesday 13 October 2026, 10:42 AM.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T05:12:00Z"));
  auth.current = authStub({ role: "STAFF", permissions: DESK });
  read.current = { data: aVisit(), mutate: vi.fn(), isValidating: false };
  client.done.mockResolvedValue({ appointmentId: "a-1" });
  client.next.mockResolvedValue({ sent: null });
});
afterEach(() => vi.useRealTimers());

const draw = () =>
  render(
    <Providers>
      <VisitScreen id="v-1" />
    </Providers>,
  );
const lake = () => screen.getByRole("region", { name: "With doctor: Asha Iyer" });

describe("VisitScreen (plan §12.2; D193 – D195)", () => {
  it("says whose visit it is, with whom, where it stands and the patient's alerts, the way back to the queue", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Asha Iyer" })).toBeInTheDocument();
    expect(screen.getByText(/· Female · P-1012$/)).toBeInTheDocument();
    expect(screen.getByText("With Maya Rao")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Alerts" })).getByRole("listitem")).toHaveTextContent(
      "Allergy: Penicillin",
    );
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/queue");
    const facts = screen.getAllByRole("definition").map((value) => value.textContent);
    expect(facts).toEqual(["Tuesday, 13 Oct 2026", "07", "10:30 AM"]);
  });

  it("holds the patient in the lake with their token and time in, Done and Next patient beside them", async () => {
    draw();
    expect(lake()).toHaveTextContent("Token 07In since 10:30 AM12 min");
    await userEvent.click(within(lake()).getByRole("button", { name: "Mark Asha Iyer done" }));
    expect(client.done).toHaveBeenCalledWith("a-1");
    await userEvent.click(within(lake()).getByRole("button", { name: "Next patient after Asha Iyer" }));
    expect(client.next).toHaveBeenCalledWith({ doctorId: "d-1", appointmentId: "a-1" });
  });

  it("has no lake once done, and says when, and that it waits to be billed", () => {
    read.current.data = aVisit({
      status: "COMPLETED",
      completedAt: "2026-10-13T05:20:00Z",
      billingStatus: "TO_BILL",
      appointment: { id: "a-1", status: "COMPLETED", token: null, urgentAt: "2026-10-13T04:50:00Z" },
      doctorName: null,
      alerts: [],
    });
    draw();
    expect(screen.queryByRole("region", { name: /With doctor/ })).not.toBeInTheDocument();
    expect(screen.getByText("Done", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("With No longer on the team")).toBeInTheDocument();
    expect(screen.getByText("No alerts")).toBeInTheDocument();
    // Urgent stays on the visit once done (D201).
    expect(screen.getByText("Urgent", { selector: "span" })).toBeInTheDocument();
    const facts = screen.getAllByRole("definition").map((value) => value.textContent);
    expect(facts).toEqual(["Tuesday, 13 Oct 2026", "10:30 AM", "10:50 AM", "To bill"]);
  });

  it("offers no moves to someone who may only read, nor in a view-only clinic, saying why there", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "visits.view"] });
    const { unmount } = draw();
    expect(within(lake()).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/view-only/)).not.toBeInTheDocument();
    unmount();

    const viewOnly = authStub({ role: "STAFF", permissions: DESK });
    auth.current = { ...viewOnly, subscription: { ...viewOnly.subscription!, state: "READ_ONLY" } };
    draw();
    expect(within(lake()).queryByRole("button")).not.toBeInTheDocument();
    expect(within(lake()).getByText(/view-only/)).toBeInTheDocument();
  });

  it("has no lake for a visit with no appointment in, and no token without one", () => {
    read.current.data = aVisit({ appointment: { id: "a-1", status: "IN_PROGRESS", token: null, urgentAt: null } });
    const { unmount } = draw();
    expect(lake()).not.toHaveTextContent("Token");
    expect(screen.queryByText("Urgent", { selector: "span" })).not.toBeInTheDocument();
    unmount();
    read.current.data = aVisit({ appointment: null });
    draw();
    expect(screen.queryByRole("region", { name: /With doctor/ })).not.toBeInTheDocument();
  });

  it("stands in while it loads, and says when it could not, with Try again", async () => {
    read.current = { mutate: vi.fn(), isValidating: false };
    const { rerender } = draw();
    expect(screen.getByRole("heading", { level: 1, name: "Visit" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Loading…" })).toBeInTheDocument();
    read.current = { error: new Error("down"), mutate: vi.fn(), isValidating: false };
    rerender(
      <Providers>
        <VisitScreen id="v-1" />
      </Providers>,
    );
    expect(screen.getByText("This visit couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(read.current.mutate).toHaveBeenCalled();
  });
});
