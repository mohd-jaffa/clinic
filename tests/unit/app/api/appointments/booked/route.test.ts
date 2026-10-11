import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listBookedTimes } = vi.hoisted(() => ({ getSession: vi.fn(), listBookedTimes: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/appointments/api", () => ({ listBookedTimes }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/appointments/booked/route");

const DOCTOR = "8c2f5b63-4d6e-4f70-9bac-1d2e3f4a5b6c";
const staff = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = (query: string) =>
  GET(apiRequest(`/api/appointments/booked?${query}`, { method: "GET", headers: { authorization: "Bearer tok" } }));

beforeEach(() => {
  vi.clearAllMocks();
  const session = aSession();
  getSession.mockResolvedValue({ ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } });
  listBookedTimes.mockResolvedValue([{ startsAt: "s", endsAt: "e" }]);
});

describe("GET /api/appointments/booked (D147)", () => {
  it("answers whoever books with the doctor's taken times that day", async () => {
    const { status, body } = await answerOf(await get(`doctorId=${DOCTOR}&date=2026-10-13`));
    expect({ status, body }).toMatchObject({ status: 200, body: { data: [{ startsAt: "s", endsAt: "e" }] } });
    expect(listBookedTimes).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), {
      doctorId: DOCTOR,
      date: "2026-10-13",
    });
  });

  it("refuses a member who does not book, and a day that is not one", async () => {
    getSession.mockResolvedValue(staff(["patients.view", "appointments.view"]));
    expect(await answerOf(await get(`doctorId=${DOCTOR}&date=2026-10-13`))).toMatchObject({ status: 403 });
    getSession.mockResolvedValue(staff(["patients.view", "appointments.create"]));
    expect(await answerOf(await get(`doctorId=${DOCTOR}&date=2026-02-30`))).toMatchObject({ status: 400 });
    expect(listBookedTimes).not.toHaveBeenCalled();
  });
});
