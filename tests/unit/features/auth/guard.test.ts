import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCESS_TOKEN_COOKIE } from "@/features/auth/cookies";
import { aDeveloperSession, aSession } from "@tests/support/auth";
import { answerOf, supabaseClients } from "@tests/support/routes";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAnonClient: (token?: string) => `anon-client:${token}`,
  createSupabaseServiceRoleClient: supabaseClients.createSupabaseServiceRoleClient,
}));

const { bearerToken, isWrite, readAccessToken, withAccountRoute, withClinicRoute, withDevRoute } =
  await import("@/features/auth/guard");

const request = (method = "GET", headers: Record<string, string> = { authorization: "Bearer tok" }) =>
  new Request("http://localhost/api/thing", { method, headers });

const readOnly = aSession({
  subscription: { plan: "TRIAL", validUntil: "2026-01-01", state: "READ_ONLY", readOnlyFrom: "2026-01-09" },
});
const staff = aSession({
  membership: { ...aSession().membership!, role: "STAFF", permissions: ["patients.view"], doctorId: null },
});

beforeEach(() => {
  getSession.mockReset();
  getSession.mockResolvedValue(aSession());
});

describe("reading the token", () => {
  it("takes a bearer header, or else the session cookie", () => {
    expect(bearerToken(new Headers({ authorization: "Bearer abc" }))).toBe("abc");
    expect(bearerToken(new Headers({ authorization: "bearer abc" }))).toBe("abc");
    expect(readAccessToken(request("GET", { cookie: `${ACCESS_TOKEN_COOKIE}=xyz` }))).toBe("xyz");
  });

  it("ignores any other kind of authorization, and refuses a request with neither", () => {
    expect(bearerToken(new Headers({ authorization: "Basic abc" }))).toBeNull();
    expect(bearerToken(new Headers({ authorization: "Bearer" }))).toBeNull();
    expect(bearerToken(new Headers())).toBeNull();
    expect(() => readAccessToken(request("GET", {}))).toThrow(
      expect.objectContaining({ code: "AUTH_SESSION_REQUIRED" }),
    );
  });
});

describe("isWrite", () => {
  it("counts anything but a read as a write", () => {
    expect(["GET", "head", "OPTIONS"].map(isWrite)).toEqual([false, false, false]);
    expect(["POST", "PATCH", "PUT", "DELETE"].map(isWrite)).toEqual([true, true, true, true]);
  });
});

describe("withClinicRoute", () => {
  it("builds the tenant from the session, with a client that carries the caller's token", async () => {
    const { body } = await answerOf(
      await withClinicRoute(request(), { access: "MEMBER" }, async (tenant) => ({
        supabase: tenant.supabase,
        clinicId: tenant.clinicId,
        actorId: tenant.actorId,
        memberId: tenant.memberId,
        role: tenant.role,
        doctorId: tenant.doctorId,
      })),
    );
    expect(body.data).toEqual({
      supabase: "anon-client:access-token",
      clinicId: "clinic-1",
      actorId: "user-1",
      memberId: "member-1",
      role: "OWNER",
      doctorId: "doctor-1",
    });
  });

  it("answers with the status the route names", async () => {
    const response = await withClinicRoute(request("POST"), { access: "MEMBER", successStatus: 201 }, async () => ({}));
    expect(response.status).toBe(201);
  });

  it("refuses a permission the member does not hold, and the platform admin", async () => {
    getSession.mockResolvedValue(staff);
    const refused = await withClinicRoute(request(), { access: "payments.view" }, async () => ({}));
    await expect(answerOf(refused)).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_PERMISSION_DENIED" } },
    });

    getSession.mockResolvedValue(aDeveloperSession());
    expect((await withClinicRoute(request(), { access: "MEMBER" }, async () => ({}))).status).toBe(403);
  });

  it("refuses a write while the clinic is view-only, but not a read, nor a write the route allows", async () => {
    getSession.mockResolvedValue(readOnly);
    const write = await withClinicRoute(request("POST"), { access: "MEMBER" }, async () => ({}));
    await expect(answerOf(write)).resolves.toMatchObject({
      status: 422,
      body: { error: { code: "CLINIC_PLAN_EXPIRED" } },
    });
    expect((await withClinicRoute(request("GET"), { access: "MEMBER" }, async () => ({}))).status).toBe(200);
    expect(
      (await withClinicRoute(request("POST"), { access: "OWNER", allowReadOnly: true }, async () => ({}))).status,
    ).toBe(200);
  });
});

describe("withAccountRoute", () => {
  it("hands the route the session, the caller's client and the server's", async () => {
    const { body } = await answerOf(
      await withAccountRoute(request("PATCH"), {}, async ({ session, supabase, admin }) => ({
        user: session.profile.id,
        supabase,
        admin,
      })),
    );
    expect(body.data).toEqual({ user: "user-1", supabase: "anon-client:access-token", admin: "service-client" });
  });

  it("refuses a member's write while their clinic is view-only, unless allowed; the platform admin is never view-only", async () => {
    getSession.mockResolvedValue(readOnly);
    expect((await withAccountRoute(request("PATCH"), {}, async () => ({}))).status).toBe(422);
    expect((await withAccountRoute(request("POST"), { allowReadOnly: true }, async () => ({}))).status).toBe(200);
    getSession.mockResolvedValue(aDeveloperSession());
    expect((await withAccountRoute(request("PATCH"), {}, async () => ({}))).status).toBe(200);
  });
});

describe("withDevRoute", () => {
  it("lets the platform admin through, with their own client and the server's", async () => {
    getSession.mockResolvedValue(aDeveloperSession());
    const { status, body } = await answerOf(
      await withDevRoute(request(), async ({ session, supabase, admin }) => ({
        role: session.profile.platformRole,
        supabase,
        admin,
      })),
    );
    expect(status).toBe(200);
    expect(body.data).toEqual({ role: "DEV", supabase: "anon-client:access-token", admin: "service-client" });
  });

  it("refuses everyone else, the clinic owner included", async () => {
    const refused = await withDevRoute(request(), async () => ({}));
    await expect(answerOf(refused)).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_PERMISSION_DENIED" } },
    });
  });

  it("asks for a session first", async () => {
    expect((await withDevRoute(request("GET", {}), async () => ({}))).status).toBe(401);
  });
});
