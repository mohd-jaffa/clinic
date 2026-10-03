"use client";

import { Undo2 } from "lucide-react";
import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { TeamClient } from "../api.client";
import type { TeamMember } from "../types";

const { team } = UI_TEXT;

/**
 * What can be done with an open invite (plan §8.4): **Resend** a new link,
 * the old one dead; **Revoke** it, asked first, on a danger card. Each says
 * how it went; a refusal is an error card in the API's words. `busy` is the
 * invite being acted on, so only its row waits.
 */
export function useInviteActions() {
  const respond = useResponse();
  const [busy, setBusy] = useState<string | null>(null);
  const resending = useApiMutation(TeamClient.resend, {
    revalidate: [apiRoutes.team.list],
    onSuccess: (member) => respond.success({ title: team.resent(member.email) }),
    onError: (failure) => respond.failure(failure, { title: team.notResent }),
  });
  const revoking = useApiMutation(TeamClient.revoke, {
    revalidate: [apiRoutes.team.list],
    onSuccess: (member) => respond.success({ title: team.revoked(member.name) }),
    onError: (failure) => respond.failure(failure, { title: team.notRevoked }),
  });

  const working = async (member: TeamMember, work: () => Promise<unknown>) => {
    setBusy(member.id);
    await work();
    setBusy(null);
  };

  const resend = (member: TeamMember) => working(member, () => resending.submit(member.id));

  const revoke = async (member: TeamMember) => {
    const sure = await respond.confirm({
      title: team.revokeTitle(member.name),
      message: team.revokeBody,
      confirmLabel: team.revoke,
      confirmIcon: Undo2,
      tone: "danger",
    });
    if (sure) await working(member, () => revoking.submit(member.id));
  };

  return { resend, revoke, busy };
}
