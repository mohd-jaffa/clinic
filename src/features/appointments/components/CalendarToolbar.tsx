"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button, IconButton } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { DateStrip } from "@/components/ui/date-strip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectMenu } from "@/components/ui/select-menu";
import { DATE_STRIP_DAYS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import type { Doctor } from "@/features/team/types";
import { addDaysKey, daysFrom, todayKey } from "@/lib/dates/calendar";
import { formatDayRange, formatLongDate } from "@/lib/format/date";

import { weekOf } from "../calendar";

const { calendar } = UI_TEXT;

export type CalendarView = "DAY" | "WEEK";
const VIEWS = (["DAY", "WEEK"] as const).map((view) => ({ value: view, label: calendar.views[view] }));

/**
 * The days the phone's strip offers (D157): a week back to four weeks ahead
 * of today — or of a day chosen outside that, through the calendar beside it.
 */
export function stripDays(day: string, today: string = todayKey()): string[] {
  const around =
    day < addDaysKey(today, -DATE_STRIP_DAYS.back) || day > addDaysKey(today, DATE_STRIP_DAYS.ahead) ? day : today;
  return daysFrom(addDaysKey(around, -DATE_STRIP_DAYS.back), addDaysKey(around, DATE_STRIP_DAYS.ahead));
}

/**
 * What the calendar shows, and for when (plan §11.5): the doctor — every
 * doctor, or one; a week is always one doctor's (D158) — the day or the week
 * on a wider screen, and the day: the strip on a phone (D157), Today and the
 * arrows on a wider one, and the calendar for any day, everywhere.
 */
export function CalendarToolbar({
  view,
  onView,
  day,
  onDay,
  doctorId,
  onDoctor,
  doctors,
}: {
  view: CalendarView;
  onView: (view: CalendarView) => void;
  day: string;
  onDay: (day: string) => void;
  doctorId: string;
  onDoctor: (doctorId: string) => void;
  doctors: readonly Doctor[];
}) {
  const step = view === "DAY" ? 1 : 7;
  const week = view === "WEEK";
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SelectMenu
          variant="pill"
          label={calendar.doctor}
          value={doctorId}
          placeholder={week ? undefined : calendar.allDoctors}
          options={doctors.map(({ id, name }) => ({ value: id, label: name }))}
          onChange={onDoctor}
        />
        <div className="hidden w-48 md:block">
          <SegmentedControl label={calendar.view} value={view} options={VIEWS} onChange={onView} />
        </div>
        <div className="ml-auto">
          <DatePicker variant="pill" label={calendar.chooseDay} value={day} onChange={onDay} />
        </div>
      </div>
      <div className="md:hidden">
        <DateStrip label={calendar.day} value={day} days={stripDays(day)} onChange={onDay} />
      </div>
      <div className="hidden items-center gap-2 md:flex">
        <Button variant="secondary" size="sm" label={calendar.today} onClick={() => onDay(todayKey())} />
        <IconButton
          icon={ChevronLeft}
          label={week ? calendar.previousWeek : calendar.previousDay}
          onClick={() => onDay(addDaysKey(day, -step))}
        />
        <IconButton
          icon={ChevronRight}
          label={week ? calendar.nextWeek : calendar.nextDay}
          onClick={() => onDay(addDaysKey(day, step))}
        />
        <h2 className="ml-1 text-title font-bold text-ink">
          {week ? formatDayRange(weekOf(day).from, weekOf(day).to) : formatLongDate(day)}
        </h2>
      </div>
    </div>
  );
}
