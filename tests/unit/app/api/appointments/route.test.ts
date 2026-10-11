import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, bookAppointment, listAppointments } = vi.hoisted(() => ({
  getSession: vi.fn(),
  bookAppointment: vi.fn(),
  listAppointments: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/appointments/api", () => ({ bookAppointment, listAppointments }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET, POST } = await import("@/app/api/appointments/route");

const KEY = "3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f";
const PATIENT = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const DOCTOR = "8c2f5b63-4d6e-4f70-9bac-1d2e3f4a5b6c";
const TYPE = "9d306c74-5e7f-4081-8cbd-2e3f4a5b6c7d";
const staff = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const typed = {
  patient: { mode: "FOUND", id: PATIENT },
  doctorId: DOCTOR,
  date: "2026-10-13",
  time: { hour: "10", minute: "30" },
  typeId: TYPE,
  length: { choice: "15", other: "" },
  notes: "",
};
const post = (body: unknown, key: string | null = KEY) =>
  POST(
    apiRequest("/api/appointments", {
      method: "POST",
      body,
      headers: { authorization: "Bearer tok", ...(key && { "Idempotency-Key": key }) },
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  // Now, in Kochi: 11 October 2026, 2:00 PM.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T08:30:00Z"));
  const session = aSession();
  getSession.mockResolvedValue({ ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } });
  bookAppointment.mockResolvedValue({ id: "a-1" });
});
afterEach(() => vi.useRealTimers());

describe("POST /api/appointments (plan §11.1)", () => {
  it("books it as parsed, once per key, and answers 201", async () => {
    const { status, body } = await answerOf(await post(typed));
    expect({ status, body }).toMatchObject({ status: 201, body: { data: { id: "a-1" } } });
    expect(bookAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1", supabase: "anon-client" }),
      {
        patient: { mode: "FOUND", id: PATIENT },
        doctorId: DOCTOR,
        typeId: TYPE,
        scheduledAt: "2026-10-13T05:00:00.000Z",
        minutes: 15,
        notes: null,
      },
      KEY,
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a member without appointments.create, a booking without its key, and one not right", async () => {
    getSession.mockResolvedValue(staff(["patients.view", "appointments.view"]));
    expect(await answerOf(await post(typed))).toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_PERMISSION_DENIED" } },
    });

    getSession.mockResolvedValue(staff(["patients.view", "appointments.create"]));
    expect(await answerOf(await post(typed, null))).toMatchObject({
      status: 400,
      body: { error: { code: "IDEMPOTENCY_KEY_REQUIRED" } },
    });
    expect(await answerOf(await post({ ...typed, date: "2026-10-10" }))).toMatchObject({
      status: 400,
      body: { error: { code: "VALIDATION_ERROR" } },
    });
    expect(bookAppointment).not.toHaveBeenCalled();
  });
});

describe("GET /api/appointments (plan §11.5)", () => {
  const get = (query: string) =>
    GET(apiRequest(`/api/appointments?${query}`, { method: "GET", headers: { authorization: "Bearer tok" } }));

  it("answers appointments.view with the days asked, every doctor's while none is named", async () => {
    listAppointments.mockResolvedValue([{ id: "a-1" }]);
    const { status, body } = await answerOf(await get("from=2026-10-13&to=2026-10-13"));
    expect({ status, body }).toMatchObject({ status: 200, body: { data: [{ id: "a-1" }] } });
    expect(listAppointments).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), {
      from: "2026-10-13",
      to: "2026-10-13",
    });
  });

  it("refuses a member without appointments.view, and days past a week", async () => {
    getSession.mockResolvedValue(staff(["patients.view", "appointments.create"]));
    expect(await answerOf(await get("from=2026-10-13&to=2026-10-13"))).toMatchObject({ status: 403 });
    getSession.mockResolvedValue(staff(["patients.view", "appointments.view"]));
    expect(await answerOf(await get("from=2026-10-01&to=2026-10-13"))).toMatchObject({ status: 400 });
    expect(listAppointments).not.toHaveBeenCalled();
  });
});
