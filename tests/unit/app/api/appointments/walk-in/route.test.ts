import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, addWalkIn } = vi.hoisted(() => ({ getSession: vi.fn(), addWalkIn: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/appointments/api", () => ({ addWalkIn }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/appointments/walk-in/route");

const KEY = "3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f";
const PATIENT = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const DOCTOR = "8c2f5b63-4d6e-4f70-9bac-1d2e3f4a5b6c";
const TYPE = "9d306c74-5e7f-4081-8cbd-2e3f4a5b6c7d";
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const typed = { patient: { mode: "FOUND", id: PATIENT }, doctorId: DOCTOR, typeId: TYPE };
const post = async (body: unknown, key: string | null = KEY) =>
  answerOf(
    await POST(
      apiRequest("/api/appointments/walk-in", {
        method: "POST",
        body,
        headers: { authorization: "Bearer tok", ...(key && { "Idempotency-Key": key }) },
      }),
    ),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "appointments.create"]));
  addWalkIn.mockResolvedValue({ id: "a-7", token: 7 });
});

describe("POST /api/appointments/walk-in (plan §11.3, D171)", () => {
  it("adds the walk-in as parsed, once per key, and answers 201 with its token", async () => {
    expect(await post(typed)).toMatchObject({ status: 201, body: { data: { token: 7 } } });
    expect(addWalkIn).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      { patient: { mode: "FOUND", id: PATIENT }, doctorId: DOCTOR, typeId: TYPE },
      KEY,
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses one with no key, a doctor not chosen, someone who may not add, and a view-only clinic", async () => {
    expect(await post(typed, null)).toMatchObject({
      status: 400,
      body: { error: { code: "IDEMPOTENCY_KEY_REQUIRED" } },
    });
    expect((await post({ ...typed, doctorId: "" })).status).toBe(400);
    getSession.mockResolvedValue(member(["patients.view", "appointments.view"]));
    expect((await post(typed)).status).toBe(403);
    const session = member(["appointments.create"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post(typed)).toMatchObject({ status: 422, body: { error: { code: "CLINIC_PLAN_EXPIRED" } } });
    expect(addWalkIn).not.toHaveBeenCalled();
  });
});
