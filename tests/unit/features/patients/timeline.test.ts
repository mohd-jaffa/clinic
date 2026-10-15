// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PAGE_SIZE } from "@/constants/limits";
import type { Permission } from "@/constants/permissions";
import type { PatientAppointment } from "@/features/appointments/types";
import type { PatientVisit } from "@/features/visits/types";
import type { Tenant } from "@/lib/supabase/tenant";

const { listPatientAppointments, listPatientVisits } = vi.hoisted(() => ({
  listPatientAppointments: vi.fn(),
  listPatientVisits: vi.fn(),
}));
vi.mock("@/features/appointments/api", () => ({ listPatientAppointments }));
vi.mock("@/features/visits/api", () => ({ listPatientVisits }));

const { listPatientTimeline, mergeTimeline } = await import("@/features/patients/timeline");

const tenant = (permissions: Permission[]) =>
  ({ clinicId: "clinic-1", role: "STAFF", permissions }) as unknown as Tenant;

const visit = (id: string, openedAt: string) => ({ id, openedAt }) as PatientVisit;
const appointment = (id: string, scheduledAt: string) => ({ id, scheduledAt }) as PatientAppointment;
/** The ids of a page's entries, in their order. */
const ids = (items: ({ visit: PatientVisit } | { appointment: PatientAppointment })[]) =>
  items.map((entry) => ("visit" in entry ? entry.visit.id : entry.appointment.id));
/** One more than a page of one part, an hour apart, newest first, from an hour. */
const hours = <T>(make: (id: string, at: string) => T, prefix: string, from: number) =>
  Array.from({ length: PAGE_SIZE + 1 }, (_, index) =>
    make(`${prefix}-${index}`, new Date(Date.UTC(2026, 9, 14, 0) - (from + index * 2) * 3_600_000).toISOString()),
  );

const START = { visits: 0, appointments: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  listPatientVisits.mockResolvedValue([visit("v-1", "2026-10-14T05:00:00.000000+00:00")]);
  listPatientAppointments.mockResolvedValue([appointment("a-1", "2026-10-20T05:00:00+00:00")]);
});

describe("mergeTimeline (plan §10.3, D225)", () => {
  it("puts both parts in one list, newest first — a visit by its opening, an appointment by its time", () => {
    const page = mergeTimeline(
      [visit("v-1", "2026-10-14T05:00:00.123456+00:00"), visit("v-2", "2026-10-02T04:00:00+00:00")],
      [appointment("a-1", "2026-10-20T05:00:00+00:00"), appointment("a-2", "2026-10-09T05:00:00+00:00")],
      START,
    );
    expect(ids(page.items)).toEqual(["a-1", "v-1", "a-2", "v-2"]);
    expect(page.nextCursor).toBeNull();
  });

  it("breaks a tie at the same moment by the larger id, as the database does", () => {
    const at = "2026-10-14T05:00:00+00:00";
    expect(ids(mergeTimeline([visit("b", at)], [appointment("a", at)], START).items)).toEqual(["b", "a"]);
    expect(ids(mergeTimeline([visit("a", at)], [appointment("b", at)], START).items)).toEqual(["b", "a"]);
  });

  it("keeps each part's own order, whatever the clock says", () => {
    const page = mergeTimeline(
      [visit("v-1", "2026-10-01T00:00:00+00:00"), visit("v-2", "2026-10-09T00:00:00+00:00")],
      [],
      START,
    );
    expect(ids(page.items)).toEqual(["v-1", "v-2"]);
  });

  it("stops at a page, and says where the next starts in each part", () => {
    // Visits on the even hours, appointments on the odd: they alternate.
    const page = mergeTimeline(hours(visit, "v", 0), hours(appointment, "a", 1), { visits: 40, appointments: 30 });
    expect(page.items).toHaveLength(PAGE_SIZE);
    expect(ids(page.items).slice(0, 3)).toEqual(["v-0", "a-0", "v-1"]);
    expect(page.nextCursor).toBe(`${40 + PAGE_SIZE / 2}.${30 + PAGE_SIZE / 2}`);
  });

  it("takes from one part alone when the other has run out, and ends when both have", () => {
    const visitsOnly = mergeTimeline(hours(visit, "v", 0), [], START);
    expect(ids(visitsOnly.items)).toEqual(
      hours(visit, "v", 0)
        .slice(0, PAGE_SIZE)
        .map((one) => one.id),
    );
    expect(visitsOnly.nextCursor).toBe(`${PAGE_SIZE}.0`);
    expect(mergeTimeline([], hours(appointment, "a", 0).slice(0, PAGE_SIZE), START).nextCursor).toBeNull();
    expect(mergeTimeline([], [], START)).toEqual({ items: [], nextCursor: null });
  });
});

describe("listPatientTimeline (plan §10.3; D167, D225)", () => {
  it("reads the visits and the appointments at once, each from where it starts, for whoever sees both", async () => {
    const asked = tenant(["patients.view", "appointments.view", "visits.view"]);
    const page = await listPatientTimeline(asked, "p-1", { visits: 12, appointments: 8 });
    expect(ids(page.items)).toEqual(["a-1", "v-1"]);
    expect(listPatientVisits).toHaveBeenCalledWith(asked, "p-1", 12);
    expect(listPatientAppointments).toHaveBeenCalledWith(asked, "p-1", 8);
  });

  it("starts from the first page of each", async () => {
    await listPatientTimeline(tenant(["patients.view", "appointments.view", "visits.view"]), "p-1");
    expect(listPatientVisits).toHaveBeenCalledWith(expect.anything(), "p-1", 0);
    expect(listPatientAppointments).toHaveBeenCalledWith(expect.anything(), "p-1", 0);
  });

  it("gives each part only to whoever sees it, and leaves the other unread", async () => {
    expect(ids((await listPatientTimeline(tenant(["patients.view", "visits.view"]), "p-1")).items)).toEqual(["v-1"]);
    expect(listPatientAppointments).not.toHaveBeenCalled();
    vi.clearAllMocks();
    expect(ids((await listPatientTimeline(tenant(["patients.view", "appointments.view"]), "p-1")).items)).toEqual([
      "a-1",
    ]);
    expect(listPatientVisits).not.toHaveBeenCalled();
  });

  it("gives anyone else an empty page, unread", async () => {
    expect(await listPatientTimeline(tenant(["patients.view"]), "p-1")).toEqual({ items: [], nextCursor: null });
    expect(listPatientVisits).not.toHaveBeenCalled();
    expect(listPatientAppointments).not.toHaveBeenCalled();
  });
});
