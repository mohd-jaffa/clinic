import type {
  AppointmentStatus,
  BillingStatus,
  BillListState,
  BillPaymentState,
  BillStatus,
  Gender,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
  VisitStatus,
} from "@/constants/statuses";

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

/** A bill's line as it was issued. */
export interface BillLine {
  description: string;
  quantity: number;
  unitPricePaise: number;
  amountPaise: number;
  /** The price-list entry it came from, and the treatment it was for (D285); neither for a typed line. */
  serviceId: string | null;
  treatmentId: string | null;
}

/**
 * A bill as its page shows it (plan §15.2; D314): who it is for, what it
 * billed and for which visit or arrival, its lines and totals, who issued
 * it — or voided it, and why — where it stands with payment (none once
 * void), and the patient's balance (D295).
 */
export interface BillDetail {
  id: string;
  number: string;
  issuedAt: string;
  /** Its day in the clinic's timezone. */
  issuedOn: string;
  status: BillStatus;
  patient: {
    id: string;
    name: string;
    number: number;
    phone: string;
    dateOfBirth: string;
    gender: Gender;
    archived: boolean;
  };
  visitId: string | null;
  appointmentId: string | null;
  /** None for a bill with no doctor (D326), or once their account is gone. */
  doctor: string | null;
  lines: BillLine[];
  subtotalPaise: number;
  discountPaise: number;
  totalPaise: number;
  notes: string | null;
  issuedBy: string | null;
  void: { reason: string; at: string; by: string | null } | null;
  settlement: { paidPaise: number; duePaise: number; state: BillPaymentState } | null;
  balancePaise: number;
}

/** What voiding answers: the patient's balance after, and the visit back in To bill, when it is (D286). */
export interface BillVoided {
  balancePaise: number;
  visitToBill: boolean;
}

/**
 * A visit waiting in To bill (plan §15.6; D318): its day, the patient — and
 * whether they are archived — the doctor, the arrival's token, the
 * treatments worked on in it, and whether its consultation was paid at
 * arrival (§11.3).
 */
export interface ToBillVisit {
  visitId: string;
  day: string;
  completedAt: string | null;
  patient: { id: string; name: string; number: number; archived: boolean };
  /** None once their account is gone. */
  doctor: { id: string; name: string | null } | null;
  appointmentId: string | null;
  token: number | null;
  treatments: string[];
  feePaid: boolean;
}

/** How many wait in To bill (D337). */
export interface ToBillCount {
  count: number;
}

/** A bill as Billing's Bills tab lists it (plan §15.4; D320): its number, day, patient, total and where it stands. */
export interface BillListItem {
  id: string;
  number: string;
  issuedAt: string;
  totalPaise: number;
  patient: { id: string; name: string; number: number };
  /** Paid and due on it; none once void. */
  settlement: { paidPaise: number; duePaise: number } | null;
  state: BillListState;
}

/** A bill in a patient's history (D325): its number, day, total and where it stands — the patient is theirs. */
export type PatientBill = Omit<BillListItem, "patient">;

/**
 * A payment taken, or a refund handed back (plan §15.3; D325, D336): how
 * much, how and when, its reference and note, who took it, and — voided —
 * when, by whom and why. The patient it is from.
 */
export interface Payment {
  id: string;
  kind: PaymentKind;
  amountPaise: number;
  method: PaymentMethod;
  reference: string | null;
  paidAt: string;
  /** Its day in the clinic's timezone (D334). */
  paidOn: string;
  note: string | null;
  status: PaymentStatus;
  receivedBy: string | null;
  void: { reason: string; at: string; by: string | null } | null;
  patient: { id: string; name: string; number: number; archived: boolean };
}

/** Someone who owes (plan §15.4; D321): the patient, how to reach them, and how much. */
export interface OutstandingPatient {
  patient: {
    id: string;
    name: string;
    number: number;
    phone: string;
    dateOfBirth: string;
    gender: Gender;
    archived: boolean;
  };
  balancePaise: number;
}

/** What recording a payment or a refund answers: the payment, and the patient's balance after. */
export interface PaymentRecorded {
  paymentId: string;
  balancePaise: number;
}

/** What voiding a payment answers: the patient's balance after. */
export interface PaymentVoided {
  balancePaise: number;
}

/** What marking a visit No charge answers (D319). */
export interface NoChargeMarked {
  visitId: string;
}
