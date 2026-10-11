import { CalendarDays, CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Row, RowList } from "@/components/ui/row";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES } from "@/constants/statuses";
import { formatTime } from "@/lib/format/date";

import { kindOf } from "../describe";
import type { CalendarAppointment } from "../types";

const { calendar, appointments: words } = UI_TEXT;

/**
 * A day as a list by time — the phone's calendar (plan §11.5): each
 * appointment's time, patient, kind (its type, or Walk-in and its token, D154),
 * the doctor while every doctor's are shown, and its status. A day with
 * nothing booked says so, with **Book appointment** for whoever may.
 */
export function DayList({
  label,
  appointments,
  showDoctor,
  onBook,
}: {
  /** The day it is: "Appointments, Monday, 12 Oct 2026". */
  label: string;
  appointments: readonly CalendarAppointment[];
  showDoctor: boolean;
  /** None for someone who may not book now. */
  onBook?: () => void;
}) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={calendar.nothingBooked}
        hint={calendar.nothingBookedHint}
        action={onBook && <Button label={words.book} icon={CalendarPlus} onClick={onBook} />}
      />
    );
  }
  return (
    <RowList label={label}>
      {appointments.map((appointment) => (
        <Row
          key={appointment.id}
          title={appointment.patientName}
          subtitle={[formatTime(appointment.scheduledAt), kindOf(appointment), showDoctor && appointment.doctorName]
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
  );
}
