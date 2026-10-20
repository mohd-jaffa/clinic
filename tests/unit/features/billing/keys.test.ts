import { describe, expect, it } from "vitest";

import {
  billIssuedRoutes,
  billStartKey,
  billTargetIn,
  billTargetOf,
  billsKey,
  billVoidedRoutes,
  noChargeRoutes,
  paymentRoutes,
  paymentsKey,
  reissueIn,
  reissueOf,
  toBillCountKey,
  toBillKey,
} from "@/features/billing/keys";
import type { BillDetail, BillStart } from "@/features/billing/types";

const VISIT = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const PATIENT = "8c2f5b63-4d6e-4f70-9bac-1d2e3f4a5b6c";

describe("billStartKey (plan §15.2)", () => {
  it("asks for where the bill starts by its one id", () => {
    expect(billStartKey({ visit: VISIT })).toBe(`/api/bills/start?visit=${VISIT}`);
    expect(billStartKey({ appointment: VISIT })).toBe(`/api/bills/start?appointment=${VISIT}`);
  });
});

describe("billTargetOf, billTargetIn (D313)", () => {
  it("reads a visit, an arrival or a patient from the address", () => {
    const params = new URLSearchParams({ visit: VISIT });
    expect(billTargetOf((name) => params.get(name))).toEqual({ visit: VISIT });
    expect(billTargetIn({ appointment: VISIT })).toEqual({ appointment: VISIT });
    expect(billTargetIn({ patient: PATIENT, from: "billing" })).toEqual({ patient: PATIENT });
  });

  it("reads no one from nothing, two, a name given twice, or one that is not an id", () => {
    expect(billTargetIn({})).toBeNull();
    expect(billTargetIn({ visit: VISIT, patient: PATIENT })).toBeNull();
    expect(billTargetIn({ patient: [PATIENT, PATIENT] })).toBeNull();
    expect(billTargetIn({ visit: "seven" })).toBeNull();
  });
});

describe("billIssuedRoutes", () => {
  const start = { patient: { id: "p-1" }, visit: null, appointment: null } as unknown as BillStart;
  it("refreshes where bills start, the queue, Billing's lists and the profile — and the visit or arrival billed", () => {
    expect(billIssuedRoutes(start)).toEqual([
      "/api/bills/start",
      "/api/queue",
      "/api/to-bill",
      "/api/to-bill/count",
      "/api/bills",
      "/api/payments",
      "/api/outstanding",
      "/api/patients/search",
      "/api/patients/p-1/summary",
      "/api/patients/p-1/timeline",
    ]);
    expect(billIssuedRoutes({ ...start, visit: { id: "v-1" } } as BillStart)).toContain("/api/visits/v-1");
    expect(billIssuedRoutes({ ...start, appointment: { id: "a-1" } } as BillStart)).toContain("/api/appointments/a-1");
  });
});

describe("reissueOf, reissueIn (D314)", () => {
  it("reads the void bill a new one issues again by its id — none for nothing, a name given twice, or not an id", () => {
    expect(reissueOf(VISIT)).toBe(VISIT);
    expect(reissueOf(null)).toBeNull();
    expect(reissueOf("seven")).toBeNull();
    expect(reissueIn({ reissue: VISIT })).toBe(VISIT);
    expect(reissueIn({ reissue: [VISIT, VISIT] })).toBeNull();
    expect(reissueIn({})).toBeNull();
  });
});

describe("billVoidedRoutes (D314)", () => {
  it("reads again the bill, where bills start, the queue, Billing's lists, the patient, and the visit or arrival it billed", () => {
    const bill = { id: "b-1", patient: { id: "p-1" }, visitId: "v-1", appointmentId: null } as BillDetail;
    expect(billVoidedRoutes(bill)).toEqual([
      "/api/bills/b-1",
      "/api/bills/start",
      "/api/queue",
      "/api/to-bill",
      "/api/to-bill/count",
      "/api/bills",
      "/api/payments",
      "/api/outstanding",
      "/api/patients/search",
      "/api/patients/p-1/summary",
      "/api/patients/p-1/timeline",
      "/api/visits/v-1",
    ]);
    expect(billVoidedRoutes({ ...bill, visitId: null, appointmentId: "a-1" }).at(-1)).toBe("/api/appointments/a-1");
    expect(billVoidedRoutes({ ...bill, visitId: null })).toHaveLength(11);
  });
});

describe("Billing's keys (plan §15.4; D318, D320, D337)", () => {
  it("asks for one doctor's To bill and its count, or every doctor's, and a range of bills or payments", () => {
    expect(toBillKey()).toBe("/api/to-bill");
    expect(toBillKey("d-1")).toBe("/api/to-bill?doctorId=d-1");
    expect(toBillCountKey()).toBe("/api/to-bill/count");
    expect(toBillCountKey("d-1")).toBe("/api/to-bill/count?doctorId=d-1");
    const days = { from: "2026-10-01", to: "2026-10-19" };
    expect(billsKey(days)).toBe("/api/bills?from=2026-10-01&to=2026-10-19");
    expect(billsKey(days, "VOID")).toBe("/api/bills?from=2026-10-01&to=2026-10-19&state=VOID");
    expect(paymentsKey(days)).toBe("/api/payments?from=2026-10-01&to=2026-10-19");
  });
});

describe("paymentRoutes and noChargeRoutes (D319, D336)", () => {
  it("reads again Billing's lists, where bills start, the patients and the profile — and the bill paid from", () => {
    expect(paymentRoutes("p-1")).toEqual([
      "/api/payments",
      "/api/bills",
      "/api/outstanding",
      "/api/bills/start",
      "/api/patients/search",
      "/api/patients/p-1/summary",
      "/api/patients/p-1/timeline",
    ]);
    expect(paymentRoutes("p-1", "b-1").at(-1)).toBe("/api/bills/b-1");
  });

  it("reads again To bill, its count, the queue, where bills start, the history and the visit marked free", () => {
    expect(noChargeRoutes("v-1", "p-1")).toEqual([
      "/api/to-bill",
      "/api/to-bill/count",
      "/api/queue",
      "/api/bills/start",
      "/api/patients/p-1/timeline",
      "/api/visits/v-1",
    ]);
  });
});
