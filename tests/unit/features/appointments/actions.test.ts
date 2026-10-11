import { describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { actionsFor, isMovable } from "@/features/appointments/actions";
import { anAppointmentDetail } from "@tests/support/appointments";

// Tuesday 13 October 2026, 10:07 AM in Kochi; the appointment is at 9:00 AM.
const now = new Date("2026-10-13T04:37:00Z");
const desk = (permissions: Permission[]) => ({ role: "STAFF" as const, permissions });
const ALL: Permission[] = ["appointments.edit", "appointments.cancel"];

describe("isMovable (plan §11.1)", () => {
  it("is a booking not yet arrived", () => {
    expect(isMovable({ source: "BOOKED", status: "SCHEDULED" })).toBe(true);
    expect(isMovable({ source: "BOOKED", status: "CONFIRMED" })).toBe(true);
    expect(isMovable({ source: "BOOKED", status: "ARRIVED" })).toBe(false);
    expect(isMovable({ source: "WALK_IN", status: "ARRIVED" })).toBe(false);
  });
});

describe("actionsFor (plan §11.2; D161 – D164)", () => {
  it("offers a scheduled booking everything its status allows: confirm, reschedule, a no-show once its time has come, cancel", () => {
    expect(actionsFor(anAppointmentDetail(), desk(ALL), now)).toEqual({
      confirm: true,
      reschedule: true,
      editNotes: false,
      noShow: true,
      cancel: true,
    });
  });

  it("offers no no-show before its time, and no confirm on a day passed or once confirmed", () => {
    const later = anAppointmentDetail({ scheduledAt: "2026-10-13T06:30:00Z" });
    expect(actionsFor(later, desk(ALL), now).noShow).toBe(false);
    const yesterday = anAppointmentDetail({ day: "2026-10-12", scheduledAt: "2026-10-12T03:30:00Z" });
    expect(actionsFor(yesterday, desk(ALL), now).confirm).toBe(false);
    expect(actionsFor(anAppointmentDetail({ status: "CONFIRMED" }), desk(ALL), now)).toMatchObject({
      confirm: false,
      reschedule: true,
    });
  });

  it("offers notes alone, beside a no-show and cancel, once it cannot move — and nothing but notes when it is over", () => {
    const walkIn = anAppointmentDetail({ source: "WALK_IN", status: "ARRIVED", token: 3 });
    expect(actionsFor(walkIn, desk(ALL), now)).toEqual({
      confirm: false,
      reschedule: false,
      editNotes: true,
      noShow: true,
      cancel: true,
    });
    expect(actionsFor(anAppointmentDetail({ status: "CANCELLED" }), desk(ALL), now)).toEqual({
      confirm: false,
      reschedule: false,
      editNotes: true,
      noShow: false,
      cancel: false,
    });
  });

  it("asks appointments.edit for all but cancel, which asks appointments.cancel", () => {
    expect(actionsFor(anAppointmentDetail(), desk(["appointments.cancel"]), now)).toEqual({
      confirm: false,
      reschedule: false,
      editNotes: false,
      noShow: false,
      cancel: true,
    });
    expect(actionsFor(anAppointmentDetail(), desk(["appointments.edit"]), now).cancel).toBe(false);
  });

  it("offers nothing for an archived patient (D103)", () => {
    expect(Object.values(actionsFor(anAppointmentDetail({ patientArchived: true }), desk(ALL), now))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("goes by the clock when no time is given", () => {
    const longAgo = anAppointmentDetail({ day: "2020-01-01", scheduledAt: "2020-01-01T03:30:00Z" });
    expect(actionsFor(longAgo, desk(ALL))).toMatchObject({ confirm: false, noShow: true });
  });
});
