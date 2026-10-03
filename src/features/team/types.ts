import type { Permission } from "@/constants/permissions";
import type { ClinicRole } from "@/constants/roles";
import type { MemberStatus } from "@/constants/statuses";

/** A `doctors` row as the picker reads it, with the name through their membership's profile. */
export interface DoctorRow {
  id: string;
  member: { profile: { full_name: string } };
}

/** One of the clinic's active doctors, as a picker offers them (plan §30). */
export interface Doctor {
  id: string;
  name: string;
}

/** A `clinic_members` row as the team list reads it, with the person's profile and doctor profile. */
export interface TeamMemberRow {
  id: string;
  user_id: string;
  role: ClinicRole;
  status: MemberStatus;
  job_title: string | null;
  permissions: Permission[];
  invite_expires_at: string | null;
  profile: { full_name: string; email: string };
  /** One doctor profile per membership; PostgREST may hand it back as a list. */
  doctors: { specialization: string | null } | { specialization: string | null }[] | null;
}

/** Someone on the team (plan §8.6): an owner, a doctor or staff — invited, active or inactive. */
export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: ClinicRole;
  status: MemberStatus;
  jobTitle: string | null;
  /** What is stored; the owner's are every one, implicitly (plan §8.2). */
  permissions: Permission[];
  /** While invited: until when the link works. */
  inviteExpiresAt: string | null;
  /** While invited: whether that time has passed — the link no longer works. */
  inviteExpired: boolean;
  /** A doctor's specialization; null for staff, or a doctor without one. */
  specialization: string | null;
  isDoctor: boolean;
}

/** What inviting answers (plan §8.4): the new member, and whether their email went. */
export interface InviteOutcome {
  member: TeamMember;
  emailSent: boolean;
}
