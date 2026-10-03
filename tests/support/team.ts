import type { MemberDetail, TeamMember } from "@/features/team/types";

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

/** A member as their page reads them, for a component test: a doctor unless told otherwise. */
export function aMemberDetail(overrides: Partial<MemberDetail> = {}): MemberDetail {
  return {
    ...aTeamMember({ id: "m-2", userId: "u-2", name: "Rahul Nair", role: "DOCTOR", jobTitle: null }),
    specialization: "Orthodontist",
    isDoctor: true,
    phone: "+919876501234",
    doctor: {
      specialization: "Orthodontist",
      qualifications: "BDS, MDS",
      registrationNumber: "KL-1",
      feePaise: 70_000,
    },
    ...overrides,
  };
}
