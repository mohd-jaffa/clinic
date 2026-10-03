import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { listClosures } from "@/features/clinic/closures";
import { Closures } from "@/features/clinic/components/Closures";
import { listDoctors } from "@/features/team/api";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.settings.items.closures.label };

export default function ClosuresPage() {
  return (
    <AppScreen
      access="settings.manage"
      queries={{ [apiRoutes.closures.list]: listClosures, [apiRoutes.doctors.list]: listDoctors }}
    >
      <Closures />
    </AppScreen>
  );
}
