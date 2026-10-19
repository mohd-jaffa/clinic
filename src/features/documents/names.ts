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
