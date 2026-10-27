import type { FollowUpKind, PaymentKind, PaymentMethod } from "@/constants/statuses";

/** A patient as Home names them: their name and number, opening their profile (D351). */
export interface HomePatient {
  id: string;
  name: string;
  number: number;
}

/** One doctor's queue in miniature (plan §17; D349): how many are in, how many wait, and the next few. */
export interface HomeQueueDoctor {
  doctorId: string;
  doctorName: string;
  withDoctor: number;
  waiting: number;
  next: { appointmentId: string; patient: HomePatient; token: number | null; urgent: boolean }[];
}

/** A visit waiting in To bill, oldest first. */
export interface HomeToBillVisit {
  visitId: string;
  patient: HomePatient;
  /** None for a doctor no longer of the clinic. */
  doctorName: string | null;
  token: number | null;
}

/** A follow-up due today: a treatment's or a visit's. */
export interface HomeFollowUp {
  kind: FollowUpKind;
  /** The treatment's or the visit's. */
  id: string;
  patient: HomePatient;
  title: string | null;
  doctorName: string | null;
}

/** An appointment of tomorrow's. */
export interface HomeAppointment {
  id: string;
  scheduledAt: string;
  patient: HomePatient;
  doctorName: string;
  typeName: string;
}

/** A payment or refund standing. */
export interface HomePayment {
  id: string;
  kind: PaymentKind;
  amountPaise: number;
  method: PaymentMethod;
  paidAt: string;
  patient: HomePatient;
}

/** An expense in use. */
export interface HomeExpense {
  id: string;
  categoryName: string;
  description: string | null;
  amountPaise: number;
  day: string;
  method: PaymentMethod;
}

/**
 * Home (plan §17; D345 – D353), as `dashboard_summary` (0034) works it out:
 * each section only with its permission, else null; and, until the clinic's
 * first patient, its getting-started steps (D348).
 */
export interface Dashboard {
  /** Today in the clinic's timezone. */
  today: string;
  /** `appointments.view`: today's appointments, the cancelled left out (D346), and the patients seen — a doctor's own (D347). */
  day: { appointments: number; patientsSeen: number } | null;
  /** `reports.view`: collected today, and what is owed (the clinic's). */
  money: { collectedPaise: number; outstandingPaise: number } | null;
  /** `appointments.view`: each doctor with anyone in or waiting — a doctor only themselves. */
  queue: HomeQueueDoctor[] | null;
  /** `payments.view`. */
  toBill: { count: number; visits: HomeToBillVisit[] } | null;
  /** `appointments.view` or `visits.view` (D267). */
  followUps: { today: number; overdue: number; lapsed: number; due: HomeFollowUp[] } | null;
  /** `appointments.view`: tomorrow's, the cancelled left out. */
  upcoming: { count: number; appointments: HomeAppointment[] } | null;
  /** `payments.view`. */
  owing: { patient: HomePatient; balancePaise: number }[] | null;
  /** `payments.view`. */
  payments: HomePayment[] | null;
  /** `expenses.view`. */
  expenses: HomeExpense[] | null;
  /** Until the first patient (D348): whether a price is set, and whether anyone else is on the team. */
  gettingStarted: { prices: boolean; team: boolean } | null;
}
