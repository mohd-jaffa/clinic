import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { PLATFORM_SETTING_COLUMNS, PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import {
  buildSession,
  confirmEmail,
  getSession,
  loadSessionContext,
  login,
  logout,
  refreshSession,
  toSessionView,
} from "@/features/auth/session";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { logger } from "@/lib/logger";
import { aSession } from "@tests/support/auth";
import { authError, fakeSupabase, postgrestError, type FakeAnswer, type RecordedQuery } from "@tests/support/supabase";

const settingsRow = Object.fromEntries(
  Object.entries(PLATFORM_SETTING_COLUMNS).map(([key, column]) => [
    column,
    PLATFORM_SETTING_DEFAULTS[key as keyof typeof PLATFORM_SETTING_DEFAULTS],
  ]),
);

const membership = {
  id: "member-1",
  clinic_id: "clinic-1",
  role: "OWNER",
  permissions: [],
  job_title: null,
  clinics: { name: "Smile Care", logo_path: "clinics/clinic-1/logo/0b6f5a4e-0c2e-4d8b-9f37-1c2d3e4f5a6b" },
  doctors: [{ id: "doctor-1", active: true }],
};

const profile = {
  id: "user-1",
  full_name: "Asha Menon",
  email: "asha@example.com",
  phone: "+919876543210",
  platform_role: null,
  clinic_members: [membership],
};

/** The server's client, answering with these rows. */
function server(rows: { profile?: FakeAnswer; subscription?: FakeAnswer; auth?: Record<string, unknown> } = {}) {
  const signOut = vi.fn(async () => ({ error: null }));
  const answer = (query: RecordedQuery): FakeAnswer => {
    if (query.table === "profiles") return rows.profile ?? { data: profile };
    if (query.table === "clinic_subscriptions")
      return rows.subscription ?? { data: { plan: "TRIAL", valid_until: addDaysKey(todayKey(), 20) } };
    return { data: settingsRow };
  };
  const fake = fakeSupabase({ answer, auth: { admin: { signOut }, ...rows.auth } });
  return { ...fake, signOut };
}

/** A Supabase session as signing in hands it back. */
const supabaseSession = (confirmed = true) => ({
  access_token: "access-1",
  refresh_token: "refresh-1",
  expires_at: 1_900_000_000,
  user: { id: "user-1", email_confirmed_at: confirmed ? "2026-10-01T00:00:00Z" : null },
});

/** The caller's own client, whose Auth answers as given. */
function caller(auth: Record<string, unknown>) {
  return fakeSupabase({ auth }).client;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("loadSessionContext", () => {
  it("reads the owner's profile, every permission, their doctor profile and the plan's state today", async () => {
    const { client, find } = server();
    const context = await loadSessionContext(client, "user-1");

    expect(context.profile).toEqual({
      id: "user-1",
      fullName: "Asha Menon",
      email: "asha@example.com",
      phone: "+919876543210",
      platformRole: null,
    });
    expect(context.membership).toMatchObject({
      clinicId: "clinic-1",
      clinicName: "Smile Care",
      // The logo, read at an address naming its version (plan §31.1).
      clinicLogoUrl: "/api/clinic/logo?v=0b6f5a4e-0c2e-4d8b-9f37-1c2d3e4f5a6b",
      doctorId: "doctor-1",
    });
    expect(context.membership!.permissions).toEqual([...PERMISSIONS]);
    expect(context.subscription).toMatchObject({ plan: "TRIAL", state: "ACTIVE" });
    // Only the active membership is asked for.
    expect(find("profiles", "eq", "clinic_members.status", "ACTIVE")).toBeDefined();
  });

  it("reads a doctor profile handed back as one row, and none while it is inactive", async () => {
    const staff = { ...membership, role: "STAFF", permissions: ["patients.view"], clinics: null };
    const one = server({
      profile: { data: { ...profile, clinic_members: [{ ...staff, doctors: { id: "d", active: true } }] } },
    });
    expect((await loadSessionContext(one.client, "user-1")).membership).toMatchObject({
      clinicName: "",
      clinicLogoUrl: null,
      doctorId: "d",
      permissions: ["patients.view"],
    });

    const inactive = server({
      profile: { data: { ...profile, clinic_members: [{ ...staff, doctors: { id: "d", active: false } }] } },
    });
    expect((await loadSessionContext(inactive.client, "user-1")).membership!.doctorId).toBeNull();

    const none = server({ profile: { data: { ...profile, clinic_members: [{ ...staff, doctors: [] }] } } });
    expect((await loadSessionContext(none.client, "user-1")).membership!.doctorId).toBeNull();
  });

  it("gives the platform admin no clinic and no plan", async () => {
    const { client, queries } = server({ profile: { data: { ...profile, platform_role: "DEV", clinic_members: [] } } });
    await expect(loadSessionContext(client, "user-1")).resolves.toMatchObject({ membership: null, subscription: null });
    expect(queries.map((query) => query.table)).toEqual(["profiles"]);
  });

  it("refuses someone with no profile, and someone with no active membership", async () => {
    await expect(loadSessionContext(server({ profile: { data: null } }).client, "u")).rejects.toMatchObject({
      code: "AUTH_SESSION_INVALID",
    });
    const deactivated = server({ profile: { data: { ...profile, clinic_members: [] } } });
    await expect(loadSessionContext(deactivated.client, "u")).rejects.toMatchObject({
      code: "AUTH_MEMBERSHIP_INACTIVE",
      httpStatus: 403,
    });
  });

  it("says a database failure as the app's own error", async () => {
    const profileFails = server({ profile: { error: postgrestError("XX000") } });
    await expect(loadSessionContext(profileFails.client, "u")).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    const planFails = server({ subscription: { error: postgrestError("PGRST116") } });
    await expect(loadSessionContext(planFails.client, "u")).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
  });
});

describe("buildSession and toSessionView", () => {
  it("keep the tokens on the server, and hand the browser everything else", () => {
    const { profile: sessionProfile, membership: sessionMembership, subscription } = aSession();
    const context = { profile: sessionProfile, membership: sessionMembership, subscription };
    const session = buildSession({ ...supabaseSession(), expires_at: undefined } as never, context);
    expect(session).toMatchObject({ accessToken: "access-1", refreshToken: "refresh-1", expiresAt: null });
    expect(toSessionView(session)).toEqual(context);
  });
});

describe("login", () => {
  it("signs in and reads the session", async () => {
    const signInWithPassword = vi.fn(async () => ({
      data: { session: supabaseSession(), user: supabaseSession().user },
      error: null,
    }));
    const session = await login(caller({ signInWithPassword }), server().client, {
      phone: "+919876543210",
      password: "p",
    });
    expect(signInWithPassword).toHaveBeenCalledWith({ phone: "+919876543210", password: "p" });
    expect(session).toMatchObject({
      accessToken: "access-1",
      expiresAt: 1_900_000_000,
      membership: { clinicId: "clinic-1" },
    });
  });

  it("answers a wrong email, mobile or password the same", async () => {
    const wrong = vi.fn(async () => ({ data: { session: null, user: null }, error: authError("invalid_credentials") }));
    await expect(
      login(caller({ signInWithPassword: wrong }), server().client, { email: "a@b.co", password: "p" }),
    ).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
      httpStatus: 401,
    });
    const empty = vi.fn(async () => ({ data: { session: null, user: null }, error: null }));
    await expect(
      login(caller({ signInWithPassword: empty }), server().client, { email: "a@b.co", password: "p" }),
    ).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
    });
  });

  it("refuses an email not yet confirmed, whether Supabase or the account says so, and ends what it opened", async () => {
    const refused = vi.fn(async () => ({
      data: { session: null, user: null },
      error: authError("email_not_confirmed"),
    }));
    await expect(
      login(caller({ signInWithPassword: refused }), server().client, { email: "a@b.co", password: "p" }),
    ).rejects.toMatchObject({
      code: "AUTH_EMAIL_NOT_CONFIRMED",
    });

    const opened = vi.fn(async () => ({
      data: { session: supabaseSession(false), user: supabaseSession(false).user },
      error: null,
    }));
    const admin = server();
    await expect(
      login(caller({ signInWithPassword: opened }), admin.client, { email: "a@b.co", password: "p" }),
    ).rejects.toMatchObject({
      code: "AUTH_EMAIL_NOT_CONFIRMED",
    });
    expect(admin.signOut).toHaveBeenCalledWith("access-1", "local");
  });

  it("refuses a deactivated member after a right password, ending the session and logging one that would not end", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const opened = vi.fn(async () => ({
      data: { session: supabaseSession(), user: supabaseSession().user },
      error: null,
    }));
    const admin = server({ profile: { data: { ...profile, clinic_members: [] } } });
    admin.signOut.mockResolvedValue({ error: authError("session_not_found") } as never);

    await expect(
      login(caller({ signInWithPassword: opened }), admin.client, { email: "a@b.co", password: "p" }),
    ).rejects.toMatchObject({
      code: "AUTH_MEMBERSHIP_INACTIVE",
    });
    expect(warn).toHaveBeenCalledWith("Could not end a session that was refused", { code: "session_not_found" });
  });
});

describe("logout", () => {
  it("revokes the session at Supabase", async () => {
    const admin = server();
    await expect(logout(admin.client, "access-1")).resolves.toEqual({ signedOut: true });
    expect(admin.signOut).toHaveBeenCalledWith("access-1", "local");
  });

  it("signs out all the same when the token had already gone, logging it", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const admin = server();
    admin.signOut.mockResolvedValue({ error: authError("session_not_found") } as never);
    await expect(logout(admin.client, "old")).resolves.toEqual({ signedOut: true });
    expect(warn).toHaveBeenCalledWith("Sign out could not revoke the session", { code: "session_not_found" });
  });
});

describe("getSession", () => {
  it("reads the session behind a token, without its refresh token", async () => {
    const getUser = vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null }));
    const session = await getSession(server({ auth: { getUser } }).client, "access-1");
    expect(getUser).toHaveBeenCalledWith("access-1");
    expect(session).toMatchObject({ accessToken: "access-1", refreshToken: "", expiresAt: null });
  });

  it("refuses a token Supabase no longer accepts", async () => {
    const getUser = vi.fn(async () => ({ data: { user: null }, error: authError("bad_jwt") }));
    await expect(getSession(server({ auth: { getUser } }).client, "old")).rejects.toMatchObject({
      code: "AUTH_SESSION_INVALID",
    });
  });
});

describe("refreshSession", () => {
  it("trades the refresh token for a fresh session, read again", async () => {
    const refresh = vi.fn(async () => ({
      data: { session: supabaseSession(), user: supabaseSession().user },
      error: null,
    }));
    const session = await refreshSession(caller({ refreshSession: refresh }), server().client, "refresh-0");
    expect(refresh).toHaveBeenCalledWith({ refresh_token: "refresh-0" });
    expect(session.accessToken).toBe("access-1");
  });

  it("refuses a refresh token that was revoked or used", async () => {
    const refresh = vi.fn(async () => ({
      data: { session: null, user: null },
      error: authError("refresh_token_not_found"),
    }));
    await expect(refreshSession(caller({ refreshSession: refresh }), server().client, "x")).rejects.toMatchObject({
      code: "AUTH_SESSION_INVALID",
    });
  });
});

describe("confirmEmail", () => {
  const setSessionWith = (session: ReturnType<typeof supabaseSession> | null, error: unknown = null) =>
    vi.fn(async () => ({ data: { session, user: session?.user ?? null }, error }));

  it("signs the owner in from the link's tokens once the address is confirmed", async () => {
    const setSession = setSessionWith(supabaseSession());
    const session = await confirmEmail(caller({ setSession }), server().client, {
      accessToken: "a",
      refreshToken: "r",
    });
    expect(setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "r" });
    expect(session.membership).toMatchObject({ clinicId: "clinic-1" });
  });

  it("refuses a link that expired, was used, or did not confirm the address", async () => {
    const expired = setSessionWith(null, authError("session_expired"));
    await expect(
      confirmEmail(caller({ setSession: expired }), server().client, { accessToken: "a", refreshToken: "r" }),
    ).rejects.toMatchObject({
      code: "AUTH_LINK_INVALID",
    });
    const unconfirmed = setSessionWith(supabaseSession(false));
    await expect(
      confirmEmail(caller({ setSession: unconfirmed }), server().client, { accessToken: "a", refreshToken: "r" }),
    ).rejects.toMatchObject({
      code: "AUTH_LINK_INVALID",
    });
  });
});
