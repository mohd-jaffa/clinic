"use client";

import { TriangleAlert } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Row, RowList } from "@/components/ui/row";
import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { dayKey } from "@/lib/dates/calendar";
import { formatDayMonth, formatTime } from "@/lib/format/date";
import type { ClosureDaysInput } from "@/lib/validation";

import { useClosureAppointments } from "../hooks/useClosureAppointments";

const { closures } = UI_TEXT;

/**
 * The appointments already on the days being picked for a holiday or leave
 * (D87, D137): how many, the first of them by time — the patient, when it
 * is, and with whom — and that they stay booked. Nothing is cancelled by
 * saving; they are moved or cancelled from the calendar. A patient the reader
 * may not see is "A patient". When the check cannot be made, it says so and
 * offers it again, rather than passing for "none".
 */
export function ClosureAppointments(days: ClosureDaysInput) {
  const { data, error, mutate } = useClosureAppointments(days);
  const titleId = useId();

  if (error && !data) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-3 text-small text-muted">
        <span>{ERROR_MESSAGES.CLOSURE_APPOINTMENTS_LOAD_FAILED}</span>
        <Button variant="quiet" size="sm" onClick={() => void mutate()}>
          {UI_TEXT.actions.retry}
        </Button>
      </div>
    );
  }
  if (!data?.total) return null;

  const more = data.total - data.appointments.length;
  return (
    <section aria-labelledby={titleId} className="grid gap-2.5 rounded-row bg-ground p-3">
      <div className="flex gap-2.5">
        <TriangleAlert size={20} strokeWidth={2.25} aria-hidden="true" className="mt-0.5 shrink-0 text-coral" />
        <div>
          <h3 id={titleId} className="text-small font-bold text-ink">
            {closures.appointmentsOnDays(data.total)}
          </h3>
          <p className="mt-0.5 text-small text-muted">{closures.appointmentsStay}</p>
        </div>
      </div>
      <RowList label={closures.appointmentsList}>
        {data.appointments.map((appointment) => (
          <Row
            key={appointment.id}
            title={appointment.patientName ?? closures.aPatient}
            subtitle={closures.appointmentWhen(
              formatDayMonth(dayKey(appointment.scheduledAt)),
              formatTime(appointment.scheduledAt),
              appointment.doctorName,
            )}
          />
        ))}
      </RowList>
      {more > 0 && <p className="text-small text-muted">{closures.moreAppointments(more)}</p>}
    </section>
  );
}
