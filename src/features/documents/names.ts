import { UI_TEXT } from "@/constants/messages";
import { formatDate } from "@/lib/format/date";
import { fileName } from "@/lib/pdf/response";

/**
 * The file a prescription is saved as (D223): "Rohan Mehta - 14 Oct 2026 -
 * Prescription.pdf" — the same on the server's answer and on the device.
 */
export const prescriptionFileName = (patient: string, day: string) =>
  fileName(UI_TEXT.documents.prescriptionFile(patient, formatDate(day)));

/**
 * The file a bill is saved as (plan §15.5): "Rohan Mehta - Bill
 * 2026-27-0042.pdf" — its number's slash, which no file name may hold, a
 * dash.
 */
export const billFileName = (patient: string, number: string) =>
  fileName(UI_TEXT.documents.billFile(patient, number.replaceAll("/", "-")));

/** The file a day's collections are saved as (D359): "Collections - 27 Oct 2026.pdf". */
export const collectionsFileName = (day: string) => fileName(UI_TEXT.documents.collectionsFile(formatDate(day)));

/** The file a plan receipt is saved as (D392): "Receipt R-2026-27-0001.pdf" — its slashes dashes. */
export const receiptFileName = (number: string) =>
  fileName(UI_TEXT.documents.receipt.file(number.replaceAll("/", "-")));
