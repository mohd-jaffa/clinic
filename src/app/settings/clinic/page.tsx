import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { getClinic } from "@/features/clinic/api";
import { ClinicDetails } from "@/features/clinic/components/ClinicDetails";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.settings.items.clinic.label };

export default function ClinicDetailsPage() {
  return (
    <AppScreen access="settings.manage" queries={{ [apiRoutes.clinic.profile]: getClinic }}>
      <ClinicDetails />
    </AppScreen>
  );
}
