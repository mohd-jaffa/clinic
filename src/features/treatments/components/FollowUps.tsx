"use client";

import { CalendarClock, Phone } from "lucide-react";
import { useId, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { IconLink } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { UI_TEXT } from "@/constants/messages";
import { FOLLOW_UP_ACCESS, hasAccess } from "@/constants/permissions";
import { FOLLOW_UP_TAB_LABELS, FOLLOW_UP_TABS, type FollowUpTab } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { useClinic } from "@/features/clinic/hooks/useClinic";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { callHref } from "@/lib/phone";

import { followUpAbout, followUpWhen, lastContactLine } from "../describe";
import { useFollowUpCounts } from "../hooks/useFollowUpCounts";
import { useFollowUps } from "../hooks/useFollowUps";
import { useOpenedFollowUp } from "../hooks/useOpenedFollowUp";
import type { FollowUp } from "../types";
import { FollowUpPanel } from "./FollowUpPanel";

const { followUps: words, patients } = UI_TEXT;

/** What a tab says when nothing is in it. */
const EMPTY_HINTS: Record<FollowUpTab, string> = {
  TODAY: words.emptyHint,
  OVERDUE: words.emptyHint,
  UPCOMING: words.emptyHint,
  LAPSED: words.emptyHintLapsed,
  COMPLETED: words.emptyHintCompleted,
};

/**
 * Follow-ups (plan §14.3; D267 – D278): who is due back, in tabs by the
 * clinic's today — Today, Overdue, Upcoming, Lapsed, Completed — each with
 * how many it holds, a page at a time, for whoever sees appointments or
 * visits; a doctor sees only their own patients. Each row names the patient,
 * what is due and with whom, when, and the last contact, with **Call** at its
 * end (D272); the row opens its sheet, where they are reminded, booked and
 * marked contacted. One list on a phone and a desktop alike (D278).
 */
export function FollowUps() {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const [tab, setTab] = useState<FollowUpTab>("TODAY");
  const tabsId = useId();
  const query = useFollowUps(tab);
  const counts = useFollowUpCounts().data;
  const clinic = useClinic().data;
  const opened = useOpenedFollowUp(query.data ?? []);

  const may = (access: Parameters<typeof hasAccess>[1]) => membership !== null && hasAccess(membership, access);
  const notes = may(FOLLOW_UP_ACCESS.note);
  const options = FOLLOW_UP_TABS.map((value) => ({
    value,
    label: FOLLOW_UP_TAB_LABELS[value],
    count: counts?.[value],
  }));

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader
            title={UI_TEXT.nav.places.followUps}
            subtitle={membership?.role === "DOCTOR" ? words.yours : undefined}
          />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        <div className="grid max-w-3xl grid-cols-1 gap-6">
          {notes && <ReadOnlyNote />}
          <div>
            <Tabs id={tabsId} label={words.tabsLabel} value={tab} options={options} onChange={setTab} />
            <TabPanel id={tabsId} value={tab}>
              <ListScreen
                query={query}
                loadFailed="FOLLOW_UPS_LOAD_FAILED"
                data={query.data}
                empty={<EmptyState icon={CalendarClock} title={words.empty[tab]} hint={EMPTY_HINTS[tab]} />}
                renderList={(rows) => (
                  <RowList label={FOLLOW_UP_TAB_LABELS[tab]}>
                    {rows.map((followUp) => (
                      <FollowUpRow key={followUp.id} followUp={followUp} tab={tab} onOpen={opened.show} />
                    ))}
                  </RowList>
                )}
              />
            </TabPanel>
          </div>
        </div>
      </div>
      <FollowUpPanel
        key={opened.followUp?.id}
        followUp={opened.followUp}
        tab={tab}
        clinic={{ name: clinic?.name ?? membership?.clinicName ?? "", phone: clinic?.phone ?? null }}
        notes={notes && !readOnly}
        books={may("appointments.create") && !readOnly}
        open={opened.open}
        onClose={opened.close}
      />
    </>
  );
}

/**
 * One follow-up (D272): the patient; what is due and with whom; when, and the
 * last contact, each on a line of its own; **Call** at its end. The row opens
 * its sheet.
 */
function FollowUpRow({
  followUp,
  tab,
  onOpen,
}: {
  followUp: FollowUp;
  tab: FollowUpTab;
  onOpen: (followUp: FollowUp) => void;
}) {
  const { patient } = followUp;
  return (
    <Row
      leading={<Avatar name={patient.name} />}
      title={patient.name}
      subtitle={followUpAbout(followUp)}
      note={[followUpWhen(followUp, tab), followUp.lastContact && lastContactLine(followUp.lastContact)]}
      trailing={
        <IconLink
          icon={Phone}
          label={patients.call(patient.name)}
          href={callHref(patient.phone)}
          newTab={false}
          tone="outline"
        />
      }
      onClick={() => onOpen(followUp)}
    />
  );
}
