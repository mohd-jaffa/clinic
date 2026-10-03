import * as z from "zod";

import { TEXT_LIMITS } from "@/constants/limits";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import { CLINIC_TYPES } from "@/constants/statuses";
import { toE164India } from "@/lib/phone";

import {
  EMAIL,
  indianMobile,
  optionalPhoneNumber,
  password,
  requiredEmail,
  requiredLine,
  requiredLines,
} from "../primitives";

/**
 * Sign-up (plan §5.1): the owner, then their clinic. The mobile is stored as
 * +91 E.164 whichever way it was typed; the password exactly as typed.
 */
export const registerSchema = z.object({
  fullName: requiredLine("Your name", { max: TEXT_LIMITS.personName }),
  email: requiredEmail("Email"),
  phone: indianMobile("Mobile number"),
  password: password(),
  /** "I also see patients": the owner gets a doctor profile too (plan §3.1). */
  seesPatients: z.boolean({ error: VALIDATION_MESSAGES.invalid }).default(false),
  clinicName: requiredLine("Clinic name", { max: TEXT_LIMITS.clinicName }),
  clinicType: z.enum(CLINIC_TYPES, { error: VALIDATION_MESSAGES.choose("Clinic type") }),
  city: requiredLine("City", { max: TEXT_LIMITS.city }),
  address: requiredLines("Address", { max: TEXT_LIMITS.address }),
  clinicPhone: optionalPhoneNumber("Clinic phone"),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterPayload = z.output<typeof registerSchema>;

/**
 * Who is signing in (D39): an email, as typed and lower-cased, or a mobile
 * number however it was written — "9876543210", "09876543210" and
 * "+91 98765 43210" are one account (plan §5.2).
 */
const signInIdentifier = z
  .string({ error: VALIDATION_MESSAGES.signInIdentifier })
  .trim()
  .transform((typed, ctx): { email: string } | { phone: string } => {
    if (typed.includes("@")) {
      const email = typed.toLowerCase();
      if (EMAIL.test(email) && email.length <= TEXT_LIMITS.email) return { email };
    } else {
      const phone = toE164India(typed);
      if (phone) return { phone };
    }
    ctx.addIssue({ code: "custom", message: VALIDATION_MESSAGES.signInIdentifier });
    return z.NEVER;
  });

export const loginSchema = z
  .object({
    identifier: signInIdentifier,
    // Checked by Supabase Auth, never here: an old password shorter than today's rule still signs in.
    password: z
      .string({ error: VALIDATION_MESSAGES.required("Password") })
      .min(1, VALIDATION_MESSAGES.required("Password")),
  })
  .transform(({ identifier, password }) => ({ ...identifier, password }));

export type LoginInput = z.input<typeof loginSchema>;
export type LoginPayload = z.output<typeof loginSchema>;

/** The tokens a link in an email lands with (confirmation, password reset). */
const linkTokens = {
  accessToken: z.string({ error: VALIDATION_MESSAGES.invalid }).min(1, VALIDATION_MESSAGES.invalid),
  refreshToken: z.string({ error: VALIDATION_MESSAGES.invalid }).min(1, VALIDATION_MESSAGES.invalid),
};

export const confirmEmailSchema = z.object(linkTokens);
export type ConfirmEmailInput = z.input<typeof confirmEmailSchema>;
export type ConfirmEmailPayload = z.output<typeof confirmEmailSchema>;

/** Resend the confirmation, or send a reset link: to an address. */
export const emailRequestSchema = z.object({ email: requiredEmail("Email") });
export type EmailRequestInput = z.input<typeof emailRequestSchema>;
export type EmailRequestPayload = z.output<typeof emailRequestSchema>;

/** The new password chosen on the page a reset link opens (plan §5.3). */
export const passwordResetCompleteSchema = z.object({ ...linkTokens, password: password("New password") });
export type PasswordResetCompleteInput = z.input<typeof passwordResetCompleteSchema>;
export type PasswordResetCompletePayload = z.output<typeof passwordResetCompleteSchema>;

/** The reset screen's form: the new password alone; the link's tokens join it as it is sent. */
export const newPasswordSchema = passwordResetCompleteSchema.pick({ password: true });
export type NewPasswordInput = z.input<typeof newPasswordSchema>;
export type NewPasswordPayload = z.output<typeof newPasswordSchema>;

/** My account's Change password (plan §5.4): the current one, then the new. */
export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ error: VALIDATION_MESSAGES.required("Current password") })
    .min(1, VALIDATION_MESSAGES.required("Current password")),
  newPassword: password("New password"),
});
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type ChangePasswordPayload = z.output<typeof changePasswordSchema>;

/** My account's name and mobile (plan §5.4); either may be left as it is. */
export const updateProfileSchema = z.object({
  fullName: requiredLine("Your name", { max: TEXT_LIMITS.personName }).optional(),
  phone: indianMobile("Mobile number").optional(),
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type UpdateProfilePayload = z.output<typeof updateProfileSchema>;
