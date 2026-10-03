import * as z from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { PERMISSIONS, permissionsAreConsistent } from "@/constants/permissions";
import { INVITE_ROLES } from "@/constants/roles";

import { indianMobile, optionalLine, optionalPaiseText, password, requiredEmail, requiredLine } from "../primitives";

const { team, acceptInvite } = UI_TEXT;

/**
 * What a member may do (plan §8.1): permissions from the catalogue, each
 * once, in catalogue order — refused when one lacks what it needs (§8.2
 * rule 2), as the database refuses it too.
 */
const permissionSet = z
  .array(z.enum(PERMISSIONS, { error: VALIDATION_MESSAGES.invalid }), { error: VALIDATION_MESSAGES.invalid })
  .max(PERMISSIONS.length, VALIDATION_MESSAGES.invalid)
  .transform((given) => PERMISSIONS.filter((permission) => given.includes(permission)))
  .refine(permissionsAreConsistent, VALIDATION_MESSAGES.permissionsNeedOthers);

/** A doctor's details (plan §8.4): each may wait; the fee, left empty, is the price list's (D26). */
export const doctorDetailsSchema = z.object({
  specialization: optionalLine(team.specializationLabel, TEXT_LIMITS.doctorDetail),
  qualifications: optionalLine(team.qualificationsLabel, TEXT_LIMITS.doctorDetail),
  registrationNumber: optionalLine(team.registrationLabel, TEXT_LIMITS.registrationNumber),
  fee: optionalPaiseText(team.feeLabel),
});

/**
 * An invite (plan §8.4, D89): who, by name and email; their role — a job
 * title for staff, a doctor's details for a doctor; and what they may do.
 * What belongs to the other role is dropped, not sent on.
 */
export const inviteSchema = z
  .object({
    fullName: requiredLine(team.nameLabel, { max: TEXT_LIMITS.personName }),
    email: requiredEmail(team.emailLabel),
    role: z.enum(INVITE_ROLES, { error: VALIDATION_MESSAGES.choose(team.roleLabel) }),
    jobTitle: optionalLine(team.jobTitleLabel, TEXT_LIMITS.jobTitle),
    permissions: permissionSet,
    doctor: doctorDetailsSchema,
  })
  .transform(({ role, jobTitle, doctor, ...invite }) => ({
    ...invite,
    role,
    jobTitle: role === "STAFF" ? jobTitle : null,
    doctor: role === "DOCTOR" ? doctor : null,
  }));

export type InviteInput = z.input<typeof inviteSchema>;
export type InvitePayload = z.output<typeof inviteSchema>;

/** An invite's token as its link carries it (D63): 32 random bytes, base64url. */
const inviteToken = z.string({ error: VALIDATION_MESSAGES.invalid }).regex(/^[\w-]{43}$/, VALIDATION_MESSAGES.invalid);

/** What the accept screen asks about first: the invite its link names (plan §8.5). */
export const invitePreviewSchema = z.object({ token: inviteToken });

export type InvitePreviewInput = z.input<typeof invitePreviewSchema>;

/**
 * Accepting an invite (plan §8.5, D91): the link's token, the person's name
 * as they confirm it, their mobile, and the password they choose — never
 * trimmed or changed.
 */
export const acceptInviteSchema = z.object({
  token: inviteToken,
  fullName: requiredLine(acceptInvite.nameLabel, { max: TEXT_LIMITS.personName }),
  phone: indianMobile(acceptInvite.phoneLabel),
  password: password(),
});

export type AcceptInviteInput = z.input<typeof acceptInviteSchema>;
export type AcceptInvitePayload = z.output<typeof acceptInviteSchema>;

/**
 * A change to a member (plan §8.6, D94, D95): what they can do, their job
 * title (staff), or their doctor's details (a doctor) — only what is named.
 */
export const updateMemberSchema = z.object({
  permissions: permissionSet.optional(),
  jobTitle: optionalLine(team.jobTitleLabel, TEXT_LIMITS.jobTitle).optional(),
  doctor: doctorDetailsSchema.optional(),
});

/** A member of staff's job title (plan §8.4): it may be left empty. */
export const jobTitleSchema = z.object({ jobTitle: optionalLine(team.jobTitleLabel, TEXT_LIMITS.jobTitle) });

export type DoctorDetailsInput = z.input<typeof doctorDetailsSchema>;
export type DoctorDetailsPayload = z.output<typeof doctorDetailsSchema>;
export type JobTitleInput = z.input<typeof jobTitleSchema>;
export type JobTitlePayload = z.output<typeof jobTitleSchema>;

export type UpdateMemberInput = z.input<typeof updateMemberSchema>;
export type UpdateMemberPayload = z.output<typeof updateMemberSchema>;

/** Deactivating (`false`) or reactivating (`true`) a member (plan §8.6). */
export const memberActiveSchema = z.object({ active: z.boolean({ error: VALIDATION_MESSAGES.invalid }) });

export type MemberActiveInput = z.input<typeof memberActiveSchema>;
