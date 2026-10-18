import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, issueBill } = vi.hoisted(() => ({ getSession: vi.fn(), issueBill: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/billing/api", () => ({ issueBill }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/bills/route");

const KEY = "3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f";
const PATIENT = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const SERVICE = "8c2f5b63-4d6e-4f70-9bac-1d2e3f4a5b6c";
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const typed = {
  patientId: PATIENT,
  visitId: null,
  appointmentId: null,
  lines: [{ kind: "SERVICE", serviceId: SERVICE, treatmentId: null, quantity: 1, price: "500" }],
  discount: { kind: "NONE" },
  notes: "",
  collect: { on: true, amount: "500", method: "CASH", reference: "" },
};
const post = async (body: unknown, key: string | null = KEY) =>
  answerOf(
    await POST(
      apiRequest("/api/bills", {
        method: "POST",
        body,
        headers: { authorization: "Bearer tok", ...(key && { "Idempotency-Key": key }) },
      }),
    ),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "payments.create"]));
  issueBill.mockResolvedValue({ billId: "b-1", billNumber: "2026-27/0001" });
});

describe("POST /api/bills (plan §15.2)", () => {
  it("issues the bill as parsed, once per key, for payments.create, and answers 201", async () => {
    expect(await post(typed)).toMatchObject({ status: 201, body: { data: { billNumber: "2026-27/0001" } } });
    expect(issueBill).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      expect.objectContaining({
        patientId: PATIENT,
        items: [{ serviceId: SERVICE, treatmentId: null, description: null, quantity: 1, unitPricePaise: 50_000 }],
        payment: { amountPaise: 50_000, method: "CASH", reference: null },
      }),
      KEY,
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a bill it cannot read, and one sent without its key", async () => {
    expect(await post({ ...typed, lines: [] })).toMatchObject({ status: 400 });
    expect(await post(typed, null)).toMatchObject({
      status: 400,
      body: { error: { code: "IDEMPOTENCY_KEY_REQUIRED" } },
    });
    expect(issueBill).not.toHaveBeenCalled();
  });

  it("refuses someone who may only read bills, and a view-only clinic", async () => {
    getSession.mockResolvedValue(member(["patients.view", "payments.view"]));
    expect((await post(typed)).status).toBe(403);
    const session = member(["patients.view", "payments.create"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post(typed)).toMatchObject({ status: 422, body: { error: { code: "CLINIC_PLAN_EXPIRED" } } });
    expect(issueBill).not.toHaveBeenCalled();
  });
});
