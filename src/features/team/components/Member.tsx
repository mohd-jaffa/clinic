"use client";

import { BadgeCheck, Briefcase, Check, Mail, Phone, Stethoscope, UserCheck, UserX } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { useResponse } from "@/components/ui/response-card";
import { Row, RowIcon, RowList } from "@/components/ui/row";
import { ScreenNotice } from "@/components/ui/screen-notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import { TEAM_ROUTE } from "@/constants/navigation";
import { PERMISSION_GROUPS, PERMISSION_TEXT, type Permission } from "@/constants/permissions";
import { CLINIC_ROLE_LABELS } from "@/constants/roles";
import { useAuth } from "@/features/auth/AuthProvider";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { formatPaise } from "@/lib/format/currency";
import { formatPhoneDigits } from "@/lib/phone";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";

import { canManage, grantable } from "../access";
import { TeamClient } from "../api.client";
import { useMember } from "../hooks/useMember";
import type { DoctorDetails, MemberDetail } from "../types";
import { AccessPicker } from "./AccessPicker";
import { DoctorDetailsSheet } from "./DoctorDetailsSheet";
import { JobTitleSheet } from "./JobTitleSheet";

const { member: words, team } = UI_TEXT;

/** What someone is at the clinic: "Doctor · Orthodontist", "Staff · Front desk". */
const roleOf = (member: MemberDetail) =>
  [CLINIC_ROLE_LABELS[member.role], member.jobTitle ?? member.specialization].filter(Boolean).join(" · ");

/** A doctor's details in a line: "Orthodontist · BDS, MDS · Reg. KL-1 · Fee ₹700". */
const doctorLine = (doctor: DoctorDetails) =>
  [
    doctor.specialization,
    doctor.qualifications,
    doctor.registrationNumber && words.registration(doctor.registrationNumber),
    doctor.feePaise !== null && words.ownFee(formatPaise(doctor.feePaise)),
  ]
    .filter(Boolean)
    .join(" · ") || words.noDoctorDetails;

/**
 * A member's page (plan §8.6, D93 – D95), for `team.manage`: who they are
 * — name, role, email, mobile; their job title or a doctor's details, each
 * opening its sheet; what they can do, with the invite's presets and
 * groups, saved with one **Save changes**; and **Deactivate** or
 * **Reactivate**, asked first. Someone beyond the manager's own access is
 * shown, not changed, and says it is the owner's to change; so is anyone in a
 * view-only clinic.
 */
export function Member({ id }: { id: string }) {
  const query = useMember(id);
  const member = query.data;
  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={member?.name ?? team.people} subtitle={member && roleOf(member)} back={TEAM_ROUTE} />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        {member ? (
          <MemberPage member={member} />
        ) : query.error != null ? (
          <LoadFailed query={query} loadFailed="MEMBER_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={4} />
          </section>
        )}
      </div>
    </>
  );
}

function MemberPage({ member }: { member: MemberDetail }) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const [sheet, setSheet] = useState<"details" | null>(null);
  const ids = { contact: useId(), details: useId(), access: useId() };
  const manageable = !readOnly && membership !== null && canManage({ ...membership, memberId: membership.id }, member);
  const edit = manageable ? () => setSheet("details") : undefined;
  const close = () => setSheet(null);

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-8">
      {member.status === "INACTIVE" && <ScreenNotice tone="info">{words.inactive}</ScreenNotice>}
      <ReadOnlyNote />

      <section aria-labelledby={ids.contact}>
        <SectionHeading id={ids.contact} title={words.contact} />
        <RowList look="menu">
          <Row look="menu" leading={<RowIcon icon={Mail} />} title={words.emailLabel} subtitle={member.email} />
          <Row
            look="menu"
            leading={<RowIcon icon={Phone} />}
            title={words.phoneLabel}
            subtitle={member.phone ? `${UI_TEXT.fields.phonePrefix} ${formatPhoneDigits(member.phone)}` : words.noPhone}
          />
        </RowList>
      </section>

      <section aria-labelledby={ids.details}>
        <SectionHeading id={ids.details} title={words.details} />
        <RowList look="menu">
          {member.doctor ? (
            <Row
              look="menu"
              leading={<RowIcon icon={Stethoscope} />}
              title={words.doctorDetails}
              subtitle={doctorLine(member.doctor)}
              onClick={edit}
            />
          ) : (
            <Row
              look="menu"
              leading={<RowIcon icon={Briefcase} />}
              title={words.jobTitle}
              subtitle={member.jobTitle ?? words.noJobTitle}
              onClick={edit}
            />
          )}
        </RowList>
      </section>

      {manageable ? (
        // The picker names its own section, as it does in the invite.
        <AccessEditor key={member.permissions.join()} member={member} allowed={grantable(membership!)} />
      ) : (
        <section aria-labelledby={ids.access}>
          <SectionHeading id={ids.access} title={team.accessTitle} />
          <AccessSummary member={member} />
        </section>
      )}

      {manageable && <ActiveControl member={member} />}

      {member.doctor ? (
        <DoctorDetailsSheet
          open={sheet === "details"}
          onClose={close}
          details={member.doctor}
          save={(doctor) => TeamClient.update({ id: member.id, doctor })}
          revalidate={[apiRoutes.team.member(member.id), apiRoutes.team.list]}
        />
      ) : (
        <JobTitleSheet open={sheet === "details"} onClose={close} member={member} />
      )}
    </div>
  );
}

/** What they can do, changed in place and saved together (D94). */
function AccessEditor({ member, allowed }: { member: MemberDetail; allowed: readonly Permission[] }) {
  const respond = useResponse();
  const [draft, setDraft] = useState<Permission[]>(member.permissions);
  const changed =
    draft.length !== member.permissions.length || draft.some((permission) => !member.permissions.includes(permission));
  const { submit, submitting } = useApiMutation(TeamClient.update, {
    revalidate: [apiRoutes.team.member(member.id), apiRoutes.team.list],
    onSuccess: (saved) => respond.success({ title: words.accessSaved(saved.name) }),
    onError: (failure) => respond.failure(failure, { title: words.notSaved }),
  });

  return (
    <div className="grid gap-5">
      <AccessPicker value={draft} onChange={setDraft} allowed={allowed} />
      <div>
        <Button
          label={words.saveAccess}
          icon={Check}
          disabled={!changed}
          loading={submitting}
          onClick={() => void submit({ id: member.id, permissions: draft })}
        />
      </div>
    </div>
  );
}

/** What they can do, read only: each part of the clinic and what is granted in it. */
function AccessSummary({ member }: { member: MemberDetail }) {
  return (
    <div className="grid gap-4">
      <p className="text-small text-muted">{words.readOnly(member.name)}</p>
      <dl className="grid gap-3">
        {PERMISSION_GROUPS.map((group) => {
          const held = group.permissions.filter((permission) => member.permissions.includes(permission));
          return (
            held.length > 0 && (
              <div key={group.label}>
                <dt className="text-small font-bold text-ink">{group.label}</dt>
                <dd className="text-muted">{held.map((permission) => PERMISSION_TEXT[permission].label).join(", ")}</dd>
              </div>
            )
          );
        })}
      </dl>
    </div>
  );
}

/** Deactivate (danger, asked first) or Reactivate (asked first) — §8.6. */
function ActiveControl({ member }: { member: MemberDetail }) {
  const respond = useResponse();
  const active = member.status === "ACTIVE";
  const { submit, submitting } = useApiMutation(TeamClient.setActive, {
    revalidate: [apiRoutes.team.member(member.id), apiRoutes.team.list],
    onSuccess: (saved) =>
      respond.success({
        title: saved.status === "ACTIVE" ? words.reactivated(saved.name) : words.deactivated(saved.name),
      }),
    onError: (failure) => respond.failure(failure, { title: words.notChanged }),
  });

  const ask = async () => {
    const sure = await respond.confirm(
      active
        ? {
            title: words.deactivateTitle(member.name),
            message: words.deactivateBody,
            confirmLabel: words.deactivate,
            confirmIcon: UserX,
            tone: "danger",
          }
        : {
            title: words.reactivateTitle(member.name),
            message: words.reactivateBody,
            confirmLabel: words.reactivate,
            confirmIcon: UserCheck,
          },
    );
    if (sure) await submit({ id: member.id, active: !active });
  };

  return (
    <div className="border-t border-line pt-5">
      <Button
        label={active ? words.deactivate : words.reactivate}
        icon={active ? UserX : BadgeCheck}
        variant={active ? "danger" : "secondary"}
        loading={submitting}
        onClick={() => void ask()}
      />
    </div>
  );
}
