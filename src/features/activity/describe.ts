import { UI_TEXT } from "@/constants/messages";
import { isPermission, PERMISSION_TEXT } from "@/constants/permissions";
import { CLINIC_ROLE_LABELS, type ClinicRole } from "@/constants/roles";
import {
  ALERT_KIND_LABELS,
  APPOINTMENT_STATUS_LABELS,
  BILL_STATUS_LABELS,
  BILLING_STATUS_LABELS,
  CLINIC_TYPE_LABELS,
  FEE_TIMING_LABELS,
  FOLLOW_UP_OUTCOME_LABELS,
  MEMBER_STATUS_LABELS,
  NO_CHARGE_REASON_LABELS,
  PAPER_SIZE_LABELS,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  SERVICE_CATEGORY_LABELS,
  TREATMENT_STATUS_LABELS,
  VISIT_STATUS_LABELS,
  type FollowUpOutcome,
  type PaymentMethod,
  type TreatmentStatus,
} from "@/constants/statuses";
import { formatPaise } from "@/lib/format/currency";
import { formatDate, formatDateTime } from "@/lib/format/date";

import type { ActivityEntry } from "./types";

const { activity: words } = UI_TEXT;
const lines = words.lines;

type Change = { from: unknown; to: unknown };

/** A value change the row holds, or none. */
function changeOf(entry: ActivityEntry, key: string): Change | undefined {
  const value = entry.changes?.[key];
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Change) : undefined;
}

/** What a value changed to — or, for a record removed, what it was. */
const valueOf = (entry: ActivityEntry, key: string): unknown => {
  const change = changeOf(entry, key);
  return change?.to ?? change?.from ?? null;
};

/** A name the row's record or its changes give it, or none. */
const nameOf = (entry: ActivityEntry): string => String(entry.record?.name ?? valueOf(entry, "name") ?? words.unset);

/** Created, changed, archived or restored — a named item's four lines. */
function itemLine(
  entry: ActivityEntry,
  said: {
    added: (name: string) => string;
    changed: (name: string) => string;
    archived: (name: string) => string;
    restored: (name: string) => string;
  },
): string {
  const name = nameOf(entry);
  if (entry.action === "CREATE") return said.added(name);
  if (entry.action === "ARCHIVE") return said.archived(name);
  if (entry.action === "RESTORE") return said.restored(name);
  return said.changed(name);
}

function patientLine(entry: ActivityEntry): string {
  if (entry.action === "CREATE") {
    const imported = entry.changes?.imported;
    return typeof imported === "number" ? lines.importedPatients(imported) : lines.addedPatient;
  }
  if (entry.action === "ARCHIVE") return lines.archivedPatient;
  if (entry.action === "RESTORE") return lines.restoredPatient;
  return lines.changedPatient;
}

function alertLine(entry: ActivityEntry): string {
  if (entry.action === "CREATE") {
    return lines.addedAlert(lines.alertKinds[valueOf(entry, "kind") as keyof typeof lines.alertKinds]);
  }
  return changeOf(entry, "active")?.to === false ? lines.turnedOffAlert : lines.changedAlert;
}

function appointmentLine(entry: ActivityEntry): string {
  const status = changeOf(entry, "status");
  if (entry.action === "CREATE") {
    const token = valueOf(entry, "token_number");
    return typeof token === "number"
      ? lines.walkIn(token)
      : lines.booked(formatDateTime(valueOf(entry, "scheduled_at") as string));
  }
  if (entry.action === "STATUS_CHANGE" && status) {
    switch (status.to) {
      case "CONFIRMED":
        return lines.confirmed;
      case "SCHEDULED":
        return lines.scheduledAgain;
      case "NO_SHOW":
        return lines.noShow;
      case "CANCELLED":
        return lines.cancelled;
      case "ARRIVED":
        return status.from === "IN_PROGRESS"
          ? lines.backToWaiting
          : lines.arrived((valueOf(entry, "token_number") as number | null) ?? null);
      case "IN_PROGRESS":
        return lines.sentIn;
      default:
        return lines.done;
    }
  }
  if (changeOf(entry, "reminded_at")) return lines.reminded;
  const steppedOut = changeOf(entry, "stepped_out_at");
  if (steppedOut) return steppedOut.to === null ? lines.steppedBack : lines.steppedOut;
  const urgent = changeOf(entry, "urgent_at");
  if (urgent) return urgent.to === null ? lines.notUrgent : lines.urgent;
  const moved = changeOf(entry, "scheduled_at");
  return moved ? lines.moved(formatDateTime(moved.to as string)) : lines.changedAppointment;
}

function visitLine(entry: ActivityEntry): string {
  if (entry.action === "CREATE") return valueOf(entry, "status") === "OPEN" ? lines.openedVisit : lines.visitDone;
  if (entry.action === "STATUS_CHANGE") return lines.visitDone;
  if (entry.action === "DELETE") return lines.removedVisit;
  const billing = changeOf(entry, "billing_status");
  if (billing?.to === "BILLED") return lines.billedVisit;
  if (billing?.to === "TO_BILL") return lines.visitToBill;
  if (billing?.to === "NO_CHARGE") return lines.noCharge;
  return lines.changedVisit;
}

function treatmentLine(entry: ActivityEntry): string {
  if (entry.action === "CREATE") return lines.addedTreatment;
  const status = changeOf(entry, "status");
  if (entry.action === "STATUS_CHANGE" && status) return lines.treatmentTo[status.to as TreatmentStatus];
  return lines.changedTreatment;
}

function sittingLine(entry: ActivityEntry): string {
  if (entry.action === "CREATE") return lines.recordedSitting;
  if (entry.action === "DELETE") return lines.removedSitting;
  return lines.changedSitting;
}

function billLine(entry: ActivityEntry): string {
  if (entry.action === "CREATE") {
    return lines.issuedBill(
      String(valueOf(entry, "bill_number")),
      formatPaise(valueOf(entry, "total_paise") as number),
    );
  }
  return lines.voidedBill(String(entry.record?.bill_number ?? words.unset));
}

function paymentLine(entry: ActivityEntry): string {
  if (entry.action === "CREATE") {
    const amount = formatPaise(valueOf(entry, "amount_paise") as number);
    const method = PAYMENT_METHOD_LABELS[valueOf(entry, "method") as PaymentMethod];
    return valueOf(entry, "kind") === "REFUND"
      ? lines.gaveRefund(amount, method)
      : lines.recordedPayment(amount, method);
  }
  const amount = formatPaise(entry.record?.amount_paise as number);
  return entry.record?.kind === "REFUND" ? lines.voidedRefund(amount) : lines.voidedPayment(amount);
}

function expenseLine(entry: ActivityEntry): string {
  const categoryId = valueOf(entry, "category_id") as string | null;
  const category = String(entry.record?.category ?? (categoryId && entry.names[categoryId]) ?? words.unset);
  if (entry.action === "CREATE")
    return lines.addedExpense(formatPaise(valueOf(entry, "amount_paise") as number), category);
  if (entry.action === "ARCHIVE") return lines.archivedExpense(category);
  if (entry.action === "RESTORE") return lines.restoredExpense(category);
  return lines.changedExpense(category);
}

function closureLine(entry: ActivityEntry): string {
  const reason = String(valueOf(entry, "reason") ?? words.unset);
  const doctorId = valueOf(entry, "doctor_id") as string | null;
  const doctor = doctorId ? (entry.names[doctorId] ?? words.unset) : null;
  if (entry.action === "DELETE") return doctor ? lines.leaveRemoved(doctor, reason) : lines.reopened(reason);
  return doctor ? lines.leave(doctor, reason) : lines.closed(reason);
}

function memberLine(entry: ActivityEntry): string {
  const email = String(valueOf(entry, "email") ?? entry.record?.email ?? lines.aMember);
  const name = String(entry.record?.name ?? email);
  if (entry.action === "CREATE") return lines.invited(email, lines.roles[valueOf(entry, "role") as ClinicRole]);
  if (entry.action === "DELETE") return lines.revokedInvite(email);
  const status = changeOf(entry, "status");
  if (status?.to === "INACTIVE") return lines.deactivated(name);
  if (status?.to === "ACTIVE") return status.from === "INVITED" ? lines.joined : lines.reactivated(name);
  if (changeOf(entry, "invite_expires_at")) return lines.resentInvite(name);
  return lines.changedMember(name);
}

function clinicLine(entry: ActivityEntry): string {
  if (entry.action === "CREATE") return lines.signedUp;
  const logo = changeOf(entry, "logo");
  if (logo) return logo.to === null ? lines.removedLogo : lines.changedLogo;
  return lines.changedClinic;
}

/**
 * What a row of the activity says (plan §19; D387): what was done, with what
 * it matters to say — "Recorded a payment of ₹2,000 · UPI" — read from the
 * change the trail holds and the record as it is now.
 */
export function describeActivity(entry: ActivityEntry): string {
  switch (entry.entityType) {
    case "patients":
      return patientLine(entry);
    case "patient_alerts":
      return alertLine(entry);
    case "appointments":
      return appointmentLine(entry);
    case "visits":
      return visitLine(entry);
    case "vitals":
      return lines.vitals;
    case "prescriptions":
      return entry.action === "CREATE" ? lines.wrotePrescription : lines.changedPrescription;
    case "prescription_templates":
      return itemLine(entry, {
        added: lines.addedTemplate,
        changed: lines.changedTemplate,
        archived: lines.archivedTemplate,
        restored: lines.restoredTemplate,
      });
    case "treatments":
      return treatmentLine(entry);
    case "treatment_sessions":
      return sittingLine(entry);
    case "follow_up_contacts":
      return lines.followUp(FOLLOW_UP_OUTCOME_LABELS[valueOf(entry, "outcome") as FollowUpOutcome]);
    case "bills":
      return billLine(entry);
    case "payments":
      return paymentLine(entry);
    case "expenses":
      return expenseLine(entry);
    case "services":
      return itemLine(entry, {
        added: lines.addedService,
        changed: lines.changedService,
        archived: lines.archivedService,
        restored: lines.restoredService,
      });
    case "appointment_types":
      return itemLine(entry, {
        added: lines.addedType,
        changed: lines.changedType,
        archived: lines.archivedType,
        restored: lines.restoredType,
      });
    case "expense_categories":
      return itemLine(entry, {
        added: lines.addedCategory,
        changed: lines.changedCategory,
        archived: lines.archivedCategory,
        restored: lines.restoredCategory,
      });
    case "clinic_closures":
      return closureLine(entry);
    case "clinic_members":
      return memberLine(entry);
    case "clinics":
      return clinicLine(entry);
    default:
      return lines.other(entry.entityType, entry.action);
  }
}

/**
 * Who or what a row is about, under its line: the patient by name and
 * number (D387), an import's numbers, a closure's days; none when the line
 * says it all.
 */
export function subjectOf(entry: ActivityEntry): string | null {
  if (entry.patient) {
    return words.patient(entry.patient.name, UI_TEXT.patients.number(entry.patient.number));
  }
  const numbers = changeOf(entry, "patient_number");
  if (entry.entityType === "patients" && numbers && typeof entry.changes?.imported === "number") {
    return words.patients(
      UI_TEXT.patients.number(numbers.from as number),
      UI_TEXT.patients.number(numbers.to as number),
    );
  }
  if (entry.entityType === "clinic_closures") {
    const from = valueOf(entry, "starts_on") as string;
    const to = valueOf(entry, "ends_on") as string;
    return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
  }
  return null;
}

/** The labels a field's values are said with, for the record it belongs to. */
function labelsFor(entityType: string, key: string): Record<string, string> | undefined {
  if (key === "status") {
    return {
      appointments: APPOINTMENT_STATUS_LABELS,
      visits: VISIT_STATUS_LABELS,
      bills: BILL_STATUS_LABELS,
      payments: PAYMENT_STATUS_LABELS,
      treatments: TREATMENT_STATUS_LABELS,
      clinic_members: MEMBER_STATUS_LABELS,
    }[entityType];
  }
  if (key === "kind") return entityType === "payments" ? PAYMENT_KIND_LABELS : ALERT_KIND_LABELS;
  if (key === "category") return SERVICE_CATEGORY_LABELS;
  return (
    {
      billing_status: BILLING_STATUS_LABELS,
      method: PAYMENT_METHOD_LABELS,
      payment_method: PAYMENT_METHOD_LABELS,
      role: CLINIC_ROLE_LABELS,
      clinic_type: CLINIC_TYPE_LABELS,
      paper_size: PAPER_SIZE_LABELS,
      fee_timing: FEE_TIMING_LABELS,
      outcome: FOLLOW_UP_OUTCOME_LABELS,
      no_charge_reason: NO_CHARGE_REASON_LABELS,
    } as Record<string, Record<string, string>>
  )[key];
}

/** A member's permissions by name: kept as a list when invited, as one line of them when changed. */
const permissionNames = (value: unknown) =>
  (Array.isArray(value) ? (value as string[]) : String(value).split(","))
    .filter(Boolean)
    .map((code) => (isPermission(code) ? PERMISSION_TEXT[code].label : code))
    .join(", ");

/** A value as a person reads it: money in rupees, a day or a time, a yes or no, a name for an id. */
function said(entry: ActivityEntry, key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return words.unset;
  if (key === "permissions") return permissionNames(value);
  if (typeof value === "boolean") return value ? words.yes : words.no;
  if (key.endsWith("_paise")) return formatPaise(value as number);
  if (key.endsWith("_id")) return entry.names[value as string] ?? words.unset;
  if (key.endsWith("_at")) return formatDateTime(value as string);
  if (/(_on|_date|_until)$/.test(key) || key === "date_of_birth") return formatDate(value as string);
  return labelsFor(entry.entityType, key)?.[value as string] ?? String(value);
}

/**
 * What a row needs no line for: the patient and their number are said
 * apart, the visit and the appointment are the record's own, and a logo's
 * stored name tells a person nothing — the line says it changed.
 */
const UNSAID = new Set(["patient_id", "patient_number", "visit_id", "appointment_id", "logo"]);

/** A field's name as the sheet says it; a field it has no word for, as its column reads. */
const fieldName = (key: string) => words.fields[key] ?? key.replaceAll("_", " ");

/**
 * Where a field stands among the others: as the sheet's words list them —
 * status and time first, then money — not as the database keeps a change's
 * keys (shortest first). A field it has no word for comes last.
 */
const FIELD_ORDER = Object.keys(words.fields);
const placeOf = (key: string) => (FIELD_ORDER.includes(key) ? FIELD_ORDER.indexOf(key) : FIELD_ORDER.length);

/** One change as the sheet says it: what a record was made with, what one removed held, or from and to. */
function changeLine(entry: ActivityEntry, key: string, value: unknown): string | null {
  const change = changeOf(entry, key);
  if (!change) return said(entry, key, value);
  if (entry.action === "CREATE") return change.to === null ? null : said(entry, key, change.to);
  if (entry.action === "DELETE") return change.from === null ? null : said(entry, key, change.from);
  return `${said(entry, key, change.from)} → ${said(entry, key, change.to)}`;
}

/**
 * Everything a row changed, for its sheet (D389): each value from and to —
 * only what it was made with, for a record made, and what it held, for one
 * removed — and the clinical and personal fields by name alone (plan §27.6).
 */
export function changeLines(entry: ActivityEntry): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const changes = Object.entries(entry.changes ?? {}).sort(([a], [b]) => placeOf(a) - placeOf(b));
  for (const [key, value] of changes) {
    if (key === "fields" || UNSAID.has(key)) continue;
    const line = changeLine(entry, key, value);
    if (line !== null) rows.push({ label: fieldName(key), value: line });
  }
  const fields = entry.changes?.fields ?? [];
  if (fields.length > 0) {
    rows.push({
      label: entry.action === "CREATE" ? words.filledIn : words.changed,
      value: fields.map(fieldName).join(", "),
    });
  }
  return rows;
}
