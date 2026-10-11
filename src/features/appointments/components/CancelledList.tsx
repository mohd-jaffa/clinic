import { CircleSlash } from "lucide-react";

import { Disclosure } from "@/components/ui/disclosure";
import { Row, RowList } from "@/components/ui/row";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from "@/constants/statuses";
import { formatDayMonth } from "@/lib/format/date";

import { kindOf, timeOf } from "../describe";
import type { CalendarAppointment } from "../types";

const { calendar } = UI_TEXT;

/**
 * The cancelled appointments and no-shows of what is shown, folded away and
 * counted (D153): the calendar shows what is still happening; these open on
 * asking, quiet, each with its status.
 */
export function CancelledList({
  appointments,
  showDay,
}: {
  appointments: readonly CalendarAppointment[];
  /** Name each one's day — the week's list. */
  showDay: boolean;
}) {
  if (appointments.length === 0) return null;
  return (
    <Disclosure
      label={calendar.cancelled(appointments.length)}
      showLabel={calendar.cancelled(appointments.length)}
      hideLabel={calendar.hideCancelled}
      icon={CircleSlash}
    >
      <RowList label={calendar.cancelled(appointments.length)}>
        {appointments.map((appointment) => (
          <Row
            key={appointment.id}
            look="quiet"
            title={appointment.patientName}
            subtitle={[showDay && formatDayMonth(appointment.day), timeOf(appointment), kindOf(appointment)]
              .filter(Boolean)
              .join(" · ")}
            trailing={
              <StatusPill
                label={APPOINTMENT_STATUS_LABELS[appointment.status]}
                tone={APPOINTMENT_STATUS_TONES[appointment.status]}
              />
            }
          />
        ))}
      </RowList>
    </Disclosure>
  );
}
