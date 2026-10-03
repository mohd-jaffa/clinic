"use client";

import { Undo2, UserPlus } from "lucide-react";
import { useId, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import { memberRoute } from "@/constants/navigation";
import { CLINIC_ROLE_LABELS } from "@/constants/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { dayKey } from "@/lib/dates/calendar";
import { formatDayMonth } from "@/lib/format/date";

import { grantable } from "../access";
import { useInviteActions } from "../hooks/useInviteActions";
import { useTeam } from "../hooks/useTeam";
import type { TeamMember } from "../types";
import { InviteSheet } from "./InviteSheet";

const { team } = UI_TEXT;
const title = UI_TEXT.nav.places.team;

/** What someone is at the clinic: "Owner", "Doctor · Orthodontist", "Staff · Front desk". */
const roleOf = (member: TeamMember) =>
  [CLINIC_ROLE_LABELS[member.role], member.jobTitle ?? member.specialization].filter(Boolean).join(" · ");

/** How long an open invite's link lasts — within weeks, so no year — or that it has run out. */
const linkOf = (member: TeamMember) =>
  member.inviteExpired ? team.linkExpired : team.linkUntil(formatDayMonth(dayKey(member.inviteExpiresAt!)));

/**
 * The team (plan §8.4, §8.6), for `team.manage`: everyone at the clinic —
 * the owner first — with what they are there; the open invites, each with
 * how long its link lasts, **Resend** and **Revoke**; and those no longer
 * active. **Invite** opens the sheet. In a view-only clinic it is shown,
 * not changed, and says why.
 */
export function Team() {
  const query = useTeam();
  const members = query.data;
  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader
            title={title}
            subtitle={members && team.count(members.filter(({ status }) => status === "ACTIVE").length)}
          />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        {members ? (
          <TeamLists members={members} />
        ) : query.error != null ? (
          <LoadFailed query={query} loadFailed="TEAM_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={4} />
          </section>
        )}
      </div>
    </>
  );
}

function TeamLists({ members }: { members: readonly TeamMember[] }) {
  const { profile, membership } = useAuth();
  const { readOnly } = useReadOnly();
  const [inviting, setInviting] = useState(false);
  const { resend, revoke, busy } = useInviteActions();
  const ids = { people: useId(), invited: useId(), inactive: useId() };
  // Everyone joined has a page (D94) — but the owner and oneself, whose access no one here changes.
  const opens = (member: TeamMember) => member.role !== "OWNER" && member.userId !== profile?.id;
  const of = (status: TeamMember["status"]) => members.filter((member) => member.status === status);
  const [active, invited, inactive] = [of("ACTIVE"), of("INVITED"), of("INACTIVE")];

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-8">
      <div>
        {!readOnly && <Button label={team.invite} icon={UserPlus} onClick={() => setInviting(true)} />}
        <ReadOnlyNote />
      </div>

      <section aria-labelledby={ids.people}>
        <SectionHeading id={ids.people} title={team.people} count={active.length} />
        <RowList label={team.people}>
          {active.map((member) => (
            <Row
              key={member.id}
              leading={<Avatar name={member.name} />}
              title={member.userId === profile?.id ? team.you(member.name) : member.name}
              subtitle={roleOf(member)}
              href={opens(member) ? memberRoute(member.id) : undefined}
            />
          ))}
        </RowList>
      </section>

      {invited.length > 0 && (
        <section aria-labelledby={ids.invited}>
          <SectionHeading id={ids.invited} title={team.invitedList} count={invited.length} />
          <RowList label={team.invitedList}>
            {invited.map((member) => (
              <Row
                key={member.id}
                look="quiet"
                leading={<Avatar name={member.name} />}
                title={member.name}
                subtitle={linkOf(member)}
                trailing={
                  !readOnly && (
                    <>
                      <Button
                        label={team.resend}
                        aria-label={team.resendNamed(member.name)}
                        variant="quiet"
                        size="sm"
                        loading={busy === member.id}
                        onClick={() => void resend(member)}
                      />
                      <IconButton
                        icon={Undo2}
                        label={team.revokeNamed(member.name)}
                        tone="danger"
                        disabled={busy === member.id}
                        onClick={() => void revoke(member)}
                      />
                    </>
                  )
                }
              />
            ))}
          </RowList>
        </section>
      )}

      {inactive.length > 0 && (
        <section aria-labelledby={ids.inactive}>
          <SectionHeading id={ids.inactive} title={team.inactiveList} count={inactive.length} />
          <RowList label={team.inactiveList}>
            {inactive.map((member) => (
              <Row
                key={member.id}
                look="quiet"
                leading={<Avatar name={member.name} />}
                title={member.name}
                subtitle={roleOf(member)}
                href={memberRoute(member.id)}
              />
            ))}
          </RowList>
        </section>
      )}

      {membership && <InviteSheet open={inviting} onClose={() => setInviting(false)} allowed={grantable(membership)} />}
    </div>
  );
}
