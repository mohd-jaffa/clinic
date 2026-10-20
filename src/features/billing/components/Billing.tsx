"use client";

import { FilePlus2, IndianRupee } from "lucide-react";
import { useId, useState } from "react";

import { Button, LinkButton } from "@/components/ui/button";
import { CoastHeader } from "@/components/ui/coast-header";
import { PageHeader } from "@/components/ui/page-header";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { UI_TEXT } from "@/constants/messages";
import { ADD_FORMS, BILL_FROM, newBillRoute } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { BILLING_TAB_LABELS, BILLING_TABS, type BillingTab } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { useClinic } from "@/features/clinic/hooks/useClinic";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { useAddForm } from "@/hooks/useAddForm";
import { useOpened } from "@/hooks/useOpened";
import { todayRange, type DateRange } from "@/lib/dates/range";

import { useToBillCount } from "../hooks/useToBillCount";
import type { OutstandingPatient } from "../types";
import { BillsList, type BillsShown } from "./BillsList";
import { OutstandingList } from "./OutstandingList";
import { PaymentsList } from "./PaymentsList";
import { RecordPaymentSheet, type PayingPatient } from "./RecordPaymentSheet";
import { ToBillList } from "./ToBillList";

const { billing: words } = UI_TEXT;

/**
 * Billing — `/billing` (plan §15.4; D318 – D325, D334 – D336), for
 * `payments.view`: tabs for **To bill** — with how many wait — **Bills**,
 * **Payments** and **Outstanding**. Bills and Payments open on Today (D335)
 * and keep their days and state while another tab is looked at. **New bill**
 * and **Record payment** for whoever may bill; the ＋'s Payment arrives with
 * the sheet open, searching for the patient first (D323), and Outstanding's
 * Record payment opens it for the one who owes.
 */
export function Billing() {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const clinic = useClinic().data;
  const adding = useAddForm(ADD_FORMS.payment);
  const [tab, setTab] = useState<BillingTab>("TO_BILL");
  const [billDays, setBillDays] = useState<DateRange>(todayRange);
  const [billsShown, setBillsShown] = useState<BillsShown>("ALL");
  const [paymentDays, setPaymentDays] = useState<DateRange>(todayRange);
  const paying = useOpened<PayingPatient>();
  const tabsId = useId();
  const count = useToBillCount(true).data?.count;

  const mayBill = membership !== null && hasAccess(membership, "payments.create");
  const bills = mayBill && !readOnly;
  const options = BILLING_TABS.map((value) => ({
    value,
    label: BILLING_TAB_LABELS[value],
    ...(value === "TO_BILL" && { count }),
  }));
  const record = ({ patient, balancePaise }: OutstandingPatient) => paying.show({ ...patient, balancePaise });

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader
            title={UI_TEXT.nav.places.billing}
            actions={
              bills && (
                <div className="flex flex-wrap gap-2">
                  <LinkButton
                    href={newBillRoute(undefined, BILL_FROM.billing)}
                    label={words.newBill}
                    icon={FilePlus2}
                    size="sm"
                  />
                  <Button
                    label={words.recordPayment}
                    icon={IndianRupee}
                    variant="secondary"
                    size="sm"
                    onClick={adding.show}
                  />
                </div>
              )
            }
          />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 pb-8 md:px-8">
        <div className="grid max-w-3xl grid-cols-1 gap-6">
          {mayBill && <ReadOnlyNote />}
          <div>
            <Tabs id={tabsId} label={words.tabsLabel} value={tab} options={options} onChange={setTab} />
            <TabPanel id={tabsId} value={tab}>
              {tab === "TO_BILL" && <ToBillList />}
              {tab === "BILLS" && (
                <BillsList range={billDays} onRange={setBillDays} shown={billsShown} onShown={setBillsShown} />
              )}
              {tab === "PAYMENTS" && <PaymentsList range={paymentDays} onRange={setPaymentDays} />}
              {tab === "OUTSTANDING" && (
                <OutstandingList
                  clinic={{ name: clinic?.name ?? membership?.clinicName ?? "", phone: clinic?.phone ?? null }}
                  canRecord={bills}
                  onRecord={record}
                />
              )}
            </TabPanel>
          </div>
        </div>
      </div>
      {bills && (
        <>
          <RecordPaymentSheet open={adding.open} onClose={adding.close} />
          <RecordPaymentSheet key={paying.item?.id} open={paying.open} onClose={paying.close} patient={paying.item} />
        </>
      )}
    </>
  );
}
