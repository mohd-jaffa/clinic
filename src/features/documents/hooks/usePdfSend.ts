"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import type { ErrorMessageCode } from "@/constants/messages";
import { getFile } from "@/lib/api/client";
import { saveFile } from "@/lib/download";
import { withQuery } from "@/lib/query/keys";
import { needsTap, openChat, shareFile, sharesFiles } from "@/lib/share";

/** What a document's card says as it is sent: shared, ready for a fresh tap, to attach, or not sent. */
export interface PdfSendWords {
  shared: string;
  readyTitle: string;
  readyBody: string;
  send: string;
  notSent: string;
  attachTitle: string;
  attachBody: (name: string) => string;
}

/** One document to send: its PDF's route, the file's name, the patient's mobile and the message. */
export interface PdfSent {
  pdf: string;
  name: string;
  /** The patient's mobile, +91 E.164. */
  phone: string;
  text: string;
}

/**
 * Sending a document on WhatsApp with a message (plan §22.1; D244 – D247,
 * D327): the PDF made by the server when it is asked for and kept nowhere.
 * On a phone the share sheet takes both, and the person picks WhatsApp and
 * the chat (D245); should the phone want a fresh tap once the PDF is here, a
 * card offers **Send**. On a desktop the patient's chat opens on WhatsApp
 * Web as the tap lands, and the PDF downloads to attach (D246). Nothing is
 * recorded (D247). `fallback` names a PDF that could not be made.
 */
export function usePdfSend(words: PdfSendWords, fallback: ErrorMessageCode) {
  const respond = useResponse();
  const [sending, setSending] = useState(false);

  /** The share sheet with the file; a refusal for want of a tap offers Send, a fresh one. */
  const share = async (file: File, text: string) => {
    try {
      if (await shareFile(file, text)) respond.success({ title: words.shared });
    } catch (failure) {
      if (needsTap(failure)) {
        respond.info({
          title: words.readyTitle,
          message: words.readyBody,
          primary: { label: words.send, icon: Send, onClick: () => void share(file, text) },
        });
      } else {
        respond.failure(failure, { title: words.notSent, fallback: "SHARE_FAILED" });
      }
    }
  };

  const send = async ({ pdf: route, name, phone, text }: PdfSent) => {
    const sheet = sharesFiles();
    // Opened as the tap lands, so no browser takes it for a pop-up.
    if (!sheet) openChat(phone, text);
    setSending(true);
    let pdf: Blob;
    try {
      pdf = await getFile(withQuery(route, { download: "1" }));
    } catch (failure) {
      respond.failure(failure, { title: words.notSent, fallback });
      return;
    } finally {
      setSending(false);
    }
    if (sheet) {
      await share(new File([pdf], name, { type: "application/pdf" }), text);
    } else {
      saveFile(pdf, name);
      respond.success({ title: words.attachTitle, message: words.attachBody(name), autoClose: false });
    }
  };

  return { send, sending };
}
