"use client";

import { Download, Printer } from "lucide-react";

import { Button, LinkButton } from "@/components/ui/button";
import { UI_TEXT } from "@/constants/messages";
import { apiRoutes } from "@/lib/query/keys";

import { usePrescriptionDownload } from "../hooks/usePrescriptionDownload";

const { prescription: words } = UI_TEXT;

/**
 * **Print** and **Download** for a saved prescription (D221, D222): Print
 * opens the PDF itself in the browser's own viewer, beside the app — what it
 * shows is the file, with its own print button; Download saves it.
 */
export function PrescriptionPdf({ visitId, patient, day }: { visitId: string; patient: string; day: string }) {
  const { download, downloading } = usePrescriptionDownload({ visitId, patient, day });
  return (
    <>
      <LinkButton
        href={apiRoutes.visits.prescriptionPdf(visitId)}
        file
        newTab
        label={words.print}
        accessibleName={words.printOf(patient)}
        icon={Printer}
        variant="secondary"
        size="sm"
      />
      <Button
        label={words.download}
        aria-label={words.downloadOf(patient)}
        icon={Download}
        variant="secondary"
        size="sm"
        loading={downloading}
        onClick={() => void download()}
      />
    </>
  );
}
