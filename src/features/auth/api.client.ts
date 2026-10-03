import { patchJson, postJson } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type {
  ChangePasswordInput,
  ConfirmEmailInput,
  EmailRequestInput,
  LoginInput,
  PasswordResetCompleteInput,
  RegisterInput,
  UpdateProfileInput,
} from "@/lib/validation";

import type { Registration } from "./register";
import type { AuthSessionView, SessionProfile } from "./types";

/**
 * The authentication endpoints the browser calls. None of them takes or
 * returns a token: signing in sets HttpOnly cookies the browser carries by
 * itself, and what comes back is the session view (AGENTS.md §9). The tokens a
 * link in an email lands with are handed straight back to the server.
 */
export const AuthClient = {
  signIn: (payload: LoginInput) => postJson<AuthSessionView>(apiRoutes.auth.login, payload),

  register: (payload: RegisterInput) => postJson<Registration>(apiRoutes.auth.register, payload),

  /** The link that confirms the email, sent again (plan §5.1); the same answer whoever asks. */
  resendConfirmation: (payload: EmailRequestInput) =>
    postJson<{ accepted: boolean }>(apiRoutes.auth.resendConfirmation, payload),

  /** The confirmation link's tokens, which sign the owner in. */
  confirmEmail: (payload: ConfirmEmailInput) => postJson<AuthSessionView>(apiRoutes.auth.confirm, payload),

  /** A link to choose a new password (plan §5.3); the same answer whoever asks. */
  requestPasswordReset: (payload: EmailRequestInput) =>
    postJson<{ accepted: boolean }>(apiRoutes.auth.passwordReset, payload),

  /** The reset link's tokens and the new password, which sign the person in. */
  completePasswordReset: (payload: PasswordResetCompleteInput) =>
    postJson<AuthSessionView>(apiRoutes.auth.passwordResetComplete, payload),

  /** My account's name or mobile (plan §5.4); either may be sent alone. */
  updateProfile: (payload: UpdateProfileInput) => patchJson<SessionProfile>(apiRoutes.auth.profile, payload),

  /** My account's Change password: the current one, then the new — this device kept signed in, the others not. */
  changePassword: (payload: ChangePasswordInput) => postJson<AuthSessionView>(apiRoutes.auth.password, payload),

  signOut: () => postJson<{ signedOut: boolean }>(apiRoutes.auth.logout),
};
