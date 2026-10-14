/**
 * A PDF as the API answers it (plan §33): the file itself, to open in the
 * browser's own viewer — to look at and print (D221) — or, `download`ed, to
 * save under its name (D223). Like every answer, never kept (AGENTS.md §26).
 */
export function pdfResponse(
  file: Buffer,
  { name, download, requestId }: { name: string; download: boolean; requestId: string },
): Response {
  // A plain-ASCII name for old clients, and the name itself for the rest.
  const plain = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "x-request-id": requestId,
    },
  });
}

/** A name a file may have on any device: none of the characters a file system refuses. */
export const fileName = (name: string) =>
  name
    .replace(/[/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
