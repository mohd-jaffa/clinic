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
  passwordResetCompleteSchema,
  registerSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type ChangePasswordPayload,
  type ConfirmEmailPayload,
  type EmailRequestPayload,
  type LoginInput,
  type LoginPayload,
  type PasswordResetCompletePayload,
  type RegisterInput,
  type RegisterPayload,
  type UpdateProfileInput,
  type UpdateProfilePayload,
} from "./schemas/auth";
