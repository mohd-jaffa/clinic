// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PAGE_SIZE } from "@/constants/limits";
import type { Permission } from "@/constants/permissions";
import type { PatientAppointment } from "@/features/appointments/types";
import type { PatientBill, Payment } from "@/features/billing/types";
import type { TimelineParts } from "@/features/patients/timeline";
import type { TimelineEntry } from "@/features/patients/types";
import type { PatientVisit } from "@/features/visits/types";
import type { Tenant } from "@/lib/supabase/tenant";

const { listPatientAppointments, listPatientVisits, listPatientBills, listPatientPayments } = vi.hoisted(() => ({
  listPatientAppointments: vi.fn(),
  listPatientVisits: vi.fn(),
  listPatientBills: vi.fn(),
  listPatientPayments: vi.fn(),
}));
vi.mock("@/features/appointments/api", () => ({ listPatientAppointments }));
vi.mock("@/features/visits/api", () => ({ listPatientVisits }));
vi.mock("@/features/billing/api", () => ({ listPatientBills }));
vi.mock("@/features/billing/payments", () => ({ listPatientPayments }));

const { listPatientTimeline, mergeTimeline } = await import("@/features/patients/timeline");

const tenant = (permissions: Permission[]) =>
  ({ clinicId: "clinic-1", role: "STAFF", permissions }) as unknown as Tenant;

const visit = (id: string, openedAt: string) => ({ id, openedAt }) as PatientVisit;
const appointment = (id: string, scheduledAt: string) => ({ id, scheduledAt }) as PatientAppointment;
const bill = (id: string, issuedAt: string) => ({ id, issuedAt }) as PatientBill;
const payment = (id: string, paidAt: string) => ({ id, paidAt }) as Payment;
/** The ids of a page's entries, in their order. */
const ids = (items: TimelineEntry[]) =>
  items.map((entry) => {
    if ("visit" in entry) return entry.visit.id;
    if ("appointment" in entry) return entry.appointment.id;
    return "bill" in entry ? entry.bill.id : entry.payment.id;
  });
/** One more than a page of one part, `every` hours apart, newest first, from an hour. */
const hours = <T>(make: (id: string, at: string) => T, prefix: string, from: number, every = 2) =>
  Array.from({ length: PAGE_SIZE + 1 }, (_, index) =>
    make(`${prefix}-${index}`, new Date(Date.UTC(2026, 9, 14, 0) - (from + index * every) * 3_600_000).toISOString()),
  );
const parts = (given: Partial<TimelineParts>): TimelineParts => ({
  visits: [],
  appointments: [],
  bills: [],
  payments: [],
  ...given,
});

const START = { visits: 0, appointments: 0, bills: 0, payments: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  listPatientVisits.mockResolvedValue([visit("v-1", "2026-10-14T05:00:00.000000+00:00")]);
  listPatientAppointments.mockResolvedValue([appointment("a-1", "2026-10-20T05:00:00+00:00")]);
  listPatientBills.mockResolvedValue([bill("b-1", "2026-10-14T06:00:00+00:00")]);
  listPatientPayments.mockResolvedValue([payment("p-1", "2026-10-14T07:00:00+00:00")]);
});

describe("mergeTimeline (plan §10.3; D225, D325)", () => {
  it("puts every part in one list, newest first — a visit by its opening, an appointment by its time, a bill by its issue, a payment by when it was paid", () => {
    const page = mergeTimeline(
      parts({
        visits: [visit("v-1", "2026-10-14T05:00:00.123456+00:00"), visit("v-2", "2026-10-02T04:00:00+00:00")],
        appointments: [
          appointment("a-1", "2026-10-20T05:00:00+00:00"),
          appointment("a-2", "2026-10-09T05:00:00+00:00"),
        ],
        bills: [bill("b-1", "2026-10-14T05:20:00+00:00")],
        payments: [payment("p-1", "2026-10-14T05:30:00+00:00"), payment("p-2", "2026-10-01T05:30:00+00:00")],
      }),
      START,
    );
    expect(ids(page.items)).toEqual(["a-1", "p-1", "b-1", "v-1", "a-2", "v-2", "p-2"]);
    expect(page.nextCursor).toBeNull();
  });

  it("breaks a tie at the same moment by the larger id, as the database does", () => {
    const at = "2026-10-14T05:00:00+00:00";
    expect(
      ids(mergeTimeline(parts({ visits: [visit("b", at)], appointments: [appointment("a", at)] }), START).items),
    ).toEqual(["b", "a"]);
    expect(ids(mergeTimeline(parts({ bills: [bill("a", at)], payments: [payment("c", at)] }), START).items)).toEqual([
      "c",
      "a",
    ]);
  });

  it("keeps each part's own order, whatever the clock says", () => {
    const page = mergeTimeline(
      parts({ visits: [visit("v-1", "2026-10-01T00:00:00+00:00"), visit("v-2", "2026-10-09T00:00:00+00:00")] }),
      START,
    );
    expect(ids(page.items)).toEqual(["v-1", "v-2"]);
  });

  it("stops at a page, and says where the next starts in each part", () => {
    // Visits, appointments, bills and payments by turns, an hour apart.
    const page = mergeTimeline(
      parts({
        visits: hours(visit, "v", 0, 4),
        appointments: hours(appointment, "a", 1, 4),
        bills: hours(bill, "b", 2, 4),
        payments: hours(payment, "p", 3, 4),
      }),
      { visits: 40, appointments: 30, bills: 20, payments: 10 },
    );
    expect(page.items).toHaveLength(PAGE_SIZE);
    expect(ids(page.items).slice(0, 5)).toEqual(["v-0", "a-0", "b-0", "p-0", "v-1"]);
    const each = PAGE_SIZE / 4;
    expect(page.nextCursor).toBe(`${40 + each}.${30 + each}.${20 + each}.${10 + each}`);
  });

  it("takes from one part alone when the others have run out, and ends when all have", () => {
    const visitsOnly = mergeTimeline(parts({ visits: hours(visit, "v", 0) }), START);
    expect(ids(visitsOnly.items)).toEqual(
      hours(visit, "v", 0)
        .slice(0, PAGE_SIZE)
        .map((one) => one.id),
    );
    expect(visitsOnly.nextCursor).toBe(`${PAGE_SIZE}.0.0.0`);
    expect(mergeTimeline(parts({ payments: hours(payment, "p", 0) }), START).nextCursor).toBe(`0.0.0.${PAGE_SIZE}`);
    expect(mergeTimeline(parts({ bills: hours(bill, "b", 0).slice(0, PAGE_SIZE) }), START).nextCursor).toBeNull();
    expect(mergeTimeline(parts({}), START)).toEqual({ items: [], nextCursor: null });
  });
});

describe("listPatientTimeline (plan §10.3; D167, D225, D325)", () => {
  it("reads every part at once, each from where it starts, for whoever sees them all", async () => {
    const asked = tenant(["patients.view", "appointments.view", "visits.view", "payments.view"]);
    const page = await listPatientTimeline(asked, "p-1", { visits: 12, appointments: 8, bills: 3, payments: 5 });
    expect(ids(page.items)).toEqual(["a-1", "p-1", "b-1", "v-1"]);
    expect(listPatientVisits).toHaveBeenCalledWith(asked, "p-1", 12);
    expect(listPatientAppointments).toHaveBeenCalledWith(asked, "p-1", 8);
    expect(listPatientBills).toHaveBeenCalledWith(asked, "p-1", 3);
    expect(listPatientPayments).toHaveBeenCalledWith(asked, "p-1", 5);
  });

  it("starts from the first page of each", async () => {
    await listPatientTimeline(tenant(["patients.view", "appointments.view", "visits.view", "payments.view"]), "p-1");
    for (const list of [listPatientVisits, listPatientAppointments, listPatientBills, listPatientPayments]) {
      expect(list).toHaveBeenCalledWith(expect.anything(), "p-1", 0);
    }
  });

  it("gives each part only to whoever sees it, and leaves the others unread", async () => {
    expect(ids((await listPatientTimeline(tenant(["patients.view", "visits.view"]), "p-1")).items)).toEqual(["v-1"]);
    expect(listPatientAppointments).not.toHaveBeenCalled();
    expect(listPatientBills).not.toHaveBeenCalled();
    vi.clearAllMocks();
    expect(ids((await listPatientTimeline(tenant(["patients.view", "appointments.view"]), "p-1")).items)).toEqual([
      "a-1",
    ]);
    expect(listPatientVisits).not.toHaveBeenCalled();
    expect(listPatientPayments).not.toHaveBeenCalled();
    vi.clearAllMocks();
    // Bills and payments with payments.view alone (D325).
    expect(ids((await listPatientTimeline(tenant(["patients.view", "payments.view"]), "p-1")).items)).toEqual([
      "p-1",
      "b-1",
    ]);
    expect(listPatientVisits).not.toHaveBeenCalled();
    expect(listPatientAppointments).not.toHaveBeenCalled();
  });

  it("gives anyone else an empty page, unread", async () => {
    expect(await listPatientTimeline(tenant(["patients.view"]), "p-1")).toEqual({ items: [], nextCursor: null });
    for (const list of [listPatientVisits, listPatientAppointments, listPatientBills, listPatientPayments]) {
      expect(list).not.toHaveBeenCalled();
    }
  });
});
