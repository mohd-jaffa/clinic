import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { countToBill, listToBill } from "@/features/billing/checkout";
import { Billing } from "@/features/billing/components/Billing";
import { toBillCountKey, toBillKey } from "@/features/billing/keys";
import { getClinic } from "@/features/clinic/api";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.nav.places.billing };

export default function BillingPage() {
  return (
    <AppScreen
      access="payments.view"
      queries={{
        [toBillCountKey()]: (tenant) => countToBill(tenant, {}),
        [apiRoutes.clinic.profile]: getClinic,
      }}
      pages={{ [toBillKey()]: (tenant) => listToBill(tenant, {}) }}
    >
      <Billing />
    </AppScreen>
  );
}
