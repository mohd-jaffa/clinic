import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { getClinic } from "@/features/clinic/api";
import { appointmentTypes } from "@/features/clinic/catalogues";
import { listAlerts } from "@/features/patients/alerts";
import { getPatient } from "@/features/patients/api";
import { PatientProfile } from "@/features/patients/components/PatientProfile";
import { getPatientSummary } from "@/features/patients/summary";
import { listPatientTimeline } from "@/features/patients/timeline";
import { listDoctors } from "@/features/team/api";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.nav.places.patients };

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppScreen
      access="patients.view"
      queries={{
        [apiRoutes.patients.one(id)]: (tenant) => getPatient(tenant, id),
        [apiRoutes.patients.alerts(id)]: (tenant) => listAlerts(tenant, id),
        [apiRoutes.patients.summary(id)]: (tenant) => getPatientSummary(tenant, id),
        // Whether an arrival goes on to Collect fee (D283, D305).
        [apiRoutes.clinic.profile]: getClinic,
        [apiRoutes.doctors.list]: listDoctors,
        [apiRoutes.appointmentTypes.list]: appointmentTypes.list,
      }}
      pages={{ [apiRoutes.patients.timeline(id)]: (tenant) => listPatientTimeline(tenant, id) }}
    >
      <PatientProfile id={id} />
    </AppScreen>
  );
}
