import { describe, expect, it } from "vitest";

import { billIssuedRoutes, billStartKey, billTargetIn, billTargetOf } from "@/features/billing/keys";
import type { BillStart } from "@/features/billing/types";

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
  it("refreshes where bills start, the queue and the profile — and the visit or arrival billed", () => {
    expect(billIssuedRoutes(start)).toEqual([
      "/api/bills/start",
      "/api/queue",
      "/api/patients/p-1/summary",
      "/api/patients/p-1/timeline",
    ]);
    expect(billIssuedRoutes({ ...start, visit: { id: "v-1" } } as BillStart)).toContain("/api/visits/v-1");
    expect(billIssuedRoutes({ ...start, appointment: { id: "a-1" } } as BillStart)).toContain("/api/appointments/a-1");
  });
});
