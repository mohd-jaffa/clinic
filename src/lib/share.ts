import { whatsAppHref } from "./phone";

/**
 * Handing a document to WhatsApp with a message (plan §22.1; D183, D245,
 * D246) — a person still presses send. A touch-first device that can share
 * files gets its share sheet, the file and the message in it; any other — a
 * desktop — opens the chat on WhatsApp Web with the message and saves the
 * file to attach. The prescription is the first sent; a bill (Phase 8)
 * follows.
 */

/** Whether this device hands a file over through its share sheet: one touched first, that shares files. */
export function sharesFiles(): boolean {
  if (typeof navigator.canShare !== "function" || !window.matchMedia("(pointer: coarse)").matches) return false;
  return navigator.canShare({ files: [new File([], "check.pdf", { type: "application/pdf" })] });
}

/**
 * The share sheet with the file and the message: whether it was handed over,
 * or the sheet was put aside. Any other refusal — a browser wanting a fresh
 * tap — is passed on.
 */
export async function shareFile(file: File, text: string): Promise<boolean> {
  try {
    await navigator.share({ files: [file], text });
    return true;
  } catch (failure) {
    if (failure instanceof DOMException && failure.name === "AbortError") return false;
    throw failure;
  }
}

/** Whether a share was refused only for want of a fresh tap. */
export const needsTap = (failure: unknown) => failure instanceof DOMException && failure.name === "NotAllowedError";

/** The patient's chat on WhatsApp Web beside the app, the message typed. Opened as the tap lands, before anything is fetched. */
export function openChat(phone: string, text: string): void {
  window.open(whatsAppHref(phone, text), "_blank", "noopener,noreferrer");
}
