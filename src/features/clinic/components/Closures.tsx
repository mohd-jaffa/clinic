"use client";

import { CalendarOff, History, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { Row, RowList } from "@/components/ui/row";
import { UI_TEXT } from "@/constants/messages";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { dayCount, todayKey } from "@/lib/dates/calendar";
import { formatDayRange } from "@/lib/format/date";

import { useClosureRemoval } from "../hooks/useClosureRemoval";
import { useClosures } from "../hooks/useClosures";
import type { Closure } from "../types";
import { CatalogueScreen } from "./CatalogueScreen";
import { ClosureSheet } from "./ClosureSheet";

const { closures } = UI_TEXT;
const title = UI_TEXT.settings.items.closures.label;

/**
 * Holidays and leave (plan §9, D84 – D87), for `settings.manage`: the days
 * the whole clinic, or one doctor, is away, which booking refuses. Those not
 * yet over are listed by their first day, each with **Remove** (asked
 * first); the past ones wait behind **Show past**, as a record. A closure is
 * never edited — removed and added again. In a view-only clinic it is shown,
 * not changed, and says why.
 */
export function Closures() {
  const query = useClosures();
  const today = todayKey();
  return (
    <CatalogueScreen
      title={title}
      subtitle={query.data && closures.count(query.data.filter((closure) => closure.endsOn >= today).length)}
      query={query}
      loadFailed="CLOSURES_LOAD_FAILED"
    >
      {(all) => <ClosureList all={all} today={today} />}
    </CatalogueScreen>
  );
}

function ClosureList({ all, today }: { all: readonly Closure[]; today: string }) {
  const { readOnly } = useReadOnly();
  const [adding, setAdding] = useState(false);
  const { remove, removing } = useClosureRemoval();
  const upcoming = all.filter((closure) => closure.endsOn >= today);
  // The latest first: what happened last is what is looked for.
  const past = all.filter((closure) => closure.endsOn < today).reverse();
  const add = !readOnly && <Button label={closures.add} icon={Plus} onClick={() => setAdding(true)} />;

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-8">
      <section aria-label={closures.upcoming}>
        {upcoming.length === 0 ? (
          <EmptyState icon={CalendarOff} title={closures.emptyTitle} hint={closures.emptyHint} action={add} />
        ) : (
          <>
            <RowList look="menu" label={closures.upcoming}>
              {upcoming.map((closure) => (
                <ClosureRow
                  key={closure.id}
                  closure={closure}
                  today={today}
                  onRemove={readOnly ? undefined : () => void remove(closure)}
                  removing={removing === closure.id}
                />
              ))}
            </RowList>
            {add && <div className="mt-5">{add}</div>}
          </>
        )}
        <ReadOnlyNote />
      </section>
      {past.length > 0 && (
        <Disclosure
          label={closures.past}
          showLabel={closures.showPast(past.length)}
          hideLabel={closures.hidePast}
          icon={History}
        >
          <RowList look="menu" label={closures.past}>
            {past.map((closure) => (
              <ClosureRow key={closure.id} closure={closure} today={today} />
            ))}
          </RowList>
        </Disclosure>
      )}
      <ClosureSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

/** One closure: why, who and when, how many days — and, not yet over, **Remove**. */
function ClosureRow({
  closure,
  today,
  onRemove,
  removing,
}: {
  closure: Closure;
  today: string;
  onRemove?: () => void;
  removing?: boolean;
}) {
  return (
    <Row
      look="menu"
      title={closure.reason}
      subtitle={`${closure.doctorName ?? closures.wholeClinic} · ${formatDayRange(closure.startsOn, closure.endsOn, today)}`}
      detail={closures.days(dayCount(closure.startsOn, closure.endsOn))}
      trailing={
        onRemove && (
          <IconButton
            icon={Trash2}
            label={closures.removeNamed(closure.reason)}
            onClick={onRemove}
            disabled={removing}
          />
        )
      }
    />
  );
}
