import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { listPatients } from "@/features/patients/api";
import { Patients } from "@/features/patients/components/Patients";
import { patientsKey } from "@/features/patients/keys";
import { listDoctors } from "@/features/team/api";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.nav.places.patients };

export default function PatientsPage() {
  return (
    <AppScreen
      access="patients.view"
      queries={{ [apiRoutes.doctors.list]: listDoctors }}
      pages={{ [patientsKey("", "ALL")]: (tenant) => listPatients(tenant, { search: null, tab: "ALL" }) }}
    >
      <Patients />
    </AppScreen>
  );
}
