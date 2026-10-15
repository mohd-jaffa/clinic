import { describe, expect, it } from "vitest";

import { dueLabel, inShowingOrder, MOVE_STATUS, movesFrom } from "@/features/treatments/describe";
import { aTreatment } from "@tests/support/treatments";

describe("dueLabel (plan §14.3)", () => {
  it("says when it is due from today", () => {
    expect(dueLabel("2026-10-15", "2026-10-15")).toBe("Due today");
    expect(dueLabel("2026-10-16", "2026-10-15")).toBe("Due tomorrow");
    expect(dueLabel("2026-10-22", "2026-10-15")).toBe("Due in 7 days");
    expect(dueLabel("2026-10-14", "2026-10-15")).toBe("Overdue by 1 day");
    expect(dueLabel("2026-10-11", "2026-10-15")).toBe("Overdue by 4 days");
    expect(typeof dueLabel("2026-10-11")).toBe("string");
  });
});

describe("inShowingOrder (D260)", () => {
  it("puts the open first as they were begun, then the closed, the latest closed first", () => {
    const planned = aTreatment({ id: "a", status: "PLANNED" });
    const old = aTreatment({ id: "b", status: "COMPLETED", completedOn: "2026-09-01" });
    const recent = aTreatment({ id: "c", status: "CANCELLED", cancelledOn: "2026-10-01" });
    const held = aTreatment({ id: "d", status: "ON_HOLD" });
    const odd = aTreatment({ id: "e", status: "CANCELLED" });
    const { open, closed } = inShowingOrder([planned, old, recent, held, odd]);
    expect(open.map(({ id }) => id)).toEqual(["a", "d"]);
    expect(closed.map(({ id }) => id)).toEqual(["c", "b", "e"]);
  });
});

describe("movesFrom (D250, D256)", () => {
  it("offers what each status allows, the forward move first", () => {
    expect(movesFrom("PLANNED")).toEqual(["START", "HOLD", "CANCEL"]);
    expect(movesFrom("IN_PROGRESS")).toEqual(["COMPLETE", "HOLD", "CANCEL"]);
    expect(movesFrom("ON_HOLD")).toEqual(["RESUME", "CANCEL"]);
    expect(movesFrom("COMPLETED")).toEqual([]);
    expect(movesFrom("CANCELLED")).toEqual([]);
    expect(MOVE_STATUS).toEqual({
      START: "IN_PROGRESS",
      RESUME: "IN_PROGRESS",
      COMPLETE: "COMPLETED",
      HOLD: "ON_HOLD",
      CANCEL: "CANCELLED",
    });
  });
});
