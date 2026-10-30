import { beforeEach, describe, expect, it, vi } from "vitest";

import { aDeveloperSession, aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getConsoleReceiptPdf } = vi.hoisted(() => ({ getSession: vi.fn(), getConsoleReceiptPdf: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/documents/api", () => ({ getConsoleReceiptPdf }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/admin/payments/[id]/receipt.pdf/route");

const get = () =>
  GET(apiRequest("/api/admin/payments/sp-1/receipt.pdf", { method: "GET", headers: { authorization: "Bearer tok" } }), {
    params: Promise.resolve({ id: "sp-1" }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  getConsoleReceiptPdf.mockResolvedValue(new Response("%PDF", { headers: { "Content-Type": "application/pdf" } }));
});

describe("GET /api/admin/payments/sp-1/receipt.pdf (D395)", () => {
  it("draws the receipt for the DEV, read as the server", async () => {
    getSession.mockResolvedValue(aDeveloperSession());
    expect((await get()).headers.get("Content-Type")).toBe("application/pdf");
    expect(getConsoleReceiptPdf).toHaveBeenCalledWith("service-client", "sp-1", {
      download: false,
      requestId: expect.stringMatching(/^req_/),
    });
  });

  it("refuses everyone else, a clinic's owner included", async () => {
    getSession.mockResolvedValue(aSession());
    expect((await answerOf(await get())).status).toBe(403);
    expect(getConsoleReceiptPdf).not.toHaveBeenCalled();
  });
});
