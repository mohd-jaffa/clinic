import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listClosureAppointments } = vi.hoisted(() => ({
  getSession: vi.fn(),
  listClosureAppointments: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/clinic/closures", () => ({ listClosureAppointments }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/closures/appointments/route");

const auth = { authorization: "Bearer tok" };
const staff = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const owner = () => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } };
};
const get = (query: string) => GET(apiRequest(`/api/closures/appointments?${query}`, { method: "GET", headers: auth }));

beforeEach(() => {
  vi.clearAllMocks();
  // Today, in Kochi: 3 October 2026.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T06:00:00Z"));
  getSession.mockResolvedValue(owner());
  listClosureAppointments.mockResolvedValue({ total: 0, appointments: [] });
});
afterEach(() => vi.useRealTimers());

describe("GET /api/closures/appointments (D137)", () => {
  it("answers settings.manage with the appointments on those days, the whole clinic as no doctor", async () => {
    const { status, body } = await answerOf(await get("who=CLINIC&startsOn=2026-10-20&endsOn=2026-10-22"));
    expect({ status, body }).toMatchObject({ status: 200, body: { data: { total: 0, appointments: [] } } });
    expect(listClosureAppointments).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1", supabase: "anon-client" }),
      { doctorId: null, startsOn: "2026-10-20", endsOn: "2026-10-22" },
    );
  });

  it("refuses a member without settings.manage, and days a closure could not have", async () => {
    getSession.mockResolvedValue(staff(["appointments.view", "patients.view"]));
    expect(await answerOf(await get("who=CLINIC&startsOn=2026-10-20&endsOn=2026-10-20"))).toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_PERMISSION_DENIED" } },
    });

    getSession.mockResolvedValue(owner());
    expect(await answerOf(await get("who=CLINIC&startsOn=2026-10-01&endsOn=2026-10-02"))).toMatchObject({
      status: 400,
      body: { error: { code: "VALIDATION_ERROR" } },
    });
    expect(listClosureAppointments).not.toHaveBeenCalled();
  });
});
