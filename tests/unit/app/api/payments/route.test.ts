import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listPayments, recordPayment } = vi.hoisted(() => ({
  getSession: vi.fn(),
  listPayments: vi.fn(),
  recordPayment: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/billing/payments", () => ({ listPayments, recordPayment }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET, POST } = await import("@/app/api/payments/route");

const KEY = "3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f";
const PATIENT = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const auth = { authorization: "Bearer tok" };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const typed = {
  patientId: PATIENT,
  kind: "PAYMENT",
  amount: "1,200",
  paidOn: "2026-10-01",
  method: "UPI",
  reference: " UTR 42 ",
  note: "",
};
const get = async (query: string) =>
  answerOf(await GET(apiRequest(`/api/payments${query}`, { method: "GET", headers: auth })));
const post = async (body: unknown, key: string | null = KEY) =>
  answerOf(
    await POST(apiRequest("/api/payments", { body, headers: { ...auth, ...(key && { "Idempotency-Key": key }) } })),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "payments.view", "payments.create"]));
  listPayments.mockResolvedValue({ items: [{ id: "pay-1" }], nextCursor: null });
  recordPayment.mockResolvedValue({ paymentId: "pay-1", balancePaise: 0 });
});

describe("GET /api/payments (plan §15.4; D320)", () => {
  it("reads a page of the days asked, for payments.view — a view-only clinic too", async () => {
    const session = member(["patients.view", "payments.view"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await get("?from=2026-10-01&to=2026-10-19&cursor=20")).toMatchObject({
      status: 200,
      body: { data: { items: [{ id: "pay-1" }] } },
    });
    expect(listPayments).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), {
      from: "2026-10-01",
      to: "2026-10-19",
      cursor: 20,
    });
  });

  it("refuses days it cannot read, and someone who does not read payments", async () => {
    expect((await get("?from=2026-10-19&to=2026-10-01")).status).toBe(400);
    expect((await get("?from=2026-10-01")).status).toBe(400);
    getSession.mockResolvedValue(member(["patients.view", "payments.create"]));
    expect((await get("?from=2026-10-01&to=2026-10-01")).status).toBe(403);
    expect(listPayments).not.toHaveBeenCalled();
  });
});

describe("POST /api/payments (plan §15.3)", () => {
  it("records the payment as parsed, once per key, for payments.create, and answers 201", async () => {
    expect(await post(typed)).toMatchObject({ status: 201, body: { data: { paymentId: "pay-1" } } });
    expect(recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      {
        patientId: PATIENT,
        kind: "PAYMENT",
        amountPaise: 120_000,
        paidOn: "2026-10-01",
        method: "UPI",
        reference: "UTR 42",
        note: null,
      },
      KEY,
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a payment it cannot read, one without its key, someone who may not record, and a view-only clinic", async () => {
    expect((await post({ ...typed, amount: "0" })).status).toBe(400);
    expect(await post(typed, null)).toMatchObject({
      status: 400,
      body: { error: { code: "IDEMPOTENCY_KEY_REQUIRED" } },
    });
    getSession.mockResolvedValue(member(["patients.view", "payments.view"]));
    expect((await post(typed)).status).toBe(403);
    const session = member(["patients.view", "payments.create"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post(typed)).toMatchObject({ status: 422, body: { error: { code: "CLINIC_PLAN_EXPIRED" } } });
    expect(recordPayment).not.toHaveBeenCalled();
  });
});
