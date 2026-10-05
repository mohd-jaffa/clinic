import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { ROUTE_ACCESS } from "@/constants/permissions";
import { PatientImport } from "@/features/patients/components/PatientImport";
import { getImportLimits } from "@/features/patients/import";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.patientImport.title };

export default function ImportPage() {
  return (
    <AppScreen access={ROUTE_ACCESS.owner} queries={{ [apiRoutes.patients.import]: getImportLimits }}>
      <PatientImport />
    </AppScreen>
  );
}
