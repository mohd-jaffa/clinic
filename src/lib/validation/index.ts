/**
 * The app's validation, in one place (AGENTS.md §24). Each entity is declared
 * once in ./schemas — its fields, their limits, and the message for each
 * mistake — and the form that edits it and the route that accepts it use the
 * same declaration. A limit the database also enforces is written to match its
 * CHECK constraint.
 *
 * Nothing under src/features declares a schema of its own.
 */
export {
  firstIssue,
  indianMobile,
  optionalEmail,
  optionalGstin,
  optionalPhoneNumber,
  password,
  optionalLine,
  optionalLines,
  paiseAmount,
  paiseText,
  quantity,
  requiredEmail,
  requiredLine,
  requiredLines,
} from "./primitives";

export { cursorParam, listQuerySchema, searchParam, type ListQuery } from "./schemas/list";

export {
  changePasswordSchema,
  confirmEmailSchema,
  emailRequestSchema,
  loginSchema,
  newPasswordSchema,
  passwordResetCompleteSchema,
  profileNameSchema,
  profilePhoneSchema,
  registerSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type ChangePasswordPayload,
  type ConfirmEmailInput,
  type ConfirmEmailPayload,
  type EmailRequestInput,
  type EmailRequestPayload,
  type LoginInput,
  type LoginPayload,
  type NewPasswordInput,
  type NewPasswordPayload,
  type PasswordResetCompleteInput,
  type PasswordResetCompletePayload,
  type ProfileNameInput,
  type ProfileNamePayload,
  type ProfilePhoneInput,
  type ProfilePhonePayload,
  type RegisterInput,
  type RegisterPayload,
  type UpdateProfileInput,
  type UpdateProfilePayload,
} from "./schemas/auth";

export {
  clinicDetailsSchema,
  updateClinicSchema,
  type ClinicDetailsInput,
  type ClinicDetailsPayload,
  type UpdateClinicInput,
  type UpdateClinicPayload,
} from "./schemas/clinic";
