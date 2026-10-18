import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { listQueue } from "@/features/appointments/api";
import { firstDoctorFilter } from "@/features/appointments/calendar";
import { Queue } from "@/features/appointments/components/Queue";
import { queueKey } from "@/features/appointments/keys";
import { getClinic } from "@/features/clinic/api";
import { appointmentTypes } from "@/features/clinic/catalogues";
import { listDoctors } from "@/features/team/api";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.nav.places.queue };

export default function QueuePage() {
  return (
    <AppScreen
      access="appointments.view"
      queries={(tenant) => {
        const doctorId = firstDoctorFilter(tenant);
        return {
          // Whether an arrival goes on to Collect fee (D283, D305).
          [apiRoutes.clinic.profile]: getClinic,
          [apiRoutes.doctors.list]: listDoctors,
          [apiRoutes.appointmentTypes.list]: appointmentTypes.list,
          [queueKey(doctorId)]: (member) => listQueue(member, { doctorId: doctorId || undefined }),
        };
      }}
    >
      <Queue />
    </AppScreen>
  );
}
