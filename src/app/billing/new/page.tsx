import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { getBill, getBillStart } from "@/features/billing/api";
import { NewBill } from "@/features/billing/components/NewBill";
import { billStartKey, billTargetIn, reissueIn } from "@/features/billing/keys";
import { services } from "@/features/clinic/catalogues";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.billing.newBill };

export default async function NewBillPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const target = billTargetIn(params);
  const reissue = target && reissueIn(params);
  return (
    <AppScreen
      access="payments.create"
      queries={{
        [apiRoutes.services.list]: services.list,
        ...(target && { [billStartKey(target)]: (tenant) => getBillStart(tenant, target) }),
        ...(reissue && { [apiRoutes.bills.one(reissue)]: (tenant) => getBill(tenant, reissue) }),
      }}
    >
      <NewBill />
    </AppScreen>
  );
}
