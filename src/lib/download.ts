/**
 * Hands the person a file made on this device, or fetched for them, to keep
 * (plan §10.5, §33): the browser saves it where the person chooses. Nothing
 * is kept by the app.
 */
export function saveFile(file: Blob, name: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Once the save has started; revoking at once can cancel it in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * An import's rows that were not imported, to fix and import again (plan
 * §10.5). It starts with a byte-order mark, so Excel reads its names in UTF-8.
 */
export function saveCsv(name: string, text: string): void {
  saveFile(new Blob([`\ufeff${text}`], { type: "text/csv;charset=utf-8" }), name);
}
