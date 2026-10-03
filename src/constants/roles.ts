/**
 * Who someone is in a clinic, and on the platform (plan §3). The database's
 * CHECKs on `clinic_members.role` and `profiles.platform_role` are kept equal
 * to these by tests/db (AGENTS.md §25).
 */

/** A membership's role (plan §3.1): exactly one OWNER per clinic (D24). */
export const CLINIC_ROLES = ["OWNER", "DOCTOR", "STAFF"] as const;
export type ClinicRole = (typeof CLINIC_ROLES)[number];

/** The roles someone is invited to (plan §8.4): there is one owner, who signed the clinic up. */
export const INVITE_ROLES = ["DOCTOR", "STAFF"] as const satisfies readonly ClinicRole[];
export type InviteRole = (typeof INVITE_ROLES)[number];

export const CLINIC_ROLE_LABELS: Record<ClinicRole, string> = {
  OWNER: "Owner",
  DOCTOR: "Doctor",
  STAFF: "Staff",
};

/** The platform admin (plan §3.2): the developer console only, never a clinic's data. */
export const PLATFORM_ROLES = ["DEV"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  DEV: "Developer",
};
