import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listTeam } = vi.hoisted(() => ({ getSession: vi.fn(), listTeam: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/team/api", () => ({ listTeam }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/team/route");

const get = () => GET(apiRequest("/api/team", { method: "GET", headers: { authorization: "Bearer tok" } }));

beforeEach(() => {
  vi.clearAllMocks();
  listTeam.mockResolvedValue([{ id: "m-1" }]);
});

describe("GET /api/team (plan §8.6)", () => {
  it("answers team.manage with the team, read as them; anyone else is refused", async () => {
    const session = aSession();
    getSession.mockResolvedValue({ ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } });
    expect(await answerOf(await get())).toMatchObject({ status: 200, body: { data: [{ id: "m-1" }] } });
    expect(listTeam).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1", supabase: "anon-client" }));

    getSession.mockResolvedValue({
      ...session,
      membership: { ...session.membership!, role: "STAFF", permissions: ["patients.view"] },
    });
    expect(await answerOf(await get())).toMatchObject({ status: 403 });
  });
});
