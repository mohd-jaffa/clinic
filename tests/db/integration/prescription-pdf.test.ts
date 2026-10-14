import { randomUUID } from "node:crypto";

import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GET as pdfRoute } from "@/app/api/visits/[id]/prescription.pdf/route";
import type { Permission } from "@/constants/permissions";
import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { LOGO_BUCKET } from "@/constants/uploads";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { replaceLogo } from "@/features/clinic/api";
import { getPrescriptionPdf } from "@/features/documents/api";
import { savePrescription } from "@/features/prescriptions/records";
import type { PrescriptionContent } from "@/features/prescriptions/types";
import { saveVitals, updateVisit } from "@/features/visits/records";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { formatDate } from "@/lib/format/date";
import type { Tenant } from "@/lib/supabase/tenant";
import { savePrescriptionSchema, saveVitalsSchema, visitChangeSchema, walkInSchema } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  setValidUntil,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * The prescription's PDF (plan §13, §33; R6.4, D218 – D224), made from the
 * stored records as it is asked for: on the clinic's paper, opened inline or
 * saved under "{patient} - {date} - Prescription.pdf", never kept. For whoever
 * reads the visit, within the doctor scope, in a view-only clinic too; refused
 * while there is no medicine on it, or no registration number for its doctor.
 * The clinic's logo heads it — a WebP turned into PNG — and one that cannot
 * be read leaves the letterhead without it.
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
];
const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit"];

const A5 = "/MediaBox [0 0 419.53 595.28]";
const A4 = "/MediaBox [0 0 595.28 841.89]";

let clinic: TestClinic;
let desk: Member;
let reader: Member;
let doctorA: Member;
let doctorB: Member;
const doctors = { A: "", B: "" };
let consultation: string;
/** Rohan's visit with doctor A: vitals, a printed diagnosis, a review, and his prescription. */
let visitId: string;
let day: string;

const doctorIdOf = async (memberId: string) =>
  (await admin().from("doctors").select("id").eq("member_id", memberId).single()).data!.id as string;

/** A patient walked in to a doctor and sent in, and their open visit. */
async function inRoom(name: string, doctorId = doctors.A) {
  const { data, error } = await desk
    .tenant!.supabase.rpc("create_patient", {
      p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: data.patient_id }, doctorId, typeId: consultation }),
    randomUUID(),
  );
  const { visitId: id } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
  return { visitId: id, appointmentId: arrival.id };
}

const prescribe = (
  tenant: Tenant,
  id: string,
  items: { medicine: string }[],
  { printDiagnosis = false, seen = null }: { printDiagnosis?: boolean; seen?: PrescriptionContent | null } = {},
) =>
  savePrescription(
    tenant,
    id,
    savePrescriptionSchema.parse({
      prescription: {
        items: items.map((item) => ({
          strength: "500 mg",
          dose: "1 tab",
          frequency: "1-0-1",
          timing: "AFTER_FOOD",
          durationDays: "5",
          instructions: "",
          ...item,
        })),
        advice: "Plenty of fluids",
        printDiagnosis,
      },
      seen,
    }),
  );

/** The PDF as asked of the feature, its body read as the bytes it is. */
async function pdf(tenant: Tenant, id = visitId, download = false) {
  const response = await getPrescriptionPdf(tenant, id, { download, requestId: "req_test" });
  return { response, raw: Buffer.from(await response.arrayBuffer()).toString("latin1") };
}

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  [desk, reader, doctorA, doctorB] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "visits.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
  ]);
  [doctors.A, doctors.B] = await Promise.all([doctorIdOf(doctorA.memberId), doctorIdOf(doctorB.memberId)]);
  await admin()
    .from("doctors")
    .update({ registration_number: "KMC 12345", qualifications: "BDS, MDS" })
    .eq("id", doctors.A);
  consultation = (
    await admin()
      .from("appointment_types")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .single()
  ).data!.id as string;

  ({ visitId } = await inRoom("Rohan Mehta"));
  await saveVitals(
    doctorA.tenant!,
    { visitId },
    saveVitalsSchema.parse({
      vitals: {
        systolic: "120",
        diastolic: "80",
        pulse: "72",
        temperatureF: "98.6",
        spo2: "",
        respiratoryRate: "",
        weightKg: "64",
        heightCm: "162",
      },
      seen: null,
    }),
  );
  await updateVisit(
    doctorA.tenant!,
    visitId,
    visitChangeSchema.parse({
      section: "NOTES",
      changes: { complaint: "Fever", diagnosis: "Viral fever", notes: "" },
      seen: { complaint: null, diagnosis: null, notes: null },
    }),
  );
  await updateVisit(
    doctorA.tenant!,
    visitId,
    visitChangeSchema.parse({
      section: "FOLLOW_UP",
      changes: { followUpOn: addDaysKey(todayKey(), 7) },
      seen: { followUpOn: null },
    }),
  );
  await prescribe(doctorA.tenant!, visitId, [{ medicine: "Paracetamol" }, { medicine: "Cetirizine" }], {
    printDiagnosis: true,
  });
  day = (await admin().from("visits").select("visit_date").eq("id", visitId).single()).data!.visit_date as string;
});

afterAll(removeAll);

describe("getPrescriptionPdf (D221, D223)", () => {
  it("answers the PDF to open, on the clinic's paper, named for the patient and the day, never kept", async () => {
    await admin().from("clinics").update({ paper_size: "A5" }).eq("id", clinic.clinicId);
    const name = `Rohan Mehta - ${formatDate(day)} - Prescription.pdf`;
    const { response, raw } = await pdf(doctorA.tenant!);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      `inline; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-request-id")).toBe("req_test");
    expect(raw.startsWith("%PDF")).toBe(true);
    expect(raw).toContain(A5);
    expect(raw).not.toContain(A4);
    // Titled for the patient and the day, by the clinic (the info strings stand as objects of their own).
    expect(raw).toContain(`(Prescription for Rohan Mehta, ${formatDate(day)})`);
    expect(raw).toContain("(Smile Care)");
    expect(raw).toContain("Figtree");
    expect(raw).not.toContain("Helvetica");
  });

  it("is saved as an attachment when downloaded, and printed on A4 when the clinic prints on A4", async () => {
    await admin().from("clinics").update({ paper_size: "A4" }).eq("id", clinic.clinicId);
    const { response, raw } = await pdf(doctorA.tenant!, visitId, true);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="Rohan Mehta - /);
    expect(raw).toContain(A4);
    expect(raw).not.toContain(A5);
    await admin().from("clinics").update({ paper_size: "A5" }).eq("id", clinic.clinicId);
  });

  it("is for whoever reads visits, and kept within the doctor scope and the clinic", async () => {
    expect((await pdf(reader.tenant!)).raw).toContain(A5);
    await expect(pdf(doctorB.tenant!)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    const other = await registerClinic({ clinicName: "Other Care" });
    await expect(pdf(other.owner.tenant)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
  });

  it("is refused while there is no medicine on it: none written, or every one removed", async () => {
    const none = await inRoom("Sunil Nair");
    await expect(pdf(doctorA.tenant!, none.visitId)).rejects.toMatchObject({ code: "PRESCRIPTION_EMPTY" });

    const emptied = await inRoom("Kiran Das");
    const written = await prescribe(doctorA.tenant!, emptied.visitId, [{ medicine: "Paracetamol" }]);
    await prescribe(doctorA.tenant!, emptied.visitId, [], { seen: written.prescription });
    await expect(pdf(doctorA.tenant!, emptied.visitId)).rejects.toMatchObject({ code: "PRESCRIPTION_EMPTY" });
    await Promise.all([none, emptied].map(({ appointmentId }) => markDone(desk.tenant!, { appointmentId })));
  });

  it("is refused once its doctor has no registration number (D213)", async () => {
    await admin().from("doctors").update({ registration_number: null }).eq("id", doctors.A);
    try {
      await expect(pdf(reader.tenant!)).rejects.toMatchObject({ code: "PRESCRIPTION_NEEDS_REGISTRATION" });
    } finally {
      await admin().from("doctors").update({ registration_number: "KMC 12345" }).eq("id", doctors.A);
    }
  });
});

describe("the letterhead's logo", () => {
  it("heads it — a WebP turned into a PNG — and one that cannot be read leaves the letterhead without it", async () => {
    expect((await pdf(reader.tenant!)).raw).not.toContain("/Subtype /Image");

    const webp = await sharp({
      create: { width: 120, height: 120, channels: 4, background: { r: 28, g: 106, b: 68, alpha: 1 } },
    })
      .webp()
      .toBuffer();
    await replaceLogo(clinic.owner.tenant, new Uint8Array(webp));
    expect((await pdf(reader.tenant!)).raw).toContain("/Subtype /Image");

    // Its file gone from storage, its path still on the clinic: printed all the same, without it.
    const { data } = await admin().from("clinics").select("logo_path").eq("id", clinic.clinicId).single();
    const { error } = await admin()
      .storage.from(LOGO_BUCKET)
      .remove([data!.logo_path as string]);
    expect(error).toBeNull();
    const { response, raw } = await pdf(reader.tenant!);
    expect(response.status).toBe(200);
    expect(raw.startsWith("%PDF")).toBe(true);
    expect(raw).not.toContain("/Subtype /Image");
  });
});

describe("in a view-only clinic (plan §7.3)", () => {
  beforeAll(async () => {
    await setValidUntil(clinic.clinicId, addDaysKey(todayKey(), -PLATFORM_SETTING_DEFAULTS.graceDays - 30));
  });

  it("is still printed through its route: printing what is there is reading", async () => {
    const request = new Request(`http://localhost/api/visits/${visitId}/prescription.pdf?download=1`, {
      headers: { authorization: `Bearer ${reader.session.accessToken}` },
    });
    const response = await pdfRoute(request, { params: Promise.resolve({ id: visitId }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; /);
    expect(
      Buffer.from(await response.arrayBuffer())
        .toString("latin1")
        .startsWith("%PDF"),
    ).toBe(true);
  });
});
