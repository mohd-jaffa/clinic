import { beforeEach, describe, expect, it, vi } from "vitest";

import { aDeveloperSession, aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getConsoleSettings, updatePlatformSettings } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConsoleSettings: vi.fn(),
  updatePlatformSettings: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/admin/api", () => ({ getConsoleSettings }));
vi.mock("@/lib/platform/settings", () => ({ updatePlatformSettings }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET, PATCH } = await import("@/app/api/admin/settings/route");

const auth = { authorization: "Bearer tok" };
const get = async () => answerOf(await GET(apiRequest("/api/admin/settings", { method: "GET", headers: auth })));
const patch = async (body: unknown) =>
  answerOf(await PATCH(apiRequest("/api/admin/settings", { method: "PATCH", body, headers: auth })));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(aDeveloperSession());
  getConsoleSettings.mockResolvedValue({ read: true });
  updatePlatformSettings.mockResolvedValue({ trialDays: 45 });
});

describe("GET /api/admin/settings (plan §20.4)", () => {
  it("reads the settings as the server", async () => {
    expect(await get()).toMatchObject({ status: 200, body: { data: { read: true } } });
    expect(getConsoleSettings).toHaveBeenCalledWith("service-client");
  });
});

describe("PATCH /api/admin/settings (plan §6; D378)", () => {
  it("saves what was sent, as parsed, with the DEV's own client", async () => {
    expect(await patch({ trialDays: "45", renewalContactPhone: "98450 12345" })).toMatchObject({
      status: 200,
      body: { data: { trialDays: 45 } },
    });
    expect(updatePlatformSettings).toHaveBeenCalledWith(
      "anon-client",
      { trialDays: 45, renewalContactPhone: "+919845012345" },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a setting out of its bounds", async () => {
    expect((await patch({ graceDays: "61" })).status).toBe(400);
    expect(updatePlatformSettings).not.toHaveBeenCalled();
  });

  it("refuses everyone but the platform admin, a clinic's owner included", async () => {
    getSession.mockResolvedValue(aSession());
    expect((await get()).status).toBe(403);
    expect((await patch({ trialDays: "45" })).status).toBe(403);
    expect(getConsoleSettings).not.toHaveBeenCalled();
    expect(updatePlatformSettings).not.toHaveBeenCalled();
  });
});
