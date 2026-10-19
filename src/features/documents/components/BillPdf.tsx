"use client";

import { Download, Printer } from "lucide-react";

import { Button, LinkButton } from "@/components/ui/button";
import { UI_TEXT } from "@/constants/messages";
import { apiRoutes } from "@/lib/query/keys";

import { useBillDownload } from "../hooks/useBillDownload";

const { bill: words } = UI_TEXT;

/**
 * **Print** and **Download** for a bill (plan §15.5; D314): Print opens the
 * PDF itself in the browser's own viewer, beside the app; Download saves it.
 */
export function BillPdf({ billId, patient, number }: { billId: string; patient: string; number: string }) {
  const { download, downloading } = useBillDownload({ billId, patient, number });
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
    </>
  );
}
