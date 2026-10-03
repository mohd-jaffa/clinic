import * as z from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { PERMISSIONS, permissionsAreConsistent } from "@/constants/permissions";
import { INVITE_ROLES } from "@/constants/roles";

import { optionalLine, optionalPaiseText, requiredEmail, requiredLine } from "../primitives";

const { team } = UI_TEXT;

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
const doctorDetails = z.object({
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
    doctor: doctorDetails,
  })
  .transform(({ role, jobTitle, doctor, ...invite }) => ({
    ...invite,
    role,
    jobTitle: role === "STAFF" ? jobTitle : null,
    doctor: role === "DOCTOR" ? doctor : null,
  }));

export type InviteInput = z.input<typeof inviteSchema>;
export type InvitePayload = z.output<typeof inviteSchema>;
