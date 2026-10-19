"use client";

import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { getFile } from "@/lib/api/client";
import { saveFile } from "@/lib/download";
import { apiRoutes, withQuery } from "@/lib/query/keys";

import { billFileName } from "../names";

const { bill: words } = UI_TEXT;

/**
 * **Download** a bill (plan §15.5): made by the server when it is asked for,
 * saved on the device as "{patient} - Bill {number}.pdf", and kept nowhere
 * else. Asked through the API's client, so an expired session is renewed
 * first.
 */
export function useBillDownload({ billId, patient, number }: { billId: string; patient: string; number: string }) {
  const respond = useResponse();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    const name = billFileName(patient, number);
    try {
      saveFile(await getFile(withQuery(apiRoutes.bills.pdf(billId), { download: "1" })), name);
      respond.success({ title: words.downloaded, message: words.savedAs(name) });
    } catch (failure) {
      respond.failure(failure, { title: words.notDownloaded, fallback: "BILL_PDF_FAILED" });
    } finally {
      setDownloading(false);
    }
  };

  return { download, downloading };
}
