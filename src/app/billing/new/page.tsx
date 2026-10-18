import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { getBillStart } from "@/features/billing/api";
import { NewBill } from "@/features/billing/components/NewBill";
import { billStartKey, billTargetIn } from "@/features/billing/keys";
import { services } from "@/features/clinic/catalogues";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.billing.newBill };

export default async function NewBillPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const target = billTargetIn(await searchParams);
  return (
    <AppScreen
      access="payments.create"
      queries={{
        [apiRoutes.services.list]: services.list,
        ...(target && { [billStartKey(target)]: (tenant) => getBillStart(tenant, target) }),
      }}
    >
      <NewBill />
    </AppScreen>
  );
}
