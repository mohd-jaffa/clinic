import type { Permission } from "@/constants/permissions";
import type { ClinicRole, PlatformRole } from "@/constants/roles";
import type { PlanStanding } from "@/features/subscription/state";

/** Who someone is (plan §28.1). */
export interface SessionProfile {
  id: string;
  fullName: string;
  email: string;
  /** +91 E.164; none for an invited member until they accept. */
  phone: string | null;
  /** DEV for the platform admin, who belongs to no clinic (plan §3.2). */
  platformRole: PlatformRole | null;
}

/** Their active membership: what they may do, and where (plan §3.1, §8). */
export interface SessionMembership {
  id: string;
  clinicId: string;
  clinicName: string;
  /** Where the clinic's logo is read, naming its version; null while it has none (plan §31.1). */
  clinicLogoUrl: string | null;
  role: ClinicRole;
  /** What they may do; the owner's are all of them (plan §8.2). */
  permissions: Permission[];
  /** Their own doctor profile, while it is active. */
  doctorId: string | null;
  jobTitle: string | null;
}

/** Where the clinic's plan stands (plan §7.2), for the plan banner and read-only mode. */
export type SessionSubscription = PlanStanding;

/** Everything a session knows about the person, besides its tokens. */
export interface SessionContext {
  profile: SessionProfile;
  /** None for the platform admin. */
  membership: SessionMembership | null;
  subscription: SessionSubscription | null;
}

/**
 * What the server holds about whoever is asking. The tokens never leave the
 * server: they are set as HttpOnly cookies and read back from them, so no
 * script in the browser can reach them (AGENTS.md §9).
 */
export interface AuthenticatedSession extends SessionContext {
  accessToken: string;
  refreshToken: string;
  /** When the access token expires, in seconds since the epoch, when Supabase says. */
  expiresAt: number | null;
}

/** What the browser is told about the session: who they are and where they stand — never a token. */
export type AuthSessionView = SessionContext;
