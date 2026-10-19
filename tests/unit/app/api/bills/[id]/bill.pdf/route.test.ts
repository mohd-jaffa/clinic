// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getBillPdf } = vi.hoisted(() => ({ getSession: vi.fn(), getBillPdf: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/documents/api", () => ({ getBillPdf }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/bills/[id]/bill.pdf/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "b-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = (query = "") =>
  GET(apiRequest(`/api/bills/b-1/bill.pdf${query}`, { method: "GET", headers: auth }), params);

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "payments.view"]));
  getBillPdf.mockImplementation(async () => new Response("%PDF", { headers: { "Content-Type": "application/pdf" } }));
});

describe("GET /api/bills/[id]/bill.pdf (plan §15.5)", () => {
  it("answers whoever reads bills with the PDF itself, to open — or to save", async () => {
    const answer = await get();
    expect(answer.status).toBe(200);
    expect(await answer.text()).toBe("%PDF");
    expect(getBillPdf).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), "b-1", {
      download: false,
      requestId: expect.stringMatching(/^req_/),
    });
    await get("?download=1");
    expect(getBillPdf).toHaveBeenLastCalledWith(expect.anything(), "b-1", {
      download: true,
      requestId: expect.stringMatching(/^req_/),
    });
  });

  it("refuses someone who may not read bills — a view-only clinic still prints", async () => {
    getSession.mockResolvedValue(member(["patients.view", "payments.create"]));
    expect((await get()).status).toBe(403);
    const session = member(["patients.view", "payments.view"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect((await get()).status).toBe(200);
  });
});
