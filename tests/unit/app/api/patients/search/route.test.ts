import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listPatients } = vi.hoisted(() => ({ getSession: vi.fn(), listPatients: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/patients/api", () => ({ listPatients }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { POST } = await import("@/app/api/patients/search/route");

const member = (permissions: string[], state: "ACTIVE" | "READ_ONLY" = "ACTIVE") => {
  const session = aSession();
  return {
    ...session,
    membership: { ...session.membership!, role: "STAFF", permissions },
    subscription: { ...session.subscription!, state },
  };
};
const post = (body: unknown) =>
  POST(apiRequest("/api/patients/search", { method: "POST", body, headers: { authorization: "Bearer tok" } }));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view"]));
  listPatients.mockResolvedValue({ items: [{ id: "p-1", name: "Rohan Mehta" }], nextCursor: null });
});

describe("POST /api/patients/search (plan §10.2, D98)", () => {
  it("answers a page of the list for what is searched in the body", async () => {
    expect(await answerOf(await post({ search: " Rohan ", tab: "ALL", cursor: "20" }))).toMatchObject({
      status: 200,
      body: { data: { items: [{ id: "p-1" }], nextCursor: null } },
    });
    expect(listPatients).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), {
      search: "Rohan",
      tab: "ALL",
      cursor: 20,
    });
  });

  it("is a read, so a view-only clinic still asks it", async () => {
    getSession.mockResolvedValue(member(["patients.view"], "READ_ONLY"));
    expect((await answerOf(await post({}))).status).toBe(200);
  });

  it("refuses a tab it does not know, and someone who may not see patients", async () => {
    expect(await answerOf(await post({ tab: "DUE" }))).toMatchObject({ status: 400 });
    getSession.mockResolvedValue(member(["expenses.view"]));
    expect(await answerOf(await post({}))).toMatchObject({ status: 403 });
    expect(listPatients).not.toHaveBeenCalled();
  });
});
