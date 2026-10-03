import type { TeamMember } from "@/features/team/types";

/** Someone on the team, for a component test: active staff unless told otherwise. */
export function aTeamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: "m-1",
    userId: "u-1",
    name: "Meera Pillai",
    email: "meera@example.com",
    role: "STAFF",
    status: "ACTIVE",
    jobTitle: "Front desk",
    permissions: ["patients.view"],
    inviteExpiresAt: null,
    inviteExpired: false,
    specialization: null,
    isDoctor: false,
    ...overrides,
  };
}
