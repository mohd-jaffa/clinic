import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listClosures, addClosure } = vi.hoisted(() => ({
  getSession: vi.fn(),
  listClosures: vi.fn(),
  addClosure: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/clinic/closures", () => ({ listClosures, addClosure }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET, POST } = await import("@/app/api/closures/route");

const auth = { authorization: "Bearer tok" };
const staff = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const owner = () => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } };
};
const post = (body: unknown) => POST(apiRequest("/api/closures", { method: "POST", body, headers: auth }));

beforeEach(() => {
  vi.clearAllMocks();
  // Today, in Kochi: 3 October 2026.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T06:00:00Z"));
  getSession.mockResolvedValue(owner());
  listClosures.mockResolvedValue([{ id: "c-1", reason: "Diwali" }]);
  addClosure.mockResolvedValue({ id: "c-2", reason: "Diwali" });
});
afterEach(() => vi.useRealTimers());

describe("GET /api/closures", () => {
  it("answers any member with the clinic's holidays and leave, read as them", async () => {
    getSession.mockResolvedValue(staff([]));
    const { status, body } = await answerOf(await GET(apiRequest("/api/closures", { method: "GET", headers: auth })));
    expect({ status, body }).toMatchObject({ status: 200, body: { data: [{ id: "c-1" }] } });
    expect(listClosures).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1", supabase: "anon-client" }),
    );
  });
});

describe("POST /api/closures (D85)", () => {
  it("adds one for settings.manage, the whole clinic as no doctor, and answers 201", async () => {
    const { status, body } = await answerOf(
      await post({ who: "CLINIC", startsOn: "2026-10-20", endsOn: "2026-10-22", reason: " Diwali " }),
    );
    expect({ status, body }).toMatchObject({ status: 201, body: { data: { id: "c-2" } } });
    expect(addClosure).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      { doctorId: null, startsOn: "2026-10-20", endsOn: "2026-10-22", reason: "Diwali" },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a member without settings.manage, and days that are not right", async () => {
    getSession.mockResolvedValue(staff(["patients.view"]));
    expect(
      await answerOf(await post({ who: "CLINIC", startsOn: "2026-10-20", endsOn: "2026-10-20", reason: "Diwali" })),
    ).toMatchObject({ status: 403, body: { error: { code: "AUTH_PERMISSION_DENIED" } } });

    getSession.mockResolvedValue(owner());
    expect(
      await answerOf(await post({ who: "CLINIC", startsOn: "2026-10-01", endsOn: "2026-10-04", reason: "Puja" })),
    ).toMatchObject({ status: 400, body: { error: { code: "VALIDATION_ERROR" } } });
    expect(addClosure).not.toHaveBeenCalled();
  });
});
