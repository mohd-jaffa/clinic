import { CalendarGrid, type GridColumn, type GridItem } from "@/components/ui/calendar-grid";
import { CALENDAR_STEP_MINUTES } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import type { Closure } from "@/features/clinic/types";
import type { Doctor } from "@/features/team/types";
import { addDaysKey, minutesOfDay, todayKey } from "@/lib/dates/calendar";
import { formatDayMonth, formatDayRange, formatLongDate } from "@/lib/format/date";

import { closuresOn, gridHours, minutesOf } from "../calendar";
import { sayAppointment } from "../describe";
import type { CalendarAppointment } from "../types";
import { AppointmentBlock } from "./AppointmentBlock";

const { calendar, datePicker } = UI_TEXT;

/** Where a tap may book from on a day (D156): nothing on a day passed, today's from the step it is now. */
function pickableFrom(day: string): number | undefined {
  const today = todayKey();
  if (day < today) return Number.POSITIVE_INFINITY;
  if (day > today) return undefined;
  return Math.floor(minutesOfDay() / 5) * 5;
}

/**
 * The calendar on a tablet or a desktop (plan §11.5): a day with a column for
 * each doctor shown, or one doctor's week, Monday to Sunday, a column a day
 * (D158). The hours run 8 AM to 8 PM, stretching to fit (D152). A clinic
 * holiday shades every column, a doctor's leave theirs. A tap on an empty
 * quarter books there, the doctor and day filled (D156) — never on a closed
 * column, nor in the past.
 */
export function CalendarBoard({
  view,
  day,
  week,
  doctorId,
  doctors,
  closures,
  appointments,
  onPick,
}: {
  view: "DAY" | "WEEK";
  day: string;
  week: { from: string; to: string };
  /** The doctor shown — none for every doctor, on a day. */
  doctorId: string;
  doctors: readonly Doctor[];
  closures: readonly Closure[];
  /** What is shown, live ones only (D153). */
  appointments: readonly CalendarAppointment[];
  onPick?: (booking: { doctorId: string; date: string; minutes: number }) => void;
}) {
  const { from, to } = gridHours(appointments);
  const today = todayKey();
  const nameOf = (id: string) =>
    doctors.find((doctor) => doctor.id === id)?.name ??
    appointments.find((appointment) => appointment.doctorId === id)?.doctorName ??
    "";

  let columns: GridColumn[];
  let label: string;
  if (view === "DAY") {
    const closed = closuresOn(closures, day);
    // Every doctor shown — the active ones, and any no longer on the team who still have this day's appointments.
    const shown = doctorId
      ? [doctorId]
      : [
          ...new Set([
            ...doctors.map((doctor) => doctor.id),
            ...appointments.map((appointment) => appointment.doctorId),
          ]),
        ];
    columns = shown.map((id) => {
      const leave = closed.leave(id);
      return {
        key: id,
        title: nameOf(id),
        closed: closed.clinic ? calendar.away(closed.clinic.reason) : leave ? calendar.away(leave.reason) : undefined,
        pickableFrom: pickableFrom(day),
      };
    });
    label = calendar.dayGrid(formatLongDate(day));
  } else {
    columns = Array.from({ length: 7 }, (_, index) => {
      const date = addDaysKey(week.from, index);
      const closed = closuresOn(closures, date);
      const leave = closed.leave(doctorId);
      return {
        key: date,
        title: calendar.weekDay(datePicker.weekdaysAbbr[index], formatDayMonth(date)),
        subtitle: date === today ? calendar.today : undefined,
        today: date === today,
        closed: closed.clinic ? calendar.away(closed.clinic.reason) : leave ? calendar.away(leave.reason) : undefined,
        pickableFrom: pickableFrom(date),
      };
    });
    label = calendar.weekGrid(nameOf(doctorId), formatDayRange(week.from, week.to));
  }

  const items: GridItem[] = appointments.map((appointment) => ({
    key: appointment.id,
    column: view === "DAY" ? appointment.doctorId : appointment.day,
    ...minutesOf(appointment),
    label: sayAppointment(appointment),
    content: <AppointmentBlock appointment={appointment} />,
  }));

  return (
    <CalendarGrid
      label={label}
      columns={columns}
      from={from}
      to={to}
      step={CALENDAR_STEP_MINUTES}
      items={items}
      columnWidth={view === "DAY" ? "wide" : "narrow"}
      onPick={
        onPick &&
        ((column, minutes) =>
          onPick(view === "DAY" ? { doctorId: column, date: day, minutes } : { doctorId, date: column, minutes }))
      }
    />
  );
}
