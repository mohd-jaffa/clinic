import { deleteJson, postJson } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import type { InviteInput } from "@/lib/validation";

import type { InviteOutcome, TeamMember } from "./types";

/** The team's endpoints the browser calls (plan §30): invite, resend, revoke. */
export const TeamClient = {
  invite: (input: InviteInput) => postJson<InviteOutcome>(apiRoutes.team.invites, input),
  resend: (id: string) => postJson<TeamMember>(apiRoutes.team.resend(id)),
  revoke: (id: string) => deleteJson<TeamMember>(apiRoutes.team.invite(id)),
};
