import { describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { actionsFor, isMovable, isRemindable, NO_ACTIONS } from "@/features/appointments/actions";
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
      ...NO_ACTIONS,
      arrive: true,
      remind: true,
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
      ...NO_ACTIONS,
      sendIn: true,
      stepOut: true,
      markUrgent: true,
      arrive: false,
      remind: false,
      confirm: false,
      reschedule: false,
      editNotes: true,
      noShow: true,
      cancel: true,
    });
    expect(actionsFor(anAppointmentDetail({ status: "CANCELLED" }), desk(ALL), now)).toEqual({
      ...NO_ACTIONS,
      arrive: false,
      remind: false,
      confirm: false,
      reschedule: false,
      editNotes: true,
      noShow: false,
      cancel: false,
    });
  });

  it("asks appointments.edit for all but cancel, which asks appointments.cancel", () => {
    expect(actionsFor(anAppointmentDetail(), desk(["appointments.cancel"]), now)).toEqual({
      ...NO_ACTIONS,
      arrive: false,
      remind: false,
      confirm: false,
      reschedule: false,
      editNotes: false,
      noShow: false,
      cancel: true,
    });
    expect(actionsFor(anAppointmentDetail(), desk(["appointments.edit"]), now).cancel).toBe(false);
  });

  it("offers nothing for an archived patient but their visit (D103)", () => {
    expect(actionsFor(anAppointmentDetail({ patientArchived: true }), desk(ALL), now)).toEqual(NO_ACTIONS);
    const seen = anAppointmentDetail({ patientArchived: true, status: "COMPLETED", visitId: "v-1" });
    expect(actionsFor(seen, desk([...ALL, "visits.view"]), now)).toEqual({ ...NO_ACTIONS, openVisit: true });
  });

  it("offers Send in and Stepped out to a patient waiting, Back to one stepped out, Done and Back to waiting to one in (D197, D198)", () => {
    const waiting = anAppointmentDetail({ status: "ARRIVED", token: 4 });
    expect(actionsFor(waiting, desk(ALL), now)).toMatchObject({ sendIn: true, stepOut: true, stepBack: false });
    const away = anAppointmentDetail({ status: "ARRIVED", steppedOutAt: "2026-10-13T04:30:00Z" });
    expect(actionsFor(away, desk(ALL), now)).toMatchObject({ sendIn: true, stepOut: false, stepBack: true });
    const inRoom = anAppointmentDetail({ status: "IN_PROGRESS", visitId: "v-1" });
    expect(actionsFor(inRoom, desk(ALL), now)).toMatchObject({
      done: true,
      backToWaiting: true,
      sendIn: false,
      openVisit: false,
    });
    expect(actionsFor(inRoom, desk(["appointments.cancel"]), now)).toMatchObject({ done: false, backToWaiting: false });
  });

  it("offers Urgent to a patient waiting, and Not urgent while they wait or are in, never once done (D201)", () => {
    const waiting = anAppointmentDetail({ status: "ARRIVED", token: 4 });
    expect(actionsFor(waiting, desk(ALL), now)).toMatchObject({ markUrgent: true, unmarkUrgent: false });
    const urgent = { urgentAt: "2026-10-13T04:30:00Z" };
    expect(actionsFor({ ...waiting, ...urgent }, desk(ALL), now)).toMatchObject({
      markUrgent: false,
      unmarkUrgent: true,
    });
    const inRoom = anAppointmentDetail({ status: "IN_PROGRESS", visitId: "v-1" });
    expect(actionsFor(inRoom, desk(ALL), now)).toMatchObject({ markUrgent: false, unmarkUrgent: false });
    expect(actionsFor({ ...inRoom, ...urgent }, desk(ALL), now)).toMatchObject({ unmarkUrgent: true });
    const done = anAppointmentDetail({ status: "COMPLETED", visitId: "v-1", ...urgent });
    expect(actionsFor(done, desk(ALL), now)).toMatchObject({ markUrgent: false, unmarkUrgent: false });
    expect(actionsFor({ ...waiting, ...urgent }, desk(["appointments.cancel"]), now)).toMatchObject({
      markUrgent: false,
      unmarkUrgent: false,
    });
    expect(actionsFor(waiting, desk(["appointments.cancel"]), now).markUrgent).toBe(false);
  });

  it("offers Vitals to a patient waiting, for visits.create alone — not before they arrive, once in, or archived (D203)", () => {
    const taker = desk(["visits.create"]);
    const waiting = anAppointmentDetail({ status: "ARRIVED", token: 4 });
    expect(actionsFor(waiting, taker, now)).toEqual({ ...NO_ACTIONS, takeVitals: true });
    expect(actionsFor(waiting, desk(ALL), now).takeVitals).toBe(false);
    expect(actionsFor(anAppointmentDetail(), taker, now).takeVitals).toBe(false);
    expect(actionsFor(anAppointmentDetail({ status: "IN_PROGRESS", visitId: "v-1" }), taker, now).takeVitals).toBe(
      false,
    );
    expect(actionsFor({ ...waiting, patientArchived: true }, taker, now).takeVitals).toBe(false);
  });

  it("opens the visit for whoever reads visits, and offers no no-show or cancel once one is kept (D195, D197)", () => {
    const kept = anAppointmentDetail({ status: "ARRIVED", visitId: "v-1" });
    expect(actionsFor(kept, desk([...ALL, "visits.view"]), now)).toMatchObject({
      openVisit: true,
      noShow: false,
      cancel: false,
      sendIn: true,
    });
    expect(actionsFor(anAppointmentDetail({ visitId: "v-1" }), desk(ALL), now).openVisit).toBe(false);
  });

  it("goes by the clock when no time is given", () => {
    const longAgo = anAppointmentDetail({ day: "2020-01-01", scheduledAt: "2020-01-01T03:30:00Z" });
    expect(actionsFor(longAgo, desk(ALL))).toMatchObject({ confirm: false, noShow: true });
  });

  it("offers Arrived on the appointment's own day only — a no-show come late too — never to one in with the doctor", () => {
    expect(actionsFor(anAppointmentDetail({ status: "NO_SHOW" }), desk(ALL), now).arrive).toBe(true);
    const tomorrow = anAppointmentDetail({ day: "2026-10-14", scheduledAt: "2026-10-14T03:30:00Z" });
    expect(actionsFor(tomorrow, desk(ALL), now).arrive).toBe(false);
    expect(actionsFor(anAppointmentDetail({ status: "IN_PROGRESS" }), desk(ALL), now).arrive).toBe(false);
    expect(actionsFor(anAppointmentDetail({ status: "ARRIVED" }), desk(ALL), now).arrive).toBe(false);
  });

  it("offers a reminder for a booking still to come, today or later, to whoever may change appointments (D182, D184)", () => {
    const tomorrow = anAppointmentDetail({
      day: "2026-10-14",
      scheduledAt: "2026-10-14T03:30:00Z",
      status: "CONFIRMED",
    });
    expect(actionsFor(tomorrow, desk(ALL), now).remind).toBe(true);
    expect(actionsFor(tomorrow, desk(["appointments.cancel"]), now).remind).toBe(false);
  });
});

describe("isRemindable (D184)", () => {
  it("is a booking scheduled or confirmed, today or later", () => {
    const booking = { source: "BOOKED" as const, status: "SCHEDULED" as const };
    expect(isRemindable({ ...booking, day: "2026-10-13" }, "2026-10-13")).toBe(true);
    expect(isRemindable({ ...booking, day: "2026-10-12" }, "2026-10-13")).toBe(false);
    expect(isRemindable({ ...booking, status: "ARRIVED", day: "2026-10-13" }, "2026-10-13")).toBe(false);
    expect(isRemindable({ source: "WALK_IN", status: "SCHEDULED", day: "2026-10-13" }, "2026-10-13")).toBe(false);
    expect(isRemindable({ ...booking, day: "2999-01-01" })).toBe(true);
  });
});
