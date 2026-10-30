import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getPlanReceiptPdf } = vi.hoisted(() => ({ getSession: vi.fn(), getPlanReceiptPdf: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/documents/api", () => ({ getPlanReceiptPdf }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/subscription/payments/[id]/receipt.pdf/route");

const get = (query = "") =>
  GET(
    apiRequest(`/api/subscription/payments/sp-1/receipt.pdf${query}`, {
      method: "GET",
      headers: { authorization: "Bearer tok" },
    }),
    {
      params: Promise.resolve({ id: "sp-1" }),
    },
  );

beforeEach(() => {
  vi.clearAllMocks();
  getPlanReceiptPdf.mockResolvedValue(new Response("%PDF", { headers: { "Content-Type": "application/pdf" } }));
});

describe("GET /api/subscription/payments/sp-1/receipt.pdf (plan §7.5; D393)", () => {
  it("draws the owner's receipt, named for them — a view-only clinic's too — to open or to save", async () => {
    const session = aSession();
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    const answer = await get("?download=1");
    expect(answer.headers.get("Content-Type")).toBe("application/pdf");
    expect(getPlanReceiptPdf).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      session.profile.fullName,
      "sp-1",
      { download: true, requestId: expect.stringMatching(/^req_/) },
    );
  });

  it("is the owner's alone", async () => {
    const session = aSession();
    getSession.mockResolvedValue({
      ...session,
      membership: { ...session.membership!, role: "STAFF", permissions: [] },
    });
    expect((await answerOf(await get())).status).toBe(403);
    expect(getPlanReceiptPdf).not.toHaveBeenCalled();
  });
});
