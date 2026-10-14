import type { Gender, PaperSize } from "@/constants/statuses";
import type { PrescriptionContent } from "@/features/prescriptions/types";
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
