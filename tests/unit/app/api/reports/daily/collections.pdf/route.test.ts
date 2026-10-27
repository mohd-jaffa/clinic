import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aSession } from "@tests/support/auth";
import { apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getCollectionsPdf } = vi.hoisted(() => ({ getSession: vi.fn(), getCollectionsPdf: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/documents/api", () => ({ getCollectionsPdf }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET } = await import("@/app/api/reports/daily/collections.pdf/route");

const member = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const get = (query: string) =>
  GET(
    apiRequest(`/api/reports/daily/collections.pdf${query}`, {
      method: "GET",
      headers: { authorization: "Bearer tok" },
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: new Date("2026-10-27T06:00:00Z"), toFake: ["Date"] });
  getSession.mockResolvedValue(member(["reports.view"]));
  getCollectionsPdf.mockResolvedValue(new Response("%PDF", { headers: { "Content-Type": "application/pdf" } }));
});
afterEach(() => vi.useRealTimers());

describe("GET /api/reports/daily/collections.pdf (plan §18; D359)", () => {
  it("answers the day's collections as a PDF, for reports.view, to open or to save", async () => {
    const answer = await get("?day=2026-10-27&download=1");
    expect(answer.headers.get("Content-Type")).toBe("application/pdf");
    expect(getCollectionsPdf).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), {
      day: "2026-10-27",
      download: true,
      requestId: expect.stringMatching(/^req_/),
    });
  });

  it("refuses a day after today, and someone without reports.view", async () => {
    expect((await get("?day=2026-10-28")).status).toBe(400);
    getSession.mockResolvedValue(member(["payments.view"]));
    expect((await get("?day=2026-10-27")).status).toBe(403);
    expect(getCollectionsPdf).not.toHaveBeenCalled();
  });
});
