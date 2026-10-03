import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { appointmentTypes } from "@/features/clinic/catalogues";
import { AppointmentTypes } from "@/features/clinic/components/AppointmentTypes";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.settings.items.appointmentTypes.label };

export default function AppointmentTypesPage() {
  return (
    <AppScreen access="settings.manage" queries={{ [apiRoutes.appointmentTypes.list]: appointmentTypes.list }}>
      <AppointmentTypes />
    </AppScreen>
  );
}
