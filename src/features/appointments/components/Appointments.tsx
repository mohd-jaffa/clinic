"use client";

import { CalendarPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import { ADD_FORMS } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { useClosures } from "@/features/clinic/hooks/useClosures";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { useDoctors } from "@/features/team/hooks/useDoctors";
import { useAddForm } from "@/hooks/useAddForm";
import { todayKey } from "@/lib/dates/calendar";
import { formatLongDate } from "@/lib/format/date";

import { closuresOn, firstDoctorFilter, isLive, weekOf } from "../calendar";
import { useAppointments } from "../hooks/useAppointments";
import { useOpenedAppointment } from "../hooks/useOpenedAppointment";
import { AppointmentPanel } from "./AppointmentPanel";
import { BookingSheet, type BookingPrefill } from "./BookingSheet";
import { CalendarBoard } from "./CalendarBoard";
import { CalendarToolbar, type CalendarView } from "./CalendarToolbar";
import { CancelledList } from "./CancelledList";
import { ClosureNotices } from "./ClosureNotices";
import { DayList } from "./DayList";

const { calendar } = UI_TEXT;

/**
 * Appointments — the calendar (plan §11.5; D152 – D159). It opens on today:
 * every doctor for the front desk, a doctor their own (D155). On a phone, the
 * day as a list by time under a date strip; on a tablet or a desktop, a day
 * with a column per doctor, or one doctor's week. Holidays and leave are said
 * and shaded; cancelled appointments and no-shows wait, counted, at the foot
 * (D153); walk-ins show at the time they arrived (D154).
 *
 * **Book appointment** — or the ＋'s Appointment (D67), or a tap on an empty
 * quarter of the grid with its doctor, day and time (D156) — opens the
 * booking sheet, for whoever may book, while the clinic can write. A tap on
 * an appointment opens its detail, with what its status allows (D160).
 */
export function Appointments() {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const adding = useAddForm(ADD_FORMS.appointment);
  const doctors = useDoctors().data ?? [];
  const closures = useClosures().data ?? [];
  const [day, setDay] = useState(todayKey);
  const [view, setView] = useState<CalendarView>("DAY");
  const [doctorId, setDoctorId] = useState(() => (membership ? firstDoctorFilter(membership) : ""));
  const [prefill, setPrefill] = useState<{ count: number; values?: BookingPrefill }>({ count: 0 });
  const opened = useOpenedAppointment();

  const week = weekOf(day);
  const range = view === "WEEK" ? week : { from: day, to: day };
  const query = useAppointments(range.from, range.to, doctorId);
  const shown = query.data ?? [];
  const live = shown.filter((appointment) => isLive(appointment.status));
  const folded = shown.filter((appointment) => !isLive(appointment.status));

  const canBook = membership !== null && hasAccess(membership, "appointments.create");
  const books = canBook && !readOnly;
  const book = (values?: BookingPrefill) => {
    setPrefill(({ count }) => ({ count: count + 1, values }));
    adding.show();
  };
  // A week is one doctor's (D158): from every doctor's, it shows the first.
  const switchView = (next: CalendarView) => {
    if (next === "WEEK" && !doctorId && doctors.length > 0) setDoctorId(doctors[0].id);
    setView(next);
  };

  const closedToday = closuresOn(closures, day);
  const notices = [
    ...(closedToday.clinic ? [calendar.clinicClosed(closedToday.clinic.reason)] : []),
    ...closedToday.all
      .filter((closure) => closure.doctorId !== null && (!doctorId || closure.doctorId === doctorId))
      .map((closure) => {
        const name = closure.doctorName ?? doctors.find((doctor) => doctor.id === closure.doctorId)?.name;
        return name ? calendar.doctorAway(name, closure.reason) : calendar.away(closure.reason);
      }),
  ];

  let body;
  if (query.data === undefined && query.error != null) {
    body = <LoadFailed query={query} loadFailed="APPOINTMENTS_LOAD_FAILED" />;
  } else if (query.data === undefined) {
    body = (
      <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
        <SkeletonRows />
      </section>
    );
  } else {
    body = (
      <>
        <div className="md:hidden">
          <DayList
            label={calendar.dayGrid(formatLongDate(day))}
            appointments={live.filter((appointment) => appointment.day === day)}
            showDoctor={!doctorId}
            onBook={books ? () => book() : undefined}
            onOpen={opened.show}
          />
        </div>
        <div className="hidden md:block">
          <CalendarBoard
            view={view}
            day={day}
            week={week}
            doctorId={doctorId}
            doctors={doctors}
            closures={closures}
            appointments={live}
            onPick={
              books
                ? ({ doctorId: doctor, date, minutes }) =>
                    book({
                      doctorId: doctor,
                      date,
                      time: {
                        hour: String(Math.floor(minutes / 60)).padStart(2, "0"),
                        minute: String(minutes % 60).padStart(2, "0"),
                      },
                    })
                : undefined
            }
            onOpen={opened.show}
          />
        </div>
        <CancelledList appointments={folded} showDay={view === "WEEK"} onOpen={opened.show} />
      </>
    );
  }

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={UI_TEXT.nav.places.appointments} />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        <div className="grid grid-cols-1 gap-5">
          {canBook && (
            <div>
              {!readOnly && <Button label={UI_TEXT.appointments.book} icon={CalendarPlus} onClick={() => book()} />}
              <ReadOnlyNote />
            </div>
          )}
          <CalendarToolbar
            view={view}
            onView={switchView}
            day={day}
            onDay={setDay}
            doctorId={doctorId}
            onDoctor={setDoctorId}
            doctors={doctors}
          />
          {view === "DAY" && <ClosureNotices notices={notices} />}
          {body}
        </div>
      </div>
      {books && <BookingSheet key={prefill.count} prefill={prefill.values} open={adding.open} onClose={adding.close} />}
      <AppointmentPanel
        key={opened.appointment?.id}
        appointment={opened.appointment}
        open={opened.open}
        onClose={opened.close}
      />
    </>
  );
}
