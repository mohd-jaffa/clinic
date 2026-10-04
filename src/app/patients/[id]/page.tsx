import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { listAlerts } from "@/features/patients/alerts";
import { getPatient } from "@/features/patients/api";
import { PatientProfile } from "@/features/patients/components/PatientProfile";
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
        [apiRoutes.doctors.list]: listDoctors,
      }}
    >
      <PatientProfile id={id} />
    </AppScreen>
  );
}
