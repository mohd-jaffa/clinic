import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { getBill, issueBill, voidBill } from "@/features/billing/api";
import { getBillPdf } from "@/features/documents/api";
import { billSchema, walkInSchema } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * A bill's page and its PDF (plan §15.2, §15.5; R8.5, D314 – D316), from the
 * feature functions against the local database: a bill read with its
 * patient, doctor, lines, people and where it stands with payment; its PDF
 * on the clinic's paper, named for the patient and the number; voided with a
 * reason — audited, its visit back in To bill, its PDF still printed — once;
 * within payments.view and payments.edit, the doctor scope and the clinic.
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "payments.view",
  "payments.create",
];

let clinic: TestClinic;
let other: TestClinic;
let desk: Member;
let maya: Member;
let arun: Member;
let issuer: Member;
let consultationType: string;
let consultation: string;
let mayaDoctor: string;
let patientId: string;
let visitId: string;
let billId: string;
let billNumber: string;

const A4 = "/MediaBox [0 0 595.28 841.89]";
const A5 = "/MediaBox [0 0 419.53 595.28]";

const pdf = async (tenant: SignedIn["tenant"], download = false) => {
  const response = await getBillPdf(tenant!, billId, { download, requestId: "req_test" });
  return { response, raw: Buffer.from(await response.arrayBuffer()).toString("latin1") };
};

beforeAll(async () => {
  [clinic, other] = await Promise.all([
    registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" }),
    registerClinic(),
  ]);
  [desk, maya, arun, issuer] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "visits.view", "payments.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "visits.view", "payments.view"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "payments.create"] }),
  ]);
  await Promise.all([
    admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId),
    admin().from("profiles").update({ full_name: "Priya Shah" }).eq("id", desk.userId),
    admin().from("clinics").update({ gstin: "32ABCDE1234F1Z5", paper_size: "A5" }).eq("id", clinic.clinicId),
  ]);
  const [{ data: doctor }, { data: type }, { data: seeded }] = await Promise.all([
    admin()
      .from("doctors")
      .update({ consultation_fee_paise: 80_000 })
      .eq("member_id", maya.memberId)
      .select("id")
      .single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
    admin().from("services").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  mayaDoctor = doctor!.id as string;
  consultationType = type!.id as string;
  consultation = seeded!.id as string;

  const { data: created, error } = await desk
    .tenant!.supabase.rpc("create_patient", {
      p_patient: { full_name: "Rohan Mehta", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  patientId = created.patient_id;
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId: mayaDoctor, typeId: consultationType }),
    randomUUID(),
  );
  ({ visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" }));
  await markDone(desk.tenant!, { appointmentId: arrival.id });

  const issued = await issueBill(
    desk.tenant!,
    billSchema.parse({
      patientId,
      visitId,
      appointmentId: null,
      lines: [{ kind: "SERVICE", serviceId: consultation, treatmentId: null, quantity: 1, price: "800" }],
      discount: { kind: "NONE" },
      notes: "Paid by his son",
      collect: { on: true, amount: "500", method: "UPI", reference: "UTR 1" },
    }),
    randomUUID(),
  );
  billId = issued.billId;
  billNumber = issued.billNumber;
});

afterAll(removeAll);

describe("getBill (plan §15.2; D314)", () => {
  it("reads the bill with its patient, doctor, lines and issuer, part paid, and the patient's balance", async () => {
    const bill = await getBill(desk.tenant!, billId);
    expect(bill).toMatchObject({
      id: billId,
      number: billNumber,
      status: "ISSUED",
      patient: { id: patientId, name: "Rohan Mehta", phone: "+919876543210", archived: false },
      visitId,
      appointmentId: null,
      doctor: "Maya Rao",
      lines: [{ description: "Consultation", quantity: 1, unitPricePaise: 80_000, amountPaise: 80_000 }],
      subtotalPaise: 80_000,
      discountPaise: 0,
      totalPaise: 80_000,
      notes: "Paid by his son",
      issuedBy: "Priya Shah",
      void: null,
      settlement: { paidPaise: 50_000, duePaise: 30_000, state: "PART_PAID" },
      balancePaise: 30_000,
    });
  });

  it("is for whoever reads bills, within the doctor scope and the clinic", async () => {
    // Maya saw him; Arun never has; someone who only issues bills reads none.
    expect((await getBill(maya.tenant!, billId)).id).toBe(billId);
    await expect(getBill(arun.tenant!, billId)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    await expect(getBill(issuer.tenant!, billId)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    await expect(getBill(other.owner.tenant, billId)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
  });
});

describe("getBillPdf (plan §15.5; D315, D316)", () => {
  it("answers the PDF to open, on the clinic's paper, named for the patient and the number, never kept", async () => {
    const name = `Rohan Mehta - Bill ${billNumber.replace("/", "-")}.pdf`;
    const { response, raw } = await pdf(desk.tenant);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      `inline; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(raw.startsWith("%PDF")).toBe(true);
    expect(raw).toContain(A5);
    expect(raw).toContain(`(Bill ${billNumber} for Rohan Mehta)`);
    expect(raw).toContain("Figtree");
  });

  it("is saved as an attachment when downloaded, on A4 when the clinic prints on A4; kept to the scope", async () => {
    await admin().from("clinics").update({ paper_size: "A4" }).eq("id", clinic.clinicId);
    const { response, raw } = await pdf(desk.tenant, true);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="Rohan Mehta - Bill /);
    expect(raw).toContain(A4);
    await admin().from("clinics").update({ paper_size: "A5" }).eq("id", clinic.clinicId);
    await expect(pdf(arun.tenant)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
  });
});

describe("voidBill (plan §15.2; D314)", () => {
  it("is for payments.edit", async () => {
    await expect(voidBill(desk.tenant!, billId, { reason: "Wrong" })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    await expect(voidBill(other.owner.tenant, billId, { reason: "Wrong" })).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
  });

  it("voids it once with its reason, audited, its visit back in To bill; its PDF still printed", async () => {
    const owner = clinic.owner.tenant;
    expect(await voidBill(owner, billId, { reason: "Wrong patient" }, "req_void")).toEqual({
      // The payment stays, now an advance.
      balancePaise: -50_000,
      visitToBill: true,
    });
    const bill = await getBill(desk.tenant!, billId);
    expect(bill).toMatchObject({
      status: "VOID",
      void: { reason: "Wrong patient", by: "Asha Menon" },
      settlement: null,
      balancePaise: -50_000,
    });
    const { data: visit } = await admin().from("visits").select("billing_status").eq("id", visitId).single();
    expect(visit!.billing_status).toBe("TO_BILL");

    const { data: audit } = await admin()
      .from("audit_logs")
      .select("entity_type, action, changes")
      .eq("request_id", "req_void")
      .order("entity_type");
    expect(audit).toEqual([
      {
        entity_type: "bills",
        action: "UPDATE",
        changes: { status: { from: "ISSUED", to: "VOID" }, void_reason: { from: null, to: "Wrong patient" } },
      },
      { entity_type: "visits", action: "UPDATE", changes: { billing_status: { from: "BILLED", to: "TO_BILL" } } },
    ]);

    // Again, nothing changes, and nothing more is audited.
    expect(await voidBill(owner, billId, { reason: "Again" }, "req_void_again")).toEqual({
      balancePaise: -50_000,
      visitToBill: false,
    });
    const { count } = await admin()
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("request_id", "req_void_again");
    expect(count).toBe(0);
    expect((await getBill(desk.tenant!, billId)).void!.reason).toBe("Wrong patient");

    const { response, raw } = await pdf(desk.tenant);
    expect(response.status).toBe(200);
    expect(raw.startsWith("%PDF")).toBe(true);
  });
});
