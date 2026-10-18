import type { AppointmentStatus, BillingStatus, Gender, VisitStatus } from "@/constants/statuses";

/** What `bill_start` (0030) answers. */
export interface BillStartRow {
  patient: {
    id: string;
    full_name: string;
    patient_number: number;
    date_of_birth: string;
    gender: Gender;
    archived: boolean;
  };
  visit: { id: string; visit_date: string; status: VisitStatus; billing_status: BillingStatus | null } | null;
  appointment: { id: string; status: AppointmentStatus; token_number: number | null } | null;
  doctor: { id: string; full_name: string | null; fee_paise: number | null } | null;
  consultation_billed: boolean;
  treatments: { id: string; name: string }[];
  balance_paise: number;
  to_bill: { visit_id: string; visit_date: string } | null;
}

/**
 * Where a new bill starts (plan §15.2; D285, D302 – D313): who it is for,
 * what it bills — a visit or an arrival, or neither — its doctor and their
 * own fee (D26), whether a consultation is billed already for it (D286),
 * the treatments worked on in the visit not yet billed for it, the
 * patient's balance (D295), and — started from a patient — their oldest
 * visit still to bill (D313).
 */
export interface BillStart {
  patient: { id: string; name: string; number: number; dateOfBirth: string; gender: Gender; archived: boolean };
  visit: { id: string; day: string; status: VisitStatus; billingStatus: BillingStatus | null } | null;
  appointment: { id: string; status: AppointmentStatus; token: number | null } | null;
  /** None once their account is gone — or for a bill from a patient (D326). */
  doctor: { id: string; name: string | null; feePaise: number | null } | null;
  consultationBilled: boolean;
  treatments: { id: string; name: string }[];
  balancePaise: number;
  toBill: { visitId: string; day: string } | null;
}

/** What issuing answers (D302): the bill, what was collected with it, and the patient's balance after. */
export interface BillIssued {
  billId: string;
  billNumber: string;
  totalPaise: number;
  collectedPaise: number;
  balancePaise: number;
}
