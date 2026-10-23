"use client";

import { UI_TEXT, WHATSAPP_TEXT } from "@/constants/messages";
import { useAuth } from "@/features/auth/AuthProvider";
import { formatPaise } from "@/lib/format/currency";
import { formatNearDate } from "@/lib/format/date";
import { apiRoutes } from "@/lib/query/keys";

import { billFileName } from "../names";
import { usePdfSend } from "./usePdfSend";

/** A bill to send: its number and day, its patient and their mobile, its total and what is still due on it. */
export interface SentBill {
  billId: string;
  number: string;
  /** Its day in the clinic's timezone. */
  day: string;
  patient: string;
  /** The patient's mobile, +91 E.164. */
  phone: string;
  totalPaise: number;
  duePaise: number;
}

/**
 * **WhatsApp** for a bill (plan §22.1; D327, D341): "Your bill 2026-27/0042
 * from Smile Care, 15 Oct: ₹1,500." — and "₹1,000 is due." while something
 * is — with the PDF, as the prescription is sent (`usePdfSend`). Asked for
 * the bill when tapped — from its page or the issued card.
 */
export function useBillSend() {
  const { membership } = useAuth();
  const sending = usePdfSend(UI_TEXT.bill, "BILL_PDF_FAILED");
  return {
    send: (bill: SentBill) =>
      sending.send({
        pdf: apiRoutes.bills.pdf(bill.billId),
        name: billFileName(bill.patient, bill.number),
        phone: bill.phone,
        text: WHATSAPP_TEXT.bill(
          bill.number,
          membership?.clinicName ?? "",
          formatNearDate(bill.day),
          formatPaise(bill.totalPaise),
          bill.duePaise > 0 ? formatPaise(bill.duePaise) : null,
        ),
      }),
    sending: sending.sending,
  };
}
