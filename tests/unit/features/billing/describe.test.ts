import { describe, expect, it } from "vitest";

import { paymentLine, toBillAbout, toBillWorked } from "@/features/billing/describe";
import type { ToBillVisit } from "@/features/billing/types";

const visit: ToBillVisit = {
  visitId: "v-1",
  day: "2026-10-19",
  completedAt: "2026-10-19T06:00:00Z",
  patient: { id: "p-1", name: "Asha Rao", number: 1042, archived: false },
  doctor: { id: "d-1", name: "Maya Rao" },
  appointmentId: "a-1",
  token: 7,
  treatments: ["Root canal", "Scaling"],
  feePaid: false,
};

describe("toBillAbout (D318)", () => {
  it("names the doctor on every doctor's list, the token, and the day when not today", () => {
    expect(toBillAbout(visit, true, "2026-10-19")).toBe("Maya Rao · #7");
    expect(toBillAbout(visit, false, "2026-10-20")).toBe("#7 · 19 Oct");
    expect(toBillAbout({ ...visit, token: null, doctor: null }, true, "2026-10-19")).toBe("No doctor");
    expect(toBillAbout({ ...visit, doctor: { id: "d-1", name: null } }, true, "2026-10-19")).toBe(
      "No longer on the team · #7",
    );
  });

  it("counts from the clinic's today when none is given", () => {
    expect(toBillAbout({ ...visit, day: "2020-01-02" }, false)).toBe("#7 · 2 Jan 2020");
  });
});

describe("toBillWorked (D318)", () => {
  it("says the consultation, unless paid at arrival, and the treatments worked on", () => {
    expect(toBillWorked(visit)).toBe("Consultation · Root canal · Scaling");
    expect(toBillWorked({ ...visit, feePaid: true })).toBe("Root canal · Scaling");
    expect(toBillWorked({ ...visit, treatments: [] })).toBe("Consultation");
  });
});

describe("paymentLine (D325)", () => {
  it("says what was paid, or refunded, and how", () => {
    expect(paymentLine({ kind: "PAYMENT", amountPaise: 50_000, method: "UPI" })).toBe("Paid ₹500 · UPI");
    expect(paymentLine({ kind: "REFUND", amountPaise: 20_000, method: "CASH" })).toBe("Refunded ₹200 · Cash");
  });
});
