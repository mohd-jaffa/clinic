import { beforeEach, describe, expect, it, vi } from "vitest";

import { todayKey } from "@/lib/dates/calendar";
import { aDeveloperSession, aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, extendPlan } = vi.hoisted(() => ({ getSession: vi.fn(), extendPlan: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/admin/extend", () => ({ extendPlan }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/admin/clinics/[id]/extend/route");

const KEY = "3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f";
const typed = {
  kind: "MONTHLY",
  amount: "300",
  paidOn: todayKey(),
  method: "UPI",
  reference: "UPI-4821",
  validUntil: "",
  reason: "",
};
const post = async (body: unknown, key: string | null = KEY) =>
  answerOf(
    await POST(
      apiRequest("/api/admin/clinics/c-1/extend", {
        body,
        headers: { authorization: "Bearer tok", ...(key && { "Idempotency-Key": key }) },
      }),
      { params: Promise.resolve({ id: "c-1" }) },
    ),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(aDeveloperSession());
  extendPlan.mockResolvedValue({ emailSent: true });
});

describe("POST /api/admin/clinics/c-1/extend (plan §7.4; D373 – D376)", () => {
  it("extends the plan as parsed, with the DEV's own client, once per key", async () => {
    expect(await post(typed)).toMatchObject({ status: 200, body: { data: { emailSent: true } } });
    expect(extendPlan).toHaveBeenCalledWith(
      "anon-client",
      "c-1",
      {
        kind: "MONTHLY",
        amountPaise: 30_000,
        method: "UPI",
        paidOn: todayKey(),
        reference: "UPI-4821",
        validUntil: null,
        reason: null,
      },
      KEY,
      { requestId: expect.stringMatching(/^req_/), userId: aDeveloperSession().profile.id },
    );
  });

  it("refuses what it cannot read, and a request without its key", async () => {
    expect((await post({ ...typed, amount: "0" })).status).toBe(400);
    expect((await post(typed, null)).status).toBe(400);
    expect(extendPlan).not.toHaveBeenCalled();
  });

  it("refuses everyone but the platform admin, a clinic's owner included", async () => {
    getSession.mockResolvedValue(aSession());
    expect((await post(typed)).status).toBe(403);
    expect(extendPlan).not.toHaveBeenCalled();
  });
});
