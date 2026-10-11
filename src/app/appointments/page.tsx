import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { Appointments } from "@/features/appointments/components/Appointments";
import { appointmentTypes } from "@/features/clinic/catalogues";
import { listDoctors } from "@/features/team/api";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.nav.places.appointments };

export default function AppointmentsPage() {
  return (
    <AppScreen
      access="appointments.view"
      queries={{ [apiRoutes.doctors.list]: listDoctors, [apiRoutes.appointmentTypes.list]: appointmentTypes.list }}
    >
      <Appointments />
    </AppScreen>
  );
}
