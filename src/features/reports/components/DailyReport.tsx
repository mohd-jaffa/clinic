"use client";

import { DaySwitcher } from "@/components/ui/day-switcher";
import { UI_TEXT } from "@/constants/messages";
import { todayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";

import { useDailyReport } from "../hooks/useDailyReport";
import { FigureSection, ReportFrame } from "./ReportFrame";

const { reports: words } = UI_TEXT;

/**
 * Reports → Daily (plan §18; D345, D346, D356): a day — today to start, ‹ ›
 * a day at a time, the date opening the calendar, none after today — and
 * its figures: the patients seen, the appointments (the cancelled left
 * out), how many completed, cancelled and did not come; collected, billed,
 * spent and the net.
 */
export function DailyReport({ day, onDay }: { day: string; onDay: (day: string) => void }) {
  const query = useDailyReport(day);
  return (
    <div className="grid gap-6">
      <DaySwitcher
        label={words.dayLabel}
        day={day}
        onChange={onDay}
        max={todayKey()}
        chooseLabel={words.chooseDay}
        previousLabel={words.previousDay}
        nextLabel={words.nextDay}
      />
      <ReportFrame query={query} current={(report) => report.day === day}>
        {(report) => (
          <>
            <FigureSection
              title={words.patients}
              figures={[
                { label: words.patientsSeen, value: String(report.patientsSeen) },
                { label: words.appointments, value: String(report.appointments) },
                { label: words.completed, value: String(report.statuses.COMPLETED ?? 0) },
                { label: words.cancelled, value: String(report.statuses.CANCELLED ?? 0) },
                { label: words.noShows, value: String(report.statuses.NO_SHOW ?? 0) },
              ]}
            />
            <FigureSection
              title={words.money}
              figures={[
                { label: words.collected, value: formatPaise(report.collectedPaise) },
                { label: words.billed, value: formatPaise(report.billedPaise) },
                { label: words.expenses, value: formatPaise(report.expensesPaise) },
                { label: words.net, value: formatPaise(report.netPaise) },
              ]}
            />
          </>
        )}
      </ReportFrame>
    </div>
  );
}
