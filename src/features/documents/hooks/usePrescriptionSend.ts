"use client";

import { UI_TEXT, WHATSAPP_TEXT } from "@/constants/messages";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatNearDate } from "@/lib/format/date";
import { apiRoutes } from "@/lib/query/keys";

import { prescriptionFileName } from "../names";
import { usePdfSend } from "./usePdfSend";

/**
 * **WhatsApp** for a visit's prescription (plan §22.1; D244 – D247): "Your
 * prescription from Dr. Maya Rao, Smile Care, 15 Oct." with the PDF — the
 * share sheet on a phone, WhatsApp Web and a download on a desktop
 * (`usePdfSend`).
 */
export function usePrescriptionSend({
  visitId,
  patient,
  phone,
  day,
  doctor,
}: {
  visitId: string;
  patient: string;
  /** The patient's mobile, +91 E.164. */
  phone: string;
  day: string;
  /** None once the doctor's account is gone. */
  doctor: string | null;
}) {
  const { membership } = useAuth();
  const sending = usePdfSend(UI_TEXT.prescription, "PRESCRIPTION_PDF_FAILED");
  const text = WHATSAPP_TEXT.prescription(
    doctor === null ? null : WHATSAPP_TEXT.doctor(doctor),
    membership?.clinicName ?? "",
    formatNearDate(day),
  );
  return {
    send: () =>
      sending.send({
        pdf: apiRoutes.visits.prescriptionPdf(visitId),
        name: prescriptionFileName(patient, day),
        phone,
        text,
      }),
    sending: sending.sending,
  };
}
