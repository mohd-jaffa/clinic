"use client";

import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { getFile } from "@/lib/api/client";
import { saveFile } from "@/lib/download";
import { apiRoutes, withQuery } from "@/lib/query/keys";

import { prescriptionFileName } from "../names";

const { prescription: words } = UI_TEXT;

/**
 * **Download** a visit's prescription (D221, D223): made by the server when
 * it is asked for, saved on the device as "{patient} - {day} -
 * Prescription.pdf", and kept nowhere else. Asked through the API's client,
 * so an expired session is renewed first.
 */
export function usePrescriptionDownload({ visitId, patient, day }: { visitId: string; patient: string; day: string }) {
  const respond = useResponse();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    const name = prescriptionFileName(patient, day);
    try {
      saveFile(await getFile(withQuery(apiRoutes.visits.prescriptionPdf(visitId), { download: "1" })), name);
      respond.success({ title: words.downloaded, message: words.savedAs(name) });
    } catch (failure) {
      respond.failure(failure, { title: words.notDownloaded, fallback: "PRESCRIPTION_PDF_FAILED" });
    } finally {
      setDownloading(false);
    }
  };

  return { download, downloading };
}
