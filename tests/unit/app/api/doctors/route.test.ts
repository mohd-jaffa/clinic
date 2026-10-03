import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listDoctors } = vi.hoisted(() => ({ getSession: vi.fn(), listDoctors: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/team/api", () => ({ listDoctors }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/doctors/route");

beforeEach(() => {
  vi.clearAllMocks();
  listDoctors.mockResolvedValue([{ id: "d-1", name: "Asha Menon" }]);
});

describe("GET /api/doctors", () => {
  it("answers any member with the clinic's active doctors, read as them", async () => {
    const session = aSession();
    getSession.mockResolvedValue({
      ...session,
      membership: { ...session.membership!, role: "STAFF", permissions: [] },
    });
    const { status, body } = await answerOf(
      await GET(apiRequest("/api/doctors", { method: "GET", headers: { authorization: "Bearer tok" } })),
    );
    expect({ status, body }).toMatchObject({ status: 200, body: { data: [{ id: "d-1", name: "Asha Menon" }] } });
    expect(listDoctors).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1", supabase: "anon-client" }),
    );
  });
});
