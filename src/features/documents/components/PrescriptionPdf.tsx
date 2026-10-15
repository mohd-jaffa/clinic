"use client";

import { Download, MessageCircle, Printer } from "lucide-react";

import { Button, LinkButton } from "@/components/ui/button";
import { UI_TEXT } from "@/constants/messages";
import { apiRoutes } from "@/lib/query/keys";

import { usePrescriptionDownload } from "../hooks/usePrescriptionDownload";
import { usePrescriptionSend } from "../hooks/usePrescriptionSend";

const { prescription: words } = UI_TEXT;

/**
 * **Print**, **Download** and **WhatsApp** for a saved prescription (D221,
 * D222, D244): Print opens the PDF itself in the browser's own viewer, beside
 * the app — what it shows is the file, with its own print button; Download
 * saves it; WhatsApp sends it to the patient (D245, D246).
 */
export function PrescriptionPdf({
  visitId,
  patient,
  phone,
  day,
  doctor,
}: {
  visitId: string;
  patient: string;
  /** The patient's mobile, where WhatsApp sends it. */
  phone: string;
  day: string;
  /** The visit's doctor, named in the message; none once gone. */
  doctor: string | null;
}) {
  const { download, downloading } = usePrescriptionDownload({ visitId, patient, day });
  const { send, sending } = usePrescriptionSend({ visitId, patient, phone, day, doctor });
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
      <Button
        label={words.whatsApp}
        aria-label={words.whatsAppOf(patient)}
        icon={MessageCircle}
        variant="secondary"
        size="sm"
        loading={sending}
        onClick={() => void send()}
      />
    </>
  );
}
