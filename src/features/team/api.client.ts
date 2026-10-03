import { deleteJson, postJson } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { AuthSessionView } from "@/features/auth/types";
import type { AcceptInviteInput, InviteInput } from "@/lib/validation";

import type { InvitePreview } from "./accept";
import type { InviteOutcome, TeamMember } from "./types";

/**
 * The team's endpoints the browser calls (plan §30): invite, resend, revoke;
 * and, before anyone has signed in, what an invite's link opens onto and
 * accepting it — which answers with the new session, its cookies set.
 */
export const TeamClient = {
  invite: (input: InviteInput) => postJson<InviteOutcome>(apiRoutes.team.invites, input),
  resend: (id: string) => postJson<TeamMember>(apiRoutes.team.resend(id)),
  revoke: (id: string) => deleteJson<TeamMember>(apiRoutes.team.invite(id)),
  previewInvite: (token: string) => postJson<InvitePreview>(apiRoutes.auth.invitePreview, { token }),
  acceptInvite: (input: AcceptInviteInput) => postJson<AuthSessionView>(apiRoutes.auth.acceptInvite, input),
};
