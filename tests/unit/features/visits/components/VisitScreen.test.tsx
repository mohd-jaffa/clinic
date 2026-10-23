import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Permission } from "@/constants/permissions";
import type { Visit } from "@/features/visits/types";
import { authStub } from "@tests/support/auth";
import { Providers } from "@tests/support/providers";

const { client, visits, auth, read, alerts, search } = vi.hoisted(() => ({
  search: { current: "" },
  client: { done: vi.fn(), next: vi.fn() },
  visits: { done: vi.fn(), saveVitals: vi.fn(), change: vi.fn() },
  auth: { current: {} as ReturnType<typeof authStub> },
  read: {
    current: {} as { data?: Visit; error?: unknown; mutate: () => void; isValidating: boolean },
  },
  alerts: [] as { patientId: string; archived: boolean; visitRoute: string }[],
}));
vi.mock("@/features/appointments/api.client", () => ({ AppointmentsClient: client }));
vi.mock("@/features/visits/api.client", () => ({ VisitsClient: visits }));
// The alerts sheet is the profile's, tested there: here, only that it is offered, and for whom.
vi.mock("@/features/patients/components/PatientAlerts", () => ({
  VisitAlerts: (props: { patientId: string; archived: boolean; visitRoute: string }) => {
    alerts.push(props);
    return <button type="button">Alerts</button>;
  },
}));
// The booking sheet is the calendar's, tested there.
vi.mock("@/features/appointments/components/BookingSheet", () => ({ BookingSheet: () => null }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/visits/hooks/useVisit", () => ({ useVisit: () => read.current }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/visits/v-1",
  useSearchParams: () => new URLSearchParams(search.current),
}));

const { VisitScreen } = await import("@/features/visits/components/VisitScreen");

const DESK: Permission[] = ["patients.view", "appointments.view", "appointments.edit", "visits.view"];
/** An assistant who records the visit and books, but moves no queue. */
const NURSE: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit", "appointments.create"];

/** A visit in progress: Asha Iyer with Maya Rao, token 7, in since 10:30 AM in Kochi. */
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
  treatments: [],
  appointment: { id: "a-1", status: "IN_PROGRESS", token: 7, urgentAt: null },
  alerts: [{ id: "al-1", kind: "ALLERGY", label: "Penicillin", note: null, active: true }],
  complaint: null,
  diagnosis: null,
  notes: null,
  followUpOn: null,
  vitals: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  alerts.length = 0;
  search.current = "";
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
  it("offers Bill now at the visit's foot to whoever may issue a bill (D307)", () => {
    const { unmount } = draw();
    expect(screen.queryByRole("link", { name: "Bill Asha Iyer’s visit" })).not.toBeInTheDocument();
    unmount();
    auth.current = authStub({ role: "STAFF", permissions: [...DESK, "payments.create"] });
    draw();
    expect(screen.getByRole("link", { name: "Bill Asha Iyer’s visit" })).toHaveAttribute(
      "href",
      "/billing/new?visit=v-1",
    );
  });

  it("offers No charge beside Bill now on a done visit waiting in To bill (D319)", () => {
    auth.current = authStub({ role: "STAFF", permissions: [...DESK, "payments.create"] });
    const { unmount } = draw();
    expect(screen.queryByRole("button", { name: "Mark Asha Iyer’s visit No charge" })).not.toBeInTheDocument();
    unmount();
    read.current = {
      ...read.current,
      data: aVisit({ status: "COMPLETED", completedAt: "2026-10-13T05:20:00Z", billingStatus: "TO_BILL" }),
    };
    draw();
    expect(screen.getByRole("link", { name: "Bill Asha Iyer’s visit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Asha Iyer’s visit No charge" })).toBeInTheDocument();
  });

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

  it("leads back to the patient's profile when it was opened from there (D230)", () => {
    search.current = "from=patient";
    draw();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/patients/p-1");
  });

  it("leads back to the queue from anywhere else, and before the visit is read", () => {
    search.current = "from=elsewhere";
    draw();
    expect(screen.getByRole("link", { name: "Go back" })).toHaveAttribute("href", "/queue");
    search.current = "from=patient";
    read.current = { data: undefined, mutate: vi.fn(), isValidating: true };
    draw();
    expect(screen.getAllByRole("link", { name: "Go back" }).at(-1)).toHaveAttribute("href", "/queue");
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

  it("offers Alerts on the visit, for its patient (D207)", () => {
    read.current.data = aVisit({ patient: { ...aVisit().patient, archived: true } });
    draw();
    expect(screen.getByRole("button", { name: "Alerts" })).toBeInTheDocument();
    expect(alerts.at(-1)).toEqual({ patientId: "p-1", archived: true, visitRoute: "/api/visits/v-1" });
  });
});

const fields = () => screen.queryAllByRole("textbox").map((field) => field.getAttribute("name"));

describe("VisitScreen's records (plan §12.2; D202, D208, D209)", () => {
  it("reads every section out to whoever may only read", () => {
    read.current.data = aVisit({ complaint: "Fever, 3 days", followUpOn: "2026-10-20" });
    draw();
    expect(screen.getByRole("region", { name: "Vitals" })).toHaveTextContent("Nothing recorded");
    expect(screen.getByRole("region", { name: "Complaint, diagnosis and notes" })).toHaveTextContent("Fever, 3 days");
    expect(screen.getByRole("region", { name: "Follow-up" })).toHaveTextContent("Review on Tuesday, 20 Oct 2026");
    expect(fields()).toEqual([]);
    expect(screen.queryByRole("button", { name: "Book next appointment" })).not.toBeInTheDocument();
  });

  it("gives each section its fields for whoever may write it, and Book next appointment to whoever books", () => {
    auth.current = authStub({ role: "STAFF", permissions: NURSE });
    draw();
    expect(fields()).toEqual([
      "systolic",
      "diastolic",
      "pulse",
      "temperatureF",
      "spo2",
      "respiratoryRate",
      "weightKg",
      "heightCm",
      "complaint",
      "diagnosis",
      "notes",
    ]);
    expect(screen.getByRole("radiogroup", { name: "Review in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Book next appointment" })).toBeInTheDocument();
    expect(screen.queryByText(/view-only/)).not.toBeInTheDocument();
  });

  it("lets visits.create take the vitals of a visit open — and only visits.edit change anything once it is done", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "visits.view", "visits.create"] });
    const { unmount } = draw();
    expect(fields()).toHaveLength(8);
    expect(screen.queryByRole("radiogroup", { name: "Review in" })).not.toBeInTheDocument();
    unmount();

    const done = aVisit({
      status: "COMPLETED",
      completedAt: "2026-10-13T05:20:00Z",
      appointment: { id: "a-1", status: "COMPLETED", token: 7, urgentAt: null },
    });
    read.current.data = done;
    const again = draw();
    expect(fields()).toEqual([]);
    again.unmount();

    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "visits.view", "visits.edit"] });
    draw();
    expect(fields()).toHaveLength(11);
  });

  it("writes nothing for an archived patient, nor in a view-only clinic, saying why there", () => {
    auth.current = authStub({ role: "STAFF", permissions: NURSE });
    read.current.data = aVisit({ patient: { ...aVisit().patient, archived: true } });
    const { unmount } = draw();
    expect(fields()).toEqual([]);
    expect(screen.queryByRole("button", { name: "Book next appointment" })).not.toBeInTheDocument();
    unmount();

    const nurse = authStub({ role: "STAFF", permissions: NURSE });
    auth.current = { ...nurse, subscription: { ...nurse.subscription!, state: "READ_ONLY" } };
    read.current.data = aVisit();
    draw();
    expect(fields()).toEqual([]);
    expect(screen.getByText(/view-only/)).toBeInTheDocument();
  });

  it("writes nothing for someone with no clinic", () => {
    auth.current = { ...authStub(), membership: null };
    read.current.data = aVisit({ appointment: null });
    draw();
    expect(fields()).toEqual([]);
    expect(screen.queryByRole("button", { name: /done/i })).not.toBeInTheDocument();
  });

  it("leaves out when a patient went in until they have — a visit their vitals opened while they wait (D203)", () => {
    read.current.data = aVisit({
      startedAt: null,
      appointment: { id: "a-1", status: "ARRIVED", token: 4, urgentAt: null },
    });
    draw();
    expect(screen.queryByRole("region", { name: /With doctor/ })).not.toBeInTheDocument();
    const facts = screen.getAllByRole("definition").map((value) => value.textContent);
    expect(facts).toEqual(["Tuesday, 13 Oct 2026", "04"]);
  });
});

describe("A visit started from a profile (D204)", () => {
  it("holds the patient in the lake while open, with Done for whoever starts visits", async () => {
    visits.done.mockResolvedValue({ visitId: "v-1" });
    auth.current = authStub({ role: "STAFF", permissions: NURSE });
    read.current.data = aVisit({ appointment: null });
    draw();
    const started = screen.getByRole("region", { name: "Visit: Asha Iyer" });
    expect(started).toHaveTextContent("In since 10:30 AM12 min");
    await userEvent.click(within(started).getByRole("button", { name: "Mark Asha Iyer done" }));
    expect(visits.done).toHaveBeenCalledWith("v-1");
    expect((await screen.findAllByText("Asha Iyer’s visit is done"))[0]).toBeInTheDocument();
  });

  it("offers Done to no one else, nor in a view-only clinic, and has no lake once done", () => {
    read.current.data = aVisit({ appointment: null });
    const { unmount } = draw();
    expect(
      within(screen.getByRole("region", { name: "Visit: Asha Iyer" })).queryByRole("button"),
    ).not.toBeInTheDocument();
    unmount();

    const nurse = authStub({ role: "STAFF", permissions: NURSE });
    auth.current = { ...nurse, subscription: { ...nurse.subscription!, state: "READ_ONLY" } };
    const viewOnly = draw();
    expect(
      within(screen.getByRole("region", { name: "Visit: Asha Iyer" })).queryByRole("button"),
    ).not.toBeInTheDocument();
    viewOnly.unmount();

    read.current.data = aVisit({ appointment: null, status: "COMPLETED", completedAt: "2026-10-13T05:20:00Z" });
    draw();
    expect(screen.queryByRole("region", { name: "Visit: Asha Iyer" })).not.toBeInTheDocument();
  });
});

describe("VisitScreen's prescription (plan §13; D45, D215)", () => {
  const prescription = () => screen.getByRole("region", { name: "Prescription" });
  const adds = () => within(prescription()).queryByRole("button", { name: "Add medicine" });
  /** The visit's own doctor, who holds no permission to type for anyone. */
  const ownDoctor = () => {
    const doctor = authStub({ role: "DOCTOR", permissions: ["patients.view", "visits.view"] });
    return { ...doctor, membership: { ...doctor.membership!, doctorId: "d-1" } };
  };

  it("is written by the visit's own doctor, done or not, without prescriptions.write", () => {
    auth.current = ownDoctor();
    const { unmount } = draw();
    expect(adds()).toBeInTheDocument();
    expect(screen.queryByText(/view-only/)).not.toBeInTheDocument();
    unmount();

    read.current.data = aVisit({
      status: "COMPLETED",
      completedAt: "2026-10-13T05:20:00Z",
      appointment: { id: "a-1", status: "COMPLETED", token: 7, urgentAt: null },
    });
    draw();
    expect(adds()).toBeInTheDocument();
  });

  it("is typed with prescriptions.write for another doctor's visit", () => {
    auth.current = authStub({ role: "STAFF", permissions: ["patients.view", "visits.view", "prescriptions.write"] });
    draw();
    expect(adds()).toBeInTheDocument();
  });

  it("is read out to anyone else — another doctor too", () => {
    read.current.data = aVisit({
      prescription: { id: "rx-1", items: [], advice: "Rest", printDiagnosis: false, typedBy: null },
    });
    const { unmount } = draw();
    expect(adds()).not.toBeInTheDocument();
    expect(prescription()).toHaveTextContent("Rest");
    unmount();

    auth.current = authStub({ role: "DOCTOR", permissions: ["patients.view", "visits.view"] });
    draw();
    expect(adds()).not.toBeInTheDocument();
  });

  it("is written by no one for an archived patient, nor in a view-only clinic — said there to a prescriber alone", () => {
    auth.current = ownDoctor();
    read.current.data = aVisit({ patient: { ...aVisit().patient, archived: true } });
    const { unmount } = draw();
    expect(adds()).not.toBeInTheDocument();
    unmount();

    const doctor = ownDoctor();
    auth.current = { ...doctor, subscription: { ...doctor.subscription!, state: "READ_ONLY" } };
    read.current.data = aVisit();
    draw();
    expect(adds()).not.toBeInTheDocument();
    expect(screen.getByText(/view-only/)).toBeInTheDocument();
  });
});
