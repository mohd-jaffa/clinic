"use client";

import { Download, MessageCircle, Printer } from "lucide-react";

import { Button, LinkButton } from "@/components/ui/button";
import { UI_TEXT } from "@/constants/messages";
import { apiRoutes } from "@/lib/query/keys";

import { useBillDownload } from "../hooks/useBillDownload";
import { useBillSend, type SentBill } from "../hooks/useBillSend";

const { bill: words } = UI_TEXT;

/**
 * **Print**, **Download** and **WhatsApp** for a bill (plan §15.5; D221,
 * D327): Print opens the PDF itself in the browser's own viewer, beside the
 * app; Download saves it; WhatsApp sends it to the patient with its total
 * and what is due (D341) — offered for a live bill only (`sent`), never a
 * void one.
 */
export function BillPdf({
  billId,
  patient,
  number,
  sent = null,
}: {
  billId: string;
  patient: string;
  number: string;
  sent?: SentBill | null;
}) {
  const { download, downloading } = useBillDownload({ billId, patient, number });
  const { send, sending } = useBillSend();
  return (
    <>
      <LinkButton
        href={apiRoutes.bills.pdf(billId)}
        file
        newTab
        label={words.print}
        accessibleName={words.printOf(number)}
        icon={Printer}
        variant="secondary"
        size="sm"
      />
      <Button
        label={words.download}
        aria-label={words.downloadOf(number)}
        icon={Download}
        variant="secondary"
        size="sm"
        loading={downloading}
        onClick={() => void download()}
      />
      {sent && (
        <Button
          label={words.whatsApp}
          aria-label={words.whatsAppOf(number)}
          icon={MessageCircle}
          variant="secondary"
          size="sm"
          loading={sending}
          onClick={() => void send(sent)}
        />
      )}
    </>
  );
}
