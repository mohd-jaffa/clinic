import { UI_TEXT } from "@/constants/messages";
import { formatDate } from "@/lib/format/date";
import { fileName } from "@/lib/pdf/response";

/**
 * The file a prescription is saved as (D223): "Rohan Mehta - 14 Oct 2026 -
 * Prescription.pdf" — the same on the server's answer and on the device.
 */
export const prescriptionFileName = (patient: string, day: string) =>
  fileName(UI_TEXT.documents.prescriptionFile(patient, formatDate(day)));
