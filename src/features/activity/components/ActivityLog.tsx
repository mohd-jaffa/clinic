"use client";

import { History } from "lucide-react";
import { useId, useState } from "react";

import { CoastHeader } from "@/components/ui/coast-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row";
import { SelectMenu } from "@/components/ui/select-menu";
import { UI_TEXT } from "@/constants/messages";
import { SETTINGS_ROUTE } from "@/constants/navigation";
import { ACTIVITY_KIND_LABELS, ACTIVITY_KINDS, type ActivityKind } from "@/constants/statuses";
import { useTeam } from "@/features/team/hooks/useTeam";
import { addDaysKey, dayKey, todayKey } from "@/lib/dates/calendar";
import { byDay } from "@/lib/dates/group";
import { formatNearDate, formatTime } from "@/lib/format/date";

import { describeActivity, subjectOf } from "../describe";
import { useActivity } from "../hooks/useActivity";
import type { ActivityEntry } from "../types";
import { ActivitySheet } from "./ActivitySheet";

const { activity: words } = UI_TEXT;
const KINDS = ACTIVITY_KINDS.map((kind) => ({ value: kind, label: ACTIVITY_KIND_LABELS[kind] }));

/** A day's heading (D390): Today, Yesterday, then "28 Oct" — the year when it is not this one. */
function dayName(day: string): string {
  const today = todayKey();
  if (day === today) return words.today;
  if (day === addDaysKey(today, -1)) return words.yesterday;
  return formatNearDate(day);
}

/**
 * The clinic's activity — `/settings/activity` (plan §19; D387 – D390),
 * the owner's: who did what, when, the latest first, under day headings, a
 * page at a time, kept to a person and a kind by two menus. Each row is what
 * was done, the patient it was for by name and number, and who did it at
 * what time; it opens the whole change. Kept for the platform's
 * `audit_keep_days`; a view-only clinic reads it as ever.
 */
export function ActivityLog() {
  const [person, setPerson] = useState("");
  const [kind, setKind] = useState("");
  const [opened, setOpened] = useState<ActivityEntry | null>(null);
  const team = useTeam();
  const query = useActivity(person || null, (kind || null) as ActivityKind | null);
  const people = (team.data ?? []).map((member) => ({ value: member.userId, label: member.name }));

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={words.title} subtitle={words.subtitle} back={SETTINGS_ROUTE} />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 pb-8 md:px-8">
        <div className="grid max-w-3xl grid-cols-1 gap-6">
          <div className="flex flex-wrap gap-2">
            <SelectMenu
              variant="pill"
              label={words.person}
              value={person}
              placeholder={words.everyone}
              options={people}
              onChange={setPerson}
            />
            <SelectMenu
              variant="pill"
              label={words.kind}
              value={kind}
              placeholder={words.allKinds}
              options={KINDS}
              onChange={setKind}
            />
          </div>
          <ListScreen
            query={query}
            loadFailed="ACTIVITY_LOAD_FAILED"
            data={query.data}
            empty={<EmptyState icon={History} title={words.empty} />}
            noMatches={(person !== "" || kind !== "") && words.noMatches}
            renderList={(entries) => (
              <div className="grid gap-6">
                {byDay(entries, (entry) => dayKey(entry.at)).map(({ day, rows }) => (
                  <ActivityDay key={day} day={day} entries={rows} onOpen={setOpened} />
                ))}
              </div>
            )}
          />
        </div>
      </div>
      {opened && <ActivitySheet entry={opened} onClose={() => setOpened(null)} />}
    </>
  );
}

/** One day's rows under its heading (D390): each opens the whole change (D389). */
function ActivityDay({
  day,
  entries,
  onOpen,
}: {
  day: string;
  entries: ActivityEntry[];
  onOpen: (entry: ActivityEntry) => void;
}) {
  const headingId = useId();
  const name = dayName(day);
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-2 text-small font-bold text-muted">
        {name}
      </h2>
      <RowList label={name}>
        {entries.map((entry) => (
          <Row
            key={entry.id}
            onClick={() => onOpen(entry)}
            title={describeActivity(entry)}
            subtitle={subjectOf(entry) ?? undefined}
            note={`${entry.actorName ?? words.someone} · ${formatTime(entry.at)}`}
            wrap
          />
        ))}
      </RowList>
    </section>
  );
}
