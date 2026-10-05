/**
 * Hands the person a CSV made on this device (plan §10.5: an import's rows
 * that were not imported, to fix and import again). Nothing is sent or kept:
 * the browser saves it where the person chooses. It starts with a byte-order
 * mark, so Excel reads its names in UTF-8.
 */
export function saveCsv(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Once the save has started; revoking at once can cancel it in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
