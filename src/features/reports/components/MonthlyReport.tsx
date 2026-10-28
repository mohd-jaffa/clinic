"use client";

import { BarChart } from "@/components/ui/bar-chart";
import { DonutChart, type DonutTone } from "@/components/ui/donut-chart";
import { MonthSwitcher } from "@/components/ui/month-switcher";
import { UI_TEXT } from "@/constants/messages";
import { addMonthsKey, monthStartKey, todayKey } from "@/lib/dates/calendar";
import { formatPaise, formatPaiseCompact } from "@/lib/format/currency";
import { formatShortDay } from "@/lib/format/date";

import { useMonthlyReport } from "../hooks/useMonthlyReport";
import { outcomesOf, type Outcome } from "../outcomes";
import { DoctorsMonth } from "./DoctorsMonth";
import { FigureSection, ReportFrame } from "./ReportFrame";

const { reports: words } = UI_TEXT;

/** Each part of the donut's name and colour (D355): green done, ink to come, coral not come, grey cancelled. */
const OUTCOME_LOOK: Record<Outcome, { label: string; tone: DonutTone }> = {
  COMPLETED: { label: words.completed, tone: "action" },
  STILL_TO_COME: { label: words.stillToCome, tone: "ink" },
  NO_SHOW: { label: words.noShows, tone: "coral" },
  CANCELLED: { label: words.cancelled, tone: "edge" },
};

/**
 * Reports → Monthly (plan §18; D345, D346, D354, D355): a month — this one to
 * start, ‹ › a month at a time, none after it — and its figures: the
 * patients seen, new and returning, and the appointments; collected,
 * billed, spent, the net and what is owed today. Then its two charts: each
 * day's collected above the line and expenses below it, and how the
 * month's appointments ended; then each doctor's month (D53).
 */
export function MonthlyReport({ month, onMonth }: { month: string; onMonth: (month: string) => void }) {
  const query = useMonthlyReport(month);
  return (
    <div className="grid gap-6">
      <MonthSwitcher
        label={words.monthLabel}
        month={month}
        onPrevious={() => onMonth(addMonthsKey(month, -1))}
        onNext={() => onMonth(addMonthsKey(month, 1))}
        previousLabel={words.previousMonth}
        nextLabel={words.nextMonth}
        latest={month >= monthStartKey(todayKey())}
      />
      <ReportFrame query={query} current={(report) => report.month === month}>
        {(report) => (
          <>
            <FigureSection
              title={words.patients}
              figures={[
                { label: words.patientsSeen, value: String(report.patientsSeen) },
                { label: words.newPatients, value: String(report.newPatients) },
                { label: words.returningPatients, value: String(report.returningPatients) },
                { label: words.appointments, value: String(report.appointments) },
              ]}
            />
            <FigureSection
              title={words.money}
              figures={[
                { label: words.collected, value: formatPaise(report.collectedPaise) },
                { label: words.billed, value: formatPaise(report.billedPaise) },
                { label: words.expenses, value: formatPaise(report.expensesPaise) },
                { label: words.net, value: formatPaise(report.netPaise) },
                { label: words.outstanding, value: formatPaise(report.outstandingPaise) },
              ]}
            />
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <BarChart
                title={words.byDay}
                hint={words.byDayHint}
                points={report.days.map((day) => ({
                  label: String(Number(day.day.slice(8))),
                  name: formatShortDay(day.day),
                  up: day.collectedPaise,
                  down: day.expensesPaise,
                }))}
                upName={words.collected}
                downName={words.expenses}
                format={formatPaise}
                formatAxis={formatPaiseCompact}
                text={{
                  keys: words.byDayKeys,
                  showTable: words.showTable,
                  hideTable: words.hideTable,
                  table: words.table,
                  column: words.dayColumn,
                }}
              />
              <DonutChart
                title={words.outcomes}
                parts={outcomesOf(report.statuses).map(({ outcome, count }) => ({
                  key: outcome,
                  value: count,
                  ...OUTCOME_LOOK[outcome],
                }))}
                total={words.outcomeTotal}
                empty={words.outcomesEmpty}
                share={words.share}
              />
            </div>
            <DoctorsMonth doctors={report.doctors} />
          </>
        )}
      </ReportFrame>
    </div>
  );
}
