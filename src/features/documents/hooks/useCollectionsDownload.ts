"use client";

import { useState } from "react";

import { useResponse } from "@/components/ui/response-card";
import { UI_TEXT } from "@/constants/messages";
import { getFile } from "@/lib/api/client";
import { saveFile } from "@/lib/download";
import { apiRoutes, withQuery } from "@/lib/query/keys";

import { collectionsFileName } from "../names";

const { reports: words } = UI_TEXT;

/**
 * **Download** a day's collections (plan §18; D359): made by the server when
 * asked for, saved on the device as "Collections - 27 Oct 2026.pdf", and kept
 * nowhere else.
 */
export function useCollectionsDownload(day: string) {
  const respond = useResponse();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    const name = collectionsFileName(day);
    try {
      saveFile(await getFile(withQuery(apiRoutes.reports.collectionsPdf, { day, download: "1" })), name);
      respond.success({ title: words.downloaded, message: words.savedAs(name) });
    } catch (failure) {
      respond.failure(failure, { title: words.notDownloaded, fallback: "COLLECTIONS_PDF_FAILED" });
    } finally {
      setDownloading(false);
    }
  };

  return { download, downloading };
}
