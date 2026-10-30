import type { PlatformSettings } from "@/constants/platform";
import type { ClinicRole, PlatformRole } from "@/constants/roles";
import type {
  AuditAction,
  ClinicStanding,
  ClinicType,
  ErrorSource,
  ExtensionKind,
  MemberStatus,
  PaymentMethod,
  SubscriptionPlan,
  SubscriptionState,
} from "@/constants/statuses";

/** The Overview (plan §20.1; D368): the clinics where they stand, and the platform's week and month. */
export interface ConsoleOverview {
  /** The platform's today (India's, D9), which the week and the month count from. */
  today: string;
  clinics: number;
  standings: Record<ClinicStanding, number>;
  /** Waiting for activation (plan §7.6). */
  noTrial: number;
  signupsWeek: number;
  signupsMonth: number;
  extensionsMonth: number;
}

/**
 * A clinic as the console lists it (plan §20.2) — never its data: its name,
 * kind and city, its owner, its plan and how many members it has.
 */
export interface ConsoleClinic {
  id: string;
  name: string;
  type: ClinicType;
  city: string;
  signedUpAt: string;
  owner: { name: string; email: string; phone: string | null };
  plan: SubscriptionPlan;
  validUntil: string;
  state: SubscriptionState;
  /** Where the Overview counts it (D368). */
  standing: ClinicStanding;
  /** Active members, the owner included. */
  members: number;
  /** Signed up with a mobile that had its trial before, and not yet extended (plan §7.6). */
  noTrial: boolean;
}

/** A change recorded to a clinic's plan, as the console reads it (plan §7.4): with its receipt and who recorded it. */
export interface ConsolePlanPayment {
  id: string;
  kind: ExtensionKind;
  amountPaise: number;
  method: PaymentMethod | null;
  reference: string | null;
  paidOn: string | null;
  validFrom: string;
  validUntil: string;
  reason: string | null;
  receiptNumber: string | null;
  recordedBy: string | null;
  recordedAt: string;
}

/**
 * One clinic's page in the console (plan §20.3): its row, every change
 * recorded to its plan, and the live prices, which fill in Monthly and
 * Yearly in Extend plan (plan §7.4).
 */
export interface ConsoleClinicDetail extends ConsoleClinic {
  payments: ConsolePlanPayment[];
  prices: { monthlyPaise: number; yearlyPaise: number };
}

/**
 * What Extend plan answers (plan §7.4; D376): the clinic as it now stands,
 * the change recorded, and whether the owner was emailed — null when the
 * same Extend plan was sent again, and recorded the first time.
 */
export interface PlanExtended {
  clinic: ConsoleClinicDetail;
  payment: ConsolePlanPayment;
  emailSent: boolean | null;
}

/** An account (plan §20.5): who, the clinic they belong to and as what, and when they last signed in. */
export interface ConsoleAccount {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  platformRole: PlatformRole | null;
  createdAt: string;
  /** Their active or invited membership, else their last; null for none. */
  membership: { clinicId: string; clinicName: string; role: ClinicRole; status: MemberStatus } | null;
  lastSignInAt: string | null;
}

/** A failure of the server's own (plan §20.6, §36): codes, paths and ids — never a patient's data. */
export interface ConsoleError {
  id: string;
  source: ErrorSource;
  message: string;
  reference: string | null;
  code: string | null;
  kind: string | null;
  httpStatus: number | null;
  method: string | null;
  path: string | null;
  /** Who was asking and for which clinic, when known. */
  account: { name: string; email: string } | null;
  clinicName: string | null;
  detail: string | null;
  stack: string | null;
  context: Record<string, unknown> | null;
  at: string;
}

/** One of the console's own actions (plan §20.7): a plan extended, the settings changed. */
export interface ConsoleAuditEntry {
  id: string;
  action: AuditAction;
  entityType: string;
  /** What changed: values, as the function that made the change recorded them. */
  changes: Record<string, unknown> | null;
  requestId: string | null;
  actorName: string | null;
  /** The clinic an extension was for, while it still exists. */
  clinicName: string | null;
  at: string;
}

/** The platform settings as the console shows them (plan §20.4): every one, and who last changed them, when. */
export interface ConsoleSettings {
  settings: PlatformSettings;
  updatedAt: string;
  /** Null until the DEV first saves, or once whoever did is gone. */
  updatedBy: string | null;
}
