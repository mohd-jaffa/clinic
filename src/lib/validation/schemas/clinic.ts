import * as z from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { CLINIC_TYPES, FEE_TIMINGS, PAPER_SIZES } from "@/constants/statuses";

import { optionalEmail, optionalGstin, optionalPhoneNumber, requiredLine, requiredLines } from "../primitives";

const { clinic } = UI_TEXT;

/**
 * Clinic details (plan §9, D78): everything the details sheet holds, sent
 * together — so clearing the phone and leaving it alone stay different things.
 */
export const clinicDetailsSchema = z.object({
  name: requiredLine(clinic.nameLabel, { max: TEXT_LIMITS.clinicName }),
  clinicType: z.enum(CLINIC_TYPES, { error: VALIDATION_MESSAGES.choose(clinic.typeLabel) }),
  address: requiredLines(clinic.addressLabel, { max: TEXT_LIMITS.address }),
  city: requiredLine(clinic.cityLabel, { max: TEXT_LIMITS.city }),
  phone: optionalPhoneNumber(clinic.phoneLabel),
  email: optionalEmail(clinic.emailLabel),
  gstin: optionalGstin(clinic.gstinLabel),
});

export type ClinicDetailsInput = z.input<typeof clinicDetailsSchema>;
export type ClinicDetailsPayload = z.output<typeof clinicDetailsSchema>;

/**
 * A change to the clinic (`PATCH /api/clinic`): its details, its paper size
 * (D28) or when its consultation fee is collected (D44) — each saved on its
 * own, so what is left out stays as it is.
 */
export const updateClinicSchema = z.object({
  details: clinicDetailsSchema.optional(),
  paperSize: z.enum(PAPER_SIZES, { error: VALIDATION_MESSAGES.choose(clinic.paperSize) }).optional(),
  feeTiming: z.enum(FEE_TIMINGS, { error: VALIDATION_MESSAGES.choose(clinic.feeTiming) }).optional(),
});

export type UpdateClinicInput = z.input<typeof updateClinicSchema>;
export type UpdateClinicPayload = z.output<typeof updateClinicSchema>;
