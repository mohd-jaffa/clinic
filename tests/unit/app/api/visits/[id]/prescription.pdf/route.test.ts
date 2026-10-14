// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { notFoundError } from "@/lib/errors";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getPrescriptionPdf } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getPrescriptionPdf: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/documents/api", () => ({ getPrescriptionPdf }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/visits/[id]/prescription.pdf/route");

const auth = { authorization: "Bearer tok" };
const params = { params: Promise.resolve({ id: "v-1" }) };
const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = (query = "") =>
  GET(apiRequest(`/api/visits/v-1/prescription.pdf${query}`, { method: "GET", headers: auth }), params);
const PDF = () => new Response("%PDF", { headers: { "Content-Type": "application/pdf" } });

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(member(["patients.view", "visits.view"]));
  getPrescriptionPdf.mockImplementation(async () => PDF());
});

describe("GET /api/visits/[id]/prescription.pdf (D221)", () => {
  it("answers whoever reads visits with the PDF itself, to open — or to save", async () => {
    const answer = await get();
    expect(answer.status).toBe(200);
    expect(answer.headers.get("Content-Type")).toBe("application/pdf");
    expect(await answer.text()).toBe("%PDF");
    expect(getPrescriptionPdf).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), "v-1", {
      download: false,
      requestId: expect.stringMatching(/^req_/),
    });

    await get("?download=1");
    expect(getPrescriptionPdf).toHaveBeenLastCalledWith(expect.anything(), "v-1", {
      download: true,
      requestId: expect.stringMatching(/^req_/),
    });
  });

  it("prints in a view-only clinic too: it is reading", async () => {
    const session = member(["visits.view"]);
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect((await get()).status).toBe(200);
  });

  it("refuses what it cannot read, someone who may not read visits, and answers a refusal in the envelope", async () => {
    expect((await answerOf(await get("?download=yes"))).status).toBe(400);
    expect(getPrescriptionPdf).not.toHaveBeenCalled();

    getSession.mockResolvedValue(member(["patients.view", "appointments.view"]));
    expect((await answerOf(await get())).status).toBe(403);
    expect(getPrescriptionPdf).not.toHaveBeenCalled();

    getSession.mockResolvedValue(member(["visits.view"]));
    getPrescriptionPdf.mockRejectedValue(notFoundError("PRESCRIPTION_EMPTY"));
    expect(await answerOf(await get())).toMatchObject({ status: 404, body: { error: { code: "PRESCRIPTION_EMPTY" } } });
  });
});
