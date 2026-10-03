import { vi } from "vitest";

import { PERMISSIONS, type Permission } from "@/constants/permissions";
import type { useAuth } from "@/features/auth/AuthProvider";
import type { AuthenticatedSession, SessionMembership } from "@/features/auth/types";

/**
 * A signed-in owner's session, as the server holds it, for unit tests that
 * need its shape and not Supabase. Pass what the test is about.
 */
export function aSession(overrides: Partial<AuthenticatedSession> = {}): AuthenticatedSession {
  return {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    profile: {
      id: "user-1",
      fullName: "Asha Menon",
      email: "asha@example.com",
      phone: "+919876543210",
      platformRole: null,
    },
    membership: {
      id: "member-1",
      clinicId: "clinic-1",
      clinicName: "Smile Care",
      clinicLogoUrl: null,
      role: "OWNER",
      permissions: [],
      doctorId: "doctor-1",
      jobTitle: null,
    },
    subscription: { plan: "TRIAL", validUntil: "2026-11-01", state: "ACTIVE", readOnlyFrom: "2026-11-09" },
    ...overrides,
  };
}

/** The platform admin's session: no clinic, no plan. */
export function aDeveloperSession(): AuthenticatedSession {
  const session = aSession({ membership: null, subscription: null });
  return { ...session, profile: { ...session.profile, platformRole: "DEV" } };
}

type AuthValue = ReturnType<typeof useAuth>;

/**
 * What `useAuth()` hands a component, for a test that mocks the provider: a
 * signed-in owner unless the test says otherwise. `permissions` narrows what
 * they may do, as a member's own permissions would.
 */
export function authStub(
  overrides: Partial<AuthValue> & { role?: SessionMembership["role"]; permissions?: Permission[] } = {},
): AuthValue {
  const { role = "OWNER", permissions = [...PERMISSIONS], ...rest } = overrides;
  const { profile, membership, subscription } = aSession();
  return {
    status: "authenticated",
    profile,
    membership: { ...membership!, role, permissions },
    subscription,
    signOut: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    ...rest,
  };
}
