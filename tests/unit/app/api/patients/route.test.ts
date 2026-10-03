import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, createPatient } = vi.hoisted(() => ({ getSession: vi.fn(), createPatient: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/patients/api", () => ({ createPatient }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/patients/route");

const KEY = "3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f";
const staff = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const typed = { fullName: "Rohan Mehta", phone: "98765 43210", born: { as: "AGE", years: "34" }, gender: "MALE" };
const post = (body: unknown, key: string | null = KEY) =>
  POST(
    apiRequest("/api/patients", {
      method: "POST",
      body,
      headers: { authorization: "Bearer tok", ...(key && { "Idempotency-Key": key }) },
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T06:00:00Z"));
  const session = aSession();
  getSession.mockResolvedValue({ ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } });
  createPatient.mockResolvedValue({ id: "p-1", number: 1012 });
});
afterEach(() => vi.useRealTimers());

describe("POST /api/patients (plan §10.1)", () => {
  it("adds the patient as parsed, once per key, and answers 201", async () => {
    expect(await answerOf(await post(typed))).toMatchObject({ status: 201, body: { data: { id: "p-1" } } });
    expect(createPatient).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1", supabase: "anon-client" }),
      expect.objectContaining({
        fullName: "Rohan Mehta",
        phone: "+919876543210",
        born: { dateOfBirth: "1992-10-03", dobIsEstimated: true },
        assignedDoctorId: null,
      }),
      KEY,
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses an add without its key, one that is not right, and someone who may not add", async () => {
    expect(await answerOf(await post(typed, null))).toMatchObject({
      status: 400,
      body: { error: { code: "IDEMPOTENCY_KEY_REQUIRED" } },
    });
    expect(await answerOf(await post({ ...typed, gender: "" }))).toMatchObject({
      status: 400,
      body: { error: { code: "VALIDATION_ERROR" } },
    });
    getSession.mockResolvedValue(staff(["patients.view"]));
    expect(await answerOf(await post(typed))).toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_PERMISSION_DENIED" } },
    });
    expect(createPatient).not.toHaveBeenCalled();
  });
});
