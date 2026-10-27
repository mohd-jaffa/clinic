import type { Gender, PaperSize } from "@/constants/statuses";
import type { BillDetail } from "@/features/billing/types";
import type { PrescriptionContent } from "@/features/prescriptions/types";
import type { DailyReport } from "@/features/reports/types";
import type { Vitals } from "@/features/visits/types";
import type { Letterhead } from "@/lib/pdf/letterhead";

/** What a prescription's PDF is made from (plan §13, §33): read in one query beside the clinic's. */
export interface PrescriptionSource {
  clinic: Omit<Letterhead, "logo"> & { paperSize: PaperSize };
  doctor: {
    /** None once their account is gone. */
    name: string | null;
    qualifications: string | null;
    specialization: string | null;
    registration: string;
  };
  patient: { name: string; number: number; dateOfBirth: string; gender: Gender };
  /** The visit's day: the prescription's date. */
  day: string;
  vitals: Vitals | null;
  /** The visit's diagnosis — only when the prescription prints it (D216). */
  diagnosis: string | null;
  prescription: PrescriptionContent;
  followUpOn: string | null;
}

/** A prescription in the words it is printed in (D218, D219). */
export interface PrescriptionSheet {
  letterhead: Letterhead;
  /** "Dr. Maya Rao", or none once their account is gone. */
  doctor: string | null;
  /** "BDS, MDS · Orthodontist", "Reg. KMC 12345". */
  credentials: string[];
  /** "14 Oct 2026". */
  date: string;
  patient: string;
  /** "36 y · Male · P-1002". */
  about: string;
  /** "BP 120/80 mmHg · Pulse 72/min · …", or none taken. */
  vitals: string | null;
  diagnosis: string | null;
  items: { title: string; how: string; instructions: string | null }[];
  advice: string | null;
  /** "Review on Tuesday, 20 Oct 2026". */
  followUp: string | null;
}

/** What a bill's PDF is made from (plan §15.5): the bill as its page reads it, beside the clinic. */
export interface BillSource {
  clinic: Omit<Letterhead, "logo"> & { paperSize: PaperSize };
  bill: BillDetail;
}

/** A figure under a bill's lines: "Total ₹5,000". */
export interface BillFigure {
  label: string;
  value: string;
  /** The total, set larger. */
  lead?: boolean;
}

/** A bill in the words it is printed in (plan §15.5; D315, D316). */
export interface BillSheet {
  letterhead: Letterhead;
  /** "No. 2026-27/0042". */
  number: string;
  /** "18 Oct 2026". */
  date: string;
  patient: string;
  /** "36 y · Male · P-1002". */
  about: string;
  /** "Mobile +91 98765 43210 · Dr. Maya Rao". */
  contact: string;
  lines: { description: string; quantity: string; rate: string; amount: string }[];
  figures: BillFigure[];
  /** "Patient’s balance: ₹2,000 due"; none on a void bill. */
  balance: string | null;
  notes: string | null;
  /** "Void: Wrong patient" (D315); none on a live bill. */
  void: string | null;
  /** Who signs: the clinic (D316). */
  signatory: string;
}

/** What the day-end collections' PDF is made from (D49, D359): the day's report, beside the clinic. */
export interface CollectionsSource {
  clinic: Omit<Letterhead, "logo"> & { paperSize: PaperSize };
  report: DailyReport;
}

/** The day-end collections in the words they are printed in (D357 – D360). */
export interface CollectionsSheet {
  letterhead: Letterhead;
  /** "Tuesday, 27 Oct 2026". */
  date: string;
  /** Each person who took money: their lines, and the cash they hand over. */
  people: { name: string; lines: { label: string; value: string }[]; handOver: string }[];
  /** Each method used: received, refunded and net. */
  methods: { label: string; received: string; refunded: string; net: string }[];
  net: string;
  /** "Voided: 1 payment, ₹500", or none. */
  voided: string | null;
}
