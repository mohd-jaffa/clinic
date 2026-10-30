import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { UI_TEXT } from "@/constants/messages";
import type { ExtensionKind, Gender, PaymentMethod } from "@/constants/statuses";
import { getBill } from "@/features/billing/api";
import { downloadLogo, getClinicForDocuments } from "@/features/clinic/api";
import { toContent } from "@/features/prescriptions/content";
import { getDailyReport } from "@/features/reports/api";
import type { PrescriptionItemRow } from "@/features/prescriptions/types";
import type { VitalsRow } from "@/features/visits/types";
import { toVitals } from "@/features/visits/vitals";
import { businessRuleError, fromPostgrestError, notFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getPlatformSettings } from "@/lib/platform/settings";
import { allInOrder } from "@/lib/parallel";
import { renderPdf } from "@/lib/pdf/render";
import { pdfResponse } from "@/lib/pdf/response";
import type { Tenant } from "@/lib/supabase/tenant";

import { billSheet, layoutBill } from "./bill";
import { collectionsSheet, layoutCollections } from "./collections";
import { billFileName, collectionsFileName, prescriptionFileName, receiptFileName } from "./names";
import { layoutPrescription, prescriptionSheet } from "./prescription";
import { layoutReceipt, receiptSheet } from "./receipt";
import type { BillSource, PrescriptionSource, ReceiptSource } from "./types";

/**
 * The prescription's and the bill's PDFs (plan §13, §15.5, §33; D218 –
 * D224): made from the stored records when they are asked for, streamed
 * with no-store, and kept nowhere (AGENTS.md §19). Read as the member —
 * `visits.view` or `payments.view`, within the doctor scope (D3), the
 * clinic's own — and in a view-only clinic too: printing what is there is
 * reading. Each waits on two round trips after the session: the record and
 * the clinic at once, then the logo.
 */

/** What the printout reads of a visit, in one query. */
const COLUMNS =
  "visit_date, diagnosis, follow_up_on, " +
  "patient:patients!visits_patient_id_clinic_id_fkey(full_name, patient_number, date_of_birth, gender), " +
  "doctor:doctors!visits_doctor_id_clinic_id_fkey(registration_number, qualifications, specialization, " +
  "member:clinic_members(profile:profiles!clinic_members_user_id_fkey(full_name))), " +
  "vitals:vitals!vitals_visit_id_clinic_id_fkey(systolic, diastolic, pulse, temperature_f, spo2, respiratory_rate, weight_kg, height_cm), " +
  "prescription:prescriptions!prescriptions_visit_id_clinic_id_fkey(advice, print_diagnosis, " +
  "items:prescription_items(position, medicine, strength, dose, frequency, timing, duration_days, instructions))";

/** The prescription as the printout reads it: what it says, its medicines in their places. */
interface PrescriptionRead {
  advice: string | null;
  print_diagnosis: boolean;
  items: (PrescriptionItemRow & { position: number })[];
}

interface SourceRow {
  visit_date: string;
  diagnosis: string | null;
  follow_up_on: string | null;
  patient: { full_name: string; patient_number: number; date_of_birth: string; gender: Gender };
  doctor: {
    registration_number: string | null;
    qualifications: string | null;
    specialization: string | null;
    member: { profile: { full_name: string } | null } | null;
  } | null;
  /** Embedded through their foreign keys: one row, a list of at most one, or none. */
  vitals: VitalsRow | VitalsRow[] | null;
  prescription: PrescriptionRead | PrescriptionRead[] | null;
}

/** An embedded row, however PostgREST gives it: one, a list of at most one, or none. */
const oneOf = <Row>(embedded: Row | Row[] | null): Row | null =>
  Array.isArray(embedded) ? (embedded[0] ?? null) : embedded;

/** A visit's prescription to print: refused while it has no medicine, or its doctor no registration number. */
async function readVisit(tenant: Tenant, visitId: string): Promise<Omit<PrescriptionSource, "clinic">> {
  const { data, error } = await tenant.supabase
    .from("visits")
    .select(COLUMNS)
    .eq("clinic_id", tenant.clinicId)
    .eq("id", visitId)
    .maybeSingle();
  if (error) throw fromPostgrestError(error);
  if (data === null) throw notFoundError("RECORD_NOT_FOUND");
  const row = data as unknown as SourceRow;
  const embedded = oneOf(row.prescription);
  if (embedded === null || embedded.items.length === 0) throw notFoundError("PRESCRIPTION_EMPTY");
  const registration = row.doctor?.registration_number ?? null;
  if (row.doctor === null || registration === null) throw businessRuleError("PRESCRIPTION_NEEDS_REGISTRATION");
  const prescription = toContent({
    items: [...embedded.items].sort((a, b) => a.position - b.position),
    advice: embedded.advice,
    print_diagnosis: embedded.print_diagnosis,
  });
  const vitals = oneOf(row.vitals);
  return {
    doctor: {
      name: row.doctor.member?.profile?.full_name ?? null,
      qualifications: row.doctor.qualifications,
      specialization: row.doctor.specialization,
      registration,
    },
    patient: {
      name: row.patient.full_name,
      number: row.patient.patient_number,
      dateOfBirth: row.patient.date_of_birth,
      gender: row.patient.gender,
    },
    day: row.visit_date,
    vitals: vitals === null ? null : toVitals(vitals),
    // The diagnosis prints only when the doctor ticked it (D216).
    diagnosis: prescription.printDiagnosis ? row.diagnosis : null,
    prescription,
    followUpOn: row.follow_up_on,
  };
}

/**
 * The logo as a PDF can hold it: PNG or JPEG as stored, WebP turned into a
 * PNG. One that cannot be read prints the letterhead without it, rather
 * than no prescription at all.
 */
async function logoForPdf(tenant: Tenant, path: string | null): Promise<Buffer | null> {
  if (path === null) return null;
  try {
    const { file, type } = await downloadLogo(tenant, path);
    const bytes = Buffer.from(await file.arrayBuffer());
    return type === "image/webp" ? await sharp(bytes).png().toBuffer() : bytes;
  } catch (failure) {
    logger.warn("Logo not read for a document; the letterhead is drawn without it", {
      clinicId: tenant.clinicId,
      reason: failure instanceof Error ? failure.name : "unknown",
    });
    return null;
  }
}

/**
 * `GET /api/visits/{id}/prescription.pdf`: the PDF to open and print (D221)
 * or, `download`ed, to save as "{patient} - {day} - Prescription.pdf" (D223).
 */
export async function getPrescriptionPdf(
  tenant: Tenant,
  visitId: string,
  { download, requestId }: { download: boolean; requestId: string },
): Promise<Response> {
  const [visit, { clinic, logoPath }] = await allInOrder([readVisit(tenant, visitId), getClinicForDocuments(tenant)]);
  const logo = await logoForPdf(tenant, logoPath);
  const source: PrescriptionSource = {
    ...visit,
    clinic: {
      name: clinic.name,
      address: clinic.address,
      city: clinic.city,
      phone: clinic.phone,
      paperSize: clinic.paperSize,
    },
  };
  const sheet = prescriptionSheet(source, { logo: logo !== null });
  const file = await renderPdf({
    paper: clinic.paperSize,
    title: UI_TEXT.documents.prescriptionTitle(sheet.patient, sheet.date),
    author: clinic.name,
    logo,
    compose: (measure) => layoutPrescription(sheet, measure),
  });
  return pdfResponse(file, { name: prescriptionFileName(source.patient.name, source.day), download, requestId });
}

/**
 * `GET /api/bills/{id}/bill.pdf` (plan §15.5): the bill to open and print or,
 * `download`ed, to save as "{patient} - Bill {number}.pdf" — a void one too,
 * VOID across it (D315).
 */
export async function getBillPdf(
  tenant: Tenant,
  billId: string,
  { download, requestId }: { download: boolean; requestId: string },
): Promise<Response> {
  const [bill, { clinic, logoPath }] = await allInOrder([getBill(tenant, billId), getClinicForDocuments(tenant)]);
  const logo = await logoForPdf(tenant, logoPath);
  const source: BillSource = {
    bill,
    clinic: {
      name: clinic.name,
      address: clinic.address,
      city: clinic.city,
      phone: clinic.phone,
      gstin: clinic.gstin,
      paperSize: clinic.paperSize,
    },
  };
  const sheet = billSheet(source, { logo: logo !== null });
  const file = await renderPdf({
    paper: clinic.paperSize,
    title: UI_TEXT.documents.billTitle(bill.number, bill.patient.name),
    author: clinic.name,
    logo,
    compose: (measure) => layoutBill(sheet, measure),
  });
  return pdfResponse(file, { name: billFileName(bill.patient.name, bill.number), download, requestId });
}

/**
 * `GET /api/reports/daily/collections.pdf` (plan §18; D49, D359): a day's
 * collections to open and print or, `download`ed, to save as "Collections -
 * 27 Oct 2026.pdf". For `reports.view`; the day's report and the clinic at
 * once, then the logo. It locks nothing.
 */
export async function getCollectionsPdf(
  tenant: Tenant,
  { day, download, requestId }: { day: string; download: boolean; requestId: string },
): Promise<Response> {
  const [report, { clinic, logoPath }] = await allInOrder([
    getDailyReport(tenant, { day }),
    getClinicForDocuments(tenant),
  ]);
  const logo = await logoForPdf(tenant, logoPath);
  const source = {
    report,
    clinic: {
      name: clinic.name,
      address: clinic.address,
      city: clinic.city,
      phone: clinic.phone,
      paperSize: clinic.paperSize,
    },
  };
  const sheet = collectionsSheet(source, { logo: logo !== null });
  const file = await renderPdf({
    paper: clinic.paperSize,
    title: UI_TEXT.documents.collectionsTitle(sheet.date),
    author: clinic.name,
    logo,
    compose: (measure) => layoutCollections(sheet, measure),
  });
  return pdfResponse(file, { name: collectionsFileName(day), download, requestId });
}

/** A plan payment with a receipt, as `subscription_payments` (0005) holds it. */
interface ReceiptRow {
  receipt_number: string | null;
  plan: ExtensionKind;
  amount_paise: number;
  method: PaymentMethod;
  reference: string | null;
  paid_on: string;
  valid_from: string;
  valid_until: string;
  created_at: string;
}

const RECEIPT_COLUMNS =
  "receipt_number, plan, amount_paise, method, reference, paid_on, valid_from, valid_until, created_at";

type Settings = Awaited<ReturnType<typeof getPlatformSettings>>;

/** The receipt's source, from its payment — none for a change at no charge, which has no receipt (D58). */
function receiptOf(
  row: ReceiptRow | null,
  clinic: { name: string; city: string },
  owner: string,
  settings: Settings,
): ReceiptSource {
  if (!row?.receipt_number) throw notFoundError("RECORD_NOT_FOUND");
  return {
    receiptNumber: row.receipt_number,
    kind: row.plan,
    amountPaise: row.amount_paise,
    method: row.method,
    reference: row.reference,
    paidOn: row.paid_on,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    recordedAt: row.created_at,
    clinic,
    owner,
    business: { name: settings.businessName, address: settings.businessAddress },
  };
}

/** Draws a receipt on A5 (D392) and answers it to open, or `download`ed, to save. */
async function receiptPdf(
  source: ReceiptSource,
  { download, requestId }: { download: boolean; requestId: string },
): Promise<Response> {
  const sheet = receiptSheet(source);
  const file = await renderPdf({
    paper: "A5",
    title: UI_TEXT.documents.receipt.title(sheet.number),
    author: sheet.business.name,
    logo: null,
    compose: (measure) => layoutReceipt(sheet, measure),
  });
  return pdfResponse(file, { name: receiptFileName(sheet.number), download, requestId });
}

/**
 * `GET /api/subscription/payments/[id]/receipt.pdf` (plan §7.5; D58, D393):
 * the owner's receipt for a payment of their clinic's plan — read as the
 * owner, whom alone RLS lets read it — with the clinic and the live business
 * details, at once. A view-only clinic's too. Kept nowhere.
 */
export async function getPlanReceiptPdf(
  tenant: Tenant,
  owner: string,
  paymentId: string,
  options: { download: boolean; requestId: string },
): Promise<Response> {
  const [payment, clinic, settings] = await allInOrder([
    tenant.supabase.from("subscription_payments").select(RECEIPT_COLUMNS).eq("id", paymentId).maybeSingle(),
    tenant.supabase.from("clinics").select("name, city").eq("id", tenant.clinicId).single(),
    getPlatformSettings(),
  ]);
  if (payment.error) throw fromPostgrestError(payment.error);
  if (clinic.error) throw fromPostgrestError(clinic.error);
  const place = clinic.data as { name: string; city: string };
  return receiptPdf(receiptOf(payment.data as ReceiptRow | null, place, owner, settings), options);
}

/** A payment as the console reads it for its receipt: with its clinic and the clinic's owner. */
interface ConsoleReceiptRow extends ReceiptRow {
  clinic: { name: string; city: string; members: { profile: { full_name: string } }[] };
}

/**
 * `GET /api/admin/payments/[id]/receipt.pdf` (D395): the same receipt for the
 * DEV, to send the owner a copy — read as the server, the payment with its
 * clinic and owner in one query, beside the live business details. A
 * receipt is the platform's own record; it shows nothing of the clinic's.
 */
export async function getConsoleReceiptPdf(
  admin: SupabaseClient,
  paymentId: string,
  options: { download: boolean; requestId: string },
): Promise<Response> {
  const [payment, settings] = await allInOrder([
    admin
      .from("subscription_payments")
      .select(
        `${RECEIPT_COLUMNS}, clinic:clinics(name, city, members:clinic_members!inner(profile:profiles!clinic_members_user_id_fkey(full_name)))`,
      )
      .eq("id", paymentId)
      .eq("clinic.members.role", "OWNER")
      .maybeSingle(),
    getPlatformSettings(admin),
  ]);
  if (payment.error) throw fromPostgrestError(payment.error);
  const row = payment.data as unknown as ConsoleReceiptRow | null;
  if (!row) throw notFoundError("RECORD_NOT_FOUND");
  const { name, city, members } = row.clinic;
  return receiptPdf(receiptOf(row, { name, city }, members[0].profile.full_name, settings), options);
}
