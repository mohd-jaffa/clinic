import { describe, expect, it } from "vitest";

import { lateBy, minutesSince, queueSections, walkInDoctor } from "@/features/appointments/queue";
import { aQueueAppointment } from "@tests/support/appointments";

const now = new Date("2026-10-13T05:30:00Z");

describe("queueSections (plan §11.4, D168)", () => {
  it("sorts today's queue into its sections, each in its own order", () => {
    const appointments = [
      aQueueAppointment({ id: "come-late", status: "CONFIRMED", scheduledAt: "2026-10-13T06:00:00Z" }),
      aQueueAppointment({ id: "come-early", status: "SCHEDULED", scheduledAt: "2026-10-13T04:00:00Z" }),
      aQueueAppointment({ id: "wait-9", status: "ARRIVED", token: 9, arrivedAt: "2026-10-13T05:00:00Z" }),
      aQueueAppointment({ id: "wait-2", status: "ARRIVED", token: 2, arrivedAt: "2026-10-13T05:10:00Z" }),
      aQueueAppointment({ id: "wait-none", status: "ARRIVED", token: null, arrivedAt: "2026-10-13T04:50:00Z" }),
      aQueueAppointment({ id: "in-later", status: "IN_PROGRESS", startedAt: "2026-10-13T05:20:00Z" }),
      aQueueAppointment({ id: "in-first", status: "IN_PROGRESS", startedAt: "2026-10-13T05:00:00Z" }),
      aQueueAppointment({ id: "done-early", status: "COMPLETED", completedAt: "2026-10-13T04:00:00Z" }),
      aQueueAppointment({ id: "done-late", status: "COMPLETED", completedAt: "2026-10-13T05:00:00Z" }),
    ];
    const sections = queueSections(appointments);
    const ids = (list: readonly { id: string }[]) => list.map(({ id }) => id);
    expect({
      withDoctor: ids(sections.withDoctor),
      waiting: ids(sections.waiting),
      stillToCome: ids(sections.stillToCome),
      done: ids(sections.done),
    }).toEqual({
      withDoctor: ["in-first", "in-later"],
      waiting: ["wait-2", "wait-9", "wait-none"],
      stillToCome: ["come-early", "come-late"],
      done: ["done-late", "done-early"],
    });
  });

  it("orders those arrived with the same token, or none, by when they arrived — a time unknown first", () => {
    const { waiting } = queueSections([
      aQueueAppointment({ id: "later", status: "ARRIVED", token: null, arrivedAt: "2026-10-13T05:10:00Z" }),
      aQueueAppointment({ id: "unknown", status: "ARRIVED", token: null, arrivedAt: null }),
    ]);
    expect(waiting.map(({ id }) => id)).toEqual(["unknown", "later"]);
  });
});

describe("minutesSince and lateBy (D174)", () => {
  it("counts whole minutes to now, never below none", () => {
    expect(minutesSince("2026-10-13T05:23:30Z", now)).toBe(6);
    expect(minutesSince("2026-10-13T05:40:00Z", now)).toBe(0);
    expect(minutesSince(null, now)).toBe(0);
  });

  it("says how late a patient still to come is, from a minute past their time", () => {
    expect(lateBy({ scheduledAt: "2026-10-13T05:05:00Z" }, now)).toBe(25);
    expect(lateBy({ scheduledAt: "2026-10-13T05:29:30Z" }, now)).toBeNull();
    expect(lateBy({ scheduledAt: "2026-10-13T06:00:00Z" }, now)).toBeNull();
  });
});

describe("walkInDoctor (D175)", () => {
  const doctors = [{ id: "d-1" }, { id: "d-2" }];

  it("starts on the queue's doctor, else the member's own, else the only doctor, else none", () => {
    expect(walkInDoctor({ queueDoctor: "d-2", ownDoctor: "d-1", doctors })).toBe("d-2");
    expect(walkInDoctor({ queueDoctor: "", ownDoctor: "d-1", doctors })).toBe("d-1");
    expect(walkInDoctor({ queueDoctor: "", ownDoctor: "d-9", doctors })).toBe("");
    expect(walkInDoctor({ queueDoctor: "", ownDoctor: null, doctors: [{ id: "d-1" }] })).toBe("d-1");
    expect(walkInDoctor({ queueDoctor: "", ownDoctor: null, doctors })).toBe("");
  });
});
