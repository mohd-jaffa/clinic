import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { services } from "@/features/clinic/catalogues";
import { PriceList } from "@/features/clinic/components/PriceList";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.settings.items.priceList.label };

export default function PriceListPage() {
  return (
    <AppScreen access="settings.manage" queries={{ [apiRoutes.services.list]: services.list }}>
      <PriceList />
    </AppScreen>
  );
}
