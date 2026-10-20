import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, listToBill } = vi.hoisted(() => ({ getSession: vi.fn(), listToBill: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/billing/checkout", () => ({ listToBill }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/to-bill/route");

const DOCTOR = "7b1e4a52-3c5d-4e6f-8a9b-0c1d2e3f4a5b";
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = async (query: string) =>
  answerOf(await GET(apiRequest(`/api/to-bill${query}`, { method: "GET", headers: { authorization: "Bearer tok" } })));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "payments.view"]));
  listToBill.mockResolvedValue({ items: [{ visitId: "v-1" }], nextCursor: null });
});

describe("GET /api/to-bill (plan §15.6; D318)", () => {
  it("reads a page of one doctor's visits to bill, or every doctor's, for payments.view", async () => {
    expect(await get(`?doctorId=${DOCTOR}&cursor=20`)).toMatchObject({
      status: 200,
      body: { data: { items: [{ visitId: "v-1" }] } },
    });
    expect(listToBill).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), {
      doctorId: DOCTOR,
      cursor: 20,
    });
    await get("");
    expect(listToBill).toHaveBeenLastCalledWith(expect.anything(), { doctorId: undefined, cursor: undefined });
  });

  it("refuses a doctor that is not an id, and someone who does not read bills", async () => {
    expect((await get("?doctorId=maya")).status).toBe(400);
    getSession.mockResolvedValue(member(["patients.view", "payments.create"]));
    expect((await get("")).status).toBe(403);
    expect(listToBill).not.toHaveBeenCalled();
  });
});
