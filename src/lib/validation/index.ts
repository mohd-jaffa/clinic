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
  optionalPaiseText,
  paiseAmount,
  paiseText,
  quantity,
  requiredDay,
  requiredEmail,
  requiredLine,
  requiredLines,
  wholeNumberText,
} from "./primitives";

export { cursorParam, listQuerySchema, searchParam, type ListQuery } from "./schemas/list";

export {
  BORN_AS,
  PATIENT_TABS,
  patientListSchema,
  patientMatchesSchema,
  patientSchema,
  updatePatientSchema,
  type BornAs,
  type PatientListPayload,
  type PatientListQuery,
  type PatientTab,
  type PatientInput,
  type PatientMatchesInput,
  type PatientMatchesPayload,
  type PatientPayload,
  type UpdatePatientInput,
  type UpdatePatientPayload,
} from "./schemas/patients";

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

export {
  appointmentTypeSchema,
  changeAppointmentTypeSchema,
  changeExpenseCategorySchema,
  changeServiceSchema,
  expenseCategorySchema,
  serviceSchema,
  type AppointmentTypeInput,
  type AppointmentTypePayload,
  type ChangeAppointmentTypeInput,
  type ChangeAppointmentTypePayload,
  type ChangeExpenseCategoryInput,
  type ChangeExpenseCategoryPayload,
  type ChangeServiceInput,
  type ChangeServicePayload,
  type ExpenseCategoryInput,
  type ExpenseCategoryPayload,
  type ServiceInput,
  type ServicePayload,
} from "./schemas/catalogues";

export { closureSchema, WHOLE_CLINIC, type ClosureInput, type ClosurePayload } from "./schemas/closures";

export { FORM_RESET_OPTIONS } from "./forms";

export {
  acceptInviteSchema,
  doctorDetailsSchema,
  invitePreviewSchema,
  inviteSchema,
  jobTitleSchema,
  memberActiveSchema,
  ownDoctorSchema,
  updateMemberSchema,
  type AcceptInviteInput,
  type AcceptInvitePayload,
  type DoctorDetailsInput,
  type DoctorDetailsPayload,
  type InviteInput,
  type InvitePayload,
  type InvitePreviewInput,
  type JobTitleInput,
  type JobTitlePayload,
  type MemberActiveInput,
  type OwnDoctorInput,
  type OwnDoctorPayload,
  type UpdateMemberInput,
  type UpdateMemberPayload,
} from "./schemas/team";
