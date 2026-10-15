"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT, WHATSAPP_TEXT } from "@/constants/messages";
import { useAuth } from "@/features/auth/AuthProvider";
import { getFile } from "@/lib/api/client";
import { saveFile } from "@/lib/download";
import { formatNearDate } from "@/lib/format/date";
import { apiRoutes, withQuery } from "@/lib/query/keys";
import { needsTap, openChat, shareFile, sharesFiles } from "@/lib/share";

import { prescriptionFileName } from "../names";

const { prescription: words } = UI_TEXT;

/**
 * **WhatsApp** for a visit's prescription (plan §22.1; D244 – D247): "Your
 * prescription from Dr. Maya Rao, Smile Care, 15 Oct." with the PDF, made by
 * the server when it is asked for and kept nowhere. On a phone the share
 * sheet takes both, and the person picks WhatsApp and the chat (D245); should
 * the phone want a fresh tap once the PDF is here, a card offers **Send**. On
 * a desktop the patient's chat opens on WhatsApp Web as the tap lands, and
 * the PDF downloads to attach (D246). Nothing is recorded (D247).
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
  const respond = useResponse();
  const { membership } = useAuth();
  const [sending, setSending] = useState(false);
  const name = prescriptionFileName(patient, day);
  const text = WHATSAPP_TEXT.prescription(
    doctor === null ? null : WHATSAPP_TEXT.doctor(doctor),
    membership?.clinicName ?? "",
    formatNearDate(day),
  );

  /** The share sheet with the file; a refusal for want of a tap offers Send, a fresh one. */
  const share = async (file: File) => {
    try {
      if (await shareFile(file, text)) respond.success({ title: words.shared });
    } catch (failure) {
      if (needsTap(failure)) {
        respond.info({
          title: words.readyTitle,
          message: words.readyBody,
          primary: { label: words.send, icon: Send, onClick: () => void share(file) },
        });
      } else {
        respond.failure(failure, { title: words.notSent, fallback: "SHARE_FAILED" });
      }
    }
  };

  const send = async () => {
    const sheet = sharesFiles();
    // Opened as the tap lands, so no browser takes it for a pop-up.
    if (!sheet) openChat(phone, text);
    setSending(true);
    let pdf: Blob;
    try {
      pdf = await getFile(withQuery(apiRoutes.visits.prescriptionPdf(visitId), { download: "1" }));
    } catch (failure) {
      respond.failure(failure, { title: words.notSent, fallback: "PRESCRIPTION_PDF_FAILED" });
      return;
    } finally {
      setSending(false);
    }
    if (sheet) {
      await share(new File([pdf], name, { type: "application/pdf" }));
    } else {
      saveFile(pdf, name);
      respond.success({ title: words.attachTitle, message: words.attachBody(name), autoClose: false });
    }
  };

  return { send, sending };
}
