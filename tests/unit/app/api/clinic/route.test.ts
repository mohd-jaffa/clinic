import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getClinic, updateClinic } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getClinic: vi.fn(),
  updateClinic: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/clinic/api", () => ({ getClinic, updateClinic }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET, PATCH } = await import("@/app/api/clinic/route");

const auth = { authorization: "Bearer tok" };
const staff = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};

/** The owner, as the session reads them: every permission (plan §8.2). */
const owner = () => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } };
};

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(owner());
  getClinic.mockResolvedValue({ name: "Smile Care" });
  updateClinic.mockResolvedValue({ name: "Smile Care", paperSize: "A5" });
});

describe("GET /api/clinic", () => {
  it("answers any member with their own clinic, read as them", async () => {
    getSession.mockResolvedValue(staff([]));
    const { status, body } = await answerOf(await GET(apiRequest("/api/clinic", { method: "GET", headers: auth })));
    expect({ status, body }).toMatchObject({ status: 200, body: { data: { name: "Smile Care" } } });
    expect(getClinic).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1", supabase: "anon-client" }));
  });
});

describe("PATCH /api/clinic (D78)", () => {
  it("changes the clinic for settings.manage, the body tidied first", async () => {
    const { status } = await answerOf(
      await PATCH(apiRequest("/api/clinic", { method: "PATCH", body: { paperSize: "A5" }, headers: auth })),
    );
    expect(status).toBe(200);
    expect(updateClinic).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      { paperSize: "A5" },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a member without settings.manage, and a body it does not know", async () => {
    getSession.mockResolvedValue(staff(["patients.view"]));
    const refused = await answerOf(
      await PATCH(apiRequest("/api/clinic", { method: "PATCH", body: { paperSize: "A5" }, headers: auth })),
    );
    expect(refused).toMatchObject({ status: 403, body: { error: { code: "AUTH_PERMISSION_DENIED" } } });

    getSession.mockResolvedValue(owner());
    const invalid = await answerOf(
      await PATCH(apiRequest("/api/clinic", { method: "PATCH", body: { paperSize: "A3" }, headers: auth })),
    );
    expect(invalid).toMatchObject({ status: 400, body: { error: { code: "VALIDATION_ERROR" } } });
    expect(updateClinic).not.toHaveBeenCalled();
  });
});
