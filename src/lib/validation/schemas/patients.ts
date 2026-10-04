import * as z from "zod";

import { MAX_PATIENT_AGE, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { ALERT_KINDS, GENDERS } from "@/constants/statuses";
import { estimatedBirthDate } from "@/lib/dates/age";
import { todayKey } from "@/lib/dates/calendar";

import {
  indianMobile,
  optionalEmail,
  optionalLine,
  optionalLines,
  optionalPhoneNumber,
  requiredDay,
  requiredLine,
  wholeNumberText,
} from "../primitives";
import { cursorParam, searchParam } from "./list";

const { patients } = UI_TEXT;

/** How a patient's birth is given (D100): a date, or an age in years. */
export const BORN_AS = ["DATE", "AGE"] as const;
export type BornAs = (typeof BORN_AS)[number];

const dateOfBirth = requiredDay(patients.dateOfBirthLabel);
const ageYears = wholeNumberText(patients.ageLabel, { min: 0, max: MAX_PATIENT_AGE });

/**
 * When a patient was born (plan §10.1, D33, D100): the date, from today back
 * MAX_PATIENT_AGE years, or an age in years, kept as today that many years
 * ago and marked estimated, so the age stays right as time passes. "Today"
 * is the one parsing it — the server's, in the clinic's timezone, is the one
 * stored. Only the one chosen is read.
 */
const bornSchema = z
  .object({
    as: z.enum(BORN_AS, { error: VALIDATION_MESSAGES.invalid }),
    date: z.string().optional(),
    years: z.string().optional(),
  })
  .transform(({ as, date, years }, ctx) => {
    const today = todayKey();
    if (as === "AGE") {
      const age = ageYears.safeParse(years ?? "");
      if (!age.success) {
        ctx.addIssue({ code: "custom", path: ["years"], message: age.error.issues[0].message });
        return z.NEVER;
      }
      return { dateOfBirth: estimatedBirthDate(age.data, today), dobIsEstimated: true };
    }
    const day = dateOfBirth.safeParse(date ?? "");
    if (!day.success) {
      ctx.addIssue({ code: "custom", path: ["date"], message: day.error.issues[0].message });
      return z.NEVER;
    }
    if (day.data > today || day.data < estimatedBirthDate(MAX_PATIENT_AGE, today)) {
      ctx.addIssue({ code: "custom", path: ["date"], message: VALIDATION_MESSAGES.birthDate });
      return z.NEVER;
    }
    return { dateOfBirth: day.data, dobIsEstimated: false };
  });

const chooseGender = VALIDATION_MESSAGES.choose(patients.genderLabel);

/** A gender (D33), from a form that starts with none chosen. */
const gender = z.union([z.enum(GENDERS), z.literal("")], { error: chooseGender }).transform((value, ctx) => {
  if (value !== "") return value;
  ctx.addIssue({ code: "custom", message: chooseGender });
  return z.NEVER;
});

/** The assigned doctor, or none ("" from the picker's No doctor yet). */
const doctorChoice = z
  .union([z.literal(""), z.null(), z.uuid({ error: VALIDATION_MESSAGES.invalid })])
  .transform((id) => id || null);

/** Every field of a patient, as the sheet holds it and the database bounds it (0015). */
const fields = {
  fullName: requiredLine(patients.nameLabel, { max: TEXT_LIMITS.personName }),
  phone: indianMobile(patients.mobileLabel),
  born: bornSchema,
  gender,
  assignedDoctorId: z.optional(doctorChoice).transform((id) => id ?? null),
  altPhone: optionalPhoneNumber(patients.altPhoneLabel),
  email: optionalEmail(patients.emailLabel),
  address: optionalLines(patients.addressLabel, TEXT_LIMITS.address),
  emergencyContactName: optionalLine(patients.emergencyNameLabel, TEXT_LIMITS.personName),
  emergencyContactPhone: optionalPhoneNumber(patients.emergencyPhoneLabel),
  notes: optionalLines(patients.notesLabel, TEXT_LIMITS.notes),
};

/**
 * A new patient (plan §10.1, D33): name, mobile, date of birth or age, and
 * gender required; the doctor and the rest may wait.
 */
export const patientSchema = z.object(fields);

export type PatientInput = z.input<typeof patientSchema>;
export type PatientPayload = z.output<typeof patientSchema>;

/**
 * A change to a patient: only the fields sent change — the edit sheet sends
 * those that were touched, so an estimated date of birth is not moved by a
 * save that left the age alone. A field sent empty is cleared.
 */
export const updatePatientSchema = z.object({
  fullName: fields.fullName.optional(),
  phone: fields.phone.optional(),
  born: fields.born.optional(),
  gender: fields.gender.optional(),
  assignedDoctorId: doctorChoice.optional(),
  altPhone: fields.altPhone.optional(),
  email: fields.email.optional(),
  address: fields.address.optional(),
  emergencyContactName: fields.emergencyContactName.optional(),
  emergencyContactPhone: fields.emergencyContactPhone.optional(),
  notes: fields.notes.optional(),
});

export type UpdatePatientInput = z.input<typeof updatePatientSchema>;
export type UpdatePatientPayload = z.output<typeof updatePatientSchema>;

/** "Already here?" (plan §10.1, D98, D106): the mobile, in the body. */
export const patientMatchesSchema = z.object({ phone: indianMobile(patients.mobileLabel) });

export type PatientMatchesInput = z.input<typeof patientMatchesSchema>;
export type PatientMatchesPayload = z.output<typeof patientMatchesSchema>;

/** The patients list's tabs (plan §10.2): everyone, or the archived. Owing comes with Phase 8 (D101). */
export const PATIENT_TABS = ["ALL", "ARCHIVED"] as const;
export type PatientTab = (typeof PATIENT_TABS)[number];

/**
 * A page of the patients list (plan §10.2, D98, D104): what is searched for,
 * the tab, and where the page starts — sent in the body, never the address.
 */
export const patientListSchema = z.object({
  search: searchParam,
  tab: z.enum(PATIENT_TABS, { error: VALIDATION_MESSAGES.invalid }).default("ALL"),
  cursor: cursorParam,
});

export type PatientListQuery = z.input<typeof patientListSchema>;
export type PatientListPayload = z.output<typeof patientListSchema>;

const { alerts } = UI_TEXT;

/** An alert's own words (plan §10.4): what it is, and a note. */
const alertFields = {
  label: requiredLine(alerts.labelLabel, { max: TEXT_LIMITS.alertLabel }),
  note: optionalLine(alerts.noteLabel, TEXT_LIMITS.alertNote),
};

/** A new alert (plan §10.4): an allergy, a condition or a medication, by name, with an optional note. */
export const alertSchema = z.object({
  kind: z.enum(ALERT_KINDS, { error: VALIDATION_MESSAGES.choose(alerts.kindLabel) }),
  ...alertFields,
});

export type AlertInput = z.input<typeof alertSchema>;
export type AlertPayload = z.output<typeof alertSchema>;

/**
 * A change to an alert (D118, D119): its name or note — never its kind — or
 * turning it off. A turned-off alert is not turned on again; it is added again.
 */
export const updateAlertSchema = z
  .object({ ...alertFields, active: z.literal(false, { error: VALIDATION_MESSAGES.invalid }) })
  .partial();

export type UpdateAlertInput = z.input<typeof updateAlertSchema>;
export type UpdateAlertPayload = z.output<typeof updateAlertSchema>;
