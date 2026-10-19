import type { Metadata } from "next";

import { AppScreen } from "@/components/nav/AppScreen";
import { UI_TEXT } from "@/constants/messages";
import { getBill } from "@/features/billing/api";
import { BillScreen } from "@/features/billing/components/BillScreen";
import { apiRoutes } from "@/lib/query/keys";

export const metadata: Metadata = { title: UI_TEXT.bill.title };

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppScreen access="payments.view" queries={{ [apiRoutes.bills.one(id)]: (tenant) => getBill(tenant, id) }}>
      <BillScreen id={id} />
    </AppScreen>
  );
}
