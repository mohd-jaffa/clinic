import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { listAppointments } from "@/features/appointments/api";
import { firstDoctorFilter } from "@/features/appointments/calendar";
import { Appointments } from "@/features/appointments/components/Appointments";
import { calendarKey } from "@/features/appointments/keys";
import { getClinic } from "@/features/clinic/api";
import { appointmentTypes } from "@/features/clinic/catalogues";
import { listClosures } from "@/features/clinic/closures";
import { listDoctors } from "@/features/team/api";
import { todayKey } from "@/lib/dates/calendar";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.nav.places.appointments };

export default function AppointmentsPage() {
  return (
    <AppScreen
      access="appointments.view"
      queries={(tenant) => {
        const today = todayKey();
        const doctorId = firstDoctorFilter(tenant);
        return {
          // Whether an arrival goes on to Collect fee (D283, D305).
          [apiRoutes.clinic.profile]: getClinic,
          [apiRoutes.doctors.list]: listDoctors,
          [apiRoutes.appointmentTypes.list]: appointmentTypes.list,
          [apiRoutes.closures.list]: listClosures,
          [calendarKey(today, today, doctorId)]: (member) =>
            listAppointments(member, { from: today, to: today, doctorId: doctorId || undefined }),
        };
      }}
    >
      <Appointments />
    </AppScreen>
  );
}
