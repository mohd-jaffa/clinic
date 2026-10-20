"use client";

import { MAX_RANGE_DAYS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { DATE_RANGE_LABELS, DATE_RANGES } from "@/constants/statuses";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { presetRange, type DateRange } from "@/lib/dates/range";

import { ChoiceChips } from "./choice-chips";
import { DateField } from "./date-field";

const { ranges } = UI_TEXT;
const OPTIONS = DATE_RANGES.map((kind) => ({ value: kind, label: DATE_RANGE_LABELS[kind] }));

/**
 * A list's days (D320): **Today**, **7 days**, **This month**, or **Pick
 * dates** — a From and a To, the days a chip last stood for to start from,
 * never after today, never the last before the first, and no more than
 * MAX_RANGE_DAYS apart.
 */
export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  const today = todayKey();
  return (
    <div className="grid gap-3">
      <ChoiceChips
        label={ranges.label}
        value={value.kind}
        options={OPTIONS}
        onChange={(kind) => onChange(kind === "CUSTOM" ? { ...value, kind } : { kind, ...presetRange(kind, today) })}
      />
      {value.kind === "CUSTOM" && (
        <div className="grid grid-cols-2 gap-3">
          <DateField
            label={ranges.from}
            value={value.from}
            min={addDaysKey(value.to, 1 - MAX_RANGE_DAYS)}
            max={value.to}
            onChange={(from) => onChange({ ...value, from })}
          />
          <DateField
            label={ranges.to}
            value={value.to}
            min={value.from}
            max={today}
            onChange={(to) => onChange({ ...value, to })}
          />
        </div>
      )}
    </div>
  );
}
