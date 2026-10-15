import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PAGE_SIZE } from "@/constants/limits";
import type { Permission } from "@/constants/permissions";
import {
  changeAppointment,
  changeAppointmentStatus,
  getAppointment,
  listPatientAppointments,
  nextAppointment,
} from "@/features/appointments/api";
import { getPatientSummary } from "@/features/patients/summary";
import { listPatientTimeline } from "@/features/patients/timeline";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
import { appointmentChangeSchema, type RescheduleInput } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * An appointment's detail and what it allows (plan §11.2; R5.4, D160 – D167):
 * read whole, with who booked and cancelled it; its notes changed, or moved —
 * a confirmed one scheduled again (D142); confirmed, a no-show, cancelled
 * with its reason, each audited from what to what; and a patient's next
 * appointment and history — read as the member, so a doctor finds only their
 * own patients', and none of it for someone who may not see appointments.
 */
type Member = SignedIn & { memberId: string };

const DESK: Permission[] = [
  "patients.view",
  "patients.create",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "appointments.cancel",
];

let clinic: TestClinic;
let desk: Member;
let confirmer: Member;
let reader: Member;
let doctorA: Member;
let doctorB: Member;
const doctors = { A: "", B: "" };
let consultation: string;
const patients = { rohan: "", anita: "", kiran: "" };

const tomorrow = addDaysKey(todayKey(), 1);
const nextWeek = addDaysKey(todayKey(), 7);

const doctorIdOf = async (memberId: string) => {
  const { data } = await admin().from("doctors").select("id").eq("member_id", memberId).single();
  return data!.id as string;
};

async function addPatient(name: string) {
  const { data, error } = await desk
    .tenant!.supabase.rpc("create_patient", {
      p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  return data.patient_id;
}

async function book(patientId: string, doctorId: string, day: string, hour: number, notes: string | null = null) {
  const { data, error } = await desk
    .tenant!.supabase.rpc("create_appointment", {
      p_appointment: {
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_type_id: consultation,
        scheduled_at: dayHour(day, hour),
        duration_minutes: 15,
        notes,
      },
      p_idempotency_key: randomUUID(),
    })
    .single<{ appointment_id: string }>();
  if (error) throw error;
  return data.appointment_id;
}

/** A move as the sheet holds it, parsed as the route parses it. */
const moved = (overrides: Partial<RescheduleInput> = {}) =>
  appointmentChangeSchema.parse({
    doctorId: doctors.A,
    date: tomorrow,
    time: { hour: "10", minute: "00" },
    typeId: consultation,
    length: { choice: "15", other: "" },
    notes: "",
    ...overrides,
  });

const auditsOf = async (entityId: string) => {
  const { data } = await admin()
    .from("audit_logs")
    .select("action, changes, actor_id")
    .eq("entity_id", entityId)
    .order("created_at");
  return data!;
};

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, confirmer, reader, doctorA, doctorB] = await Promise.all([
    addMember(clinic.clinicId, { permissions: DESK }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view", "appointments.edit"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "appointments.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "appointments.view"] }),
  ]);
  [doctors.A, doctors.B] = await Promise.all([doctorIdOf(doctorA.memberId), doctorIdOf(doctorB.memberId)]);
  const { data: type } = await admin()
    .from("appointment_types")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .eq("name", "Consultation")
    .single();
  consultation = type!.id as string;
  [patients.rohan, patients.anita, patients.kiran] = await Promise.all([
    addPatient("Rohan Mehta"),
    addPatient("Anita Rao"),
    addPatient("Kiran Das"),
  ]);
});

afterAll(removeAll);

describe("getAppointment (D160)", () => {
  it("reads one whole — who booked it and when, its notes, its type — for whoever sees appointments", async () => {
    const id = await book(patients.rohan, doctors.A, tomorrow, 9, "Bring the X-ray");
    const detail = await getAppointment(desk.tenant!, id);
    expect(detail).toMatchObject({
      id,
      patientId: patients.rohan,
      patientName: "Rohan Mehta",
      patientArchived: false,
      doctorId: doctors.A,
      doctorName: "Test doctor",
      typeId: consultation,
      typeName: "Consultation",
      source: "BOOKED",
      status: "SCHEDULED",
      minutes: 15,
      day: tomorrow,
      notes: "Bring the X-ray",
      bookedBy: "Test staff",
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
    });
    expect(new Date(detail.bookedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("opens only a doctor's own patients' (D3), and finds none it does not know", async () => {
    const id = await book(patients.anita, doctors.B, tomorrow, 11);
    expect((await getAppointment(doctorB.tenant!, id)).patientName).toBe("Anita Rao");
    await expect(getAppointment(doctorA.tenant!, id)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    await expect(getAppointment(desk.tenant!, randomUUID())).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
  });
});

describe("changeAppointmentStatus (plan §11.2, D162)", () => {
  it("confirms, audited from what to what — and a confirm sent twice changes nothing more", async () => {
    const id = await book(patients.rohan, doctors.A, tomorrow, 12);
    const confirmed = await changeAppointmentStatus(confirmer.tenant!, id, { status: "CONFIRMED", reason: null });
    expect(confirmed).toMatchObject({ id, status: "CONFIRMED", doctorId: doctors.A, minutes: 15 });
    await changeAppointmentStatus(confirmer.tenant!, id, { status: "CONFIRMED", reason: null }, "req_twice");

    const audits = await auditsOf(id);
    expect(audits.filter((audit) => audit.action === "STATUS_CHANGE")).toEqual([
      {
        action: "STATUS_CHANGE",
        actor_id: confirmer.userId,
        changes: { status: { from: "SCHEDULED", to: "CONFIRMED" } },
      },
    ]);
  });

  it("cancels with its reason, saying who and when — the reason audited by name alone", async () => {
    const id = await book(patients.kiran, doctors.A, tomorrow, 13);
    const cancelled = await changeAppointmentStatus(desk.tenant!, id, { status: "CANCELLED", reason: "Patient asked" });
    expect(cancelled.status).toBe("CANCELLED");

    const detail = await getAppointment(desk.tenant!, id);
    expect(detail).toMatchObject({ cancelReason: "Patient asked", cancelledBy: "Test staff" });
    expect(detail.cancelledAt).not.toBeNull();
    const audit = (await auditsOf(id)).at(-1)!;
    expect(audit.changes).toEqual({ status: { from: "SCHEDULED", to: "CANCELLED" }, fields: ["cancel_reason"] });
    expect(JSON.stringify(audit.changes)).not.toContain("Patient asked");
  });

  it("marks a no-show", async () => {
    const id = await book(patients.kiran, doctors.B, tomorrow, 14);
    expect((await changeAppointmentStatus(desk.tenant!, id, { status: "NO_SHOW", reason: null })).status).toBe(
      "NO_SHOW",
    );
  });

  it("needs appointments.cancel to cancel and appointments.edit for the rest", async () => {
    const id = await book(patients.rohan, doctors.A, tomorrow, 15);
    await expect(
      changeAppointmentStatus(confirmer.tenant!, id, { status: "CANCELLED", reason: "Patient asked" }),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    await expect(
      changeAppointmentStatus(reader.tenant!, id, { status: "CONFIRMED", reason: null }),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    expect((await getAppointment(desk.tenant!, id)).status).toBe("SCHEDULED");
  });

  it("refuses a move its status does not allow", async () => {
    const id = await book(patients.rohan, doctors.B, tomorrow, 16);
    await changeAppointmentStatus(desk.tenant!, id, { status: "CANCELLED", reason: "Clinic closed" });
    await expect(
      changeAppointmentStatus(desk.tenant!, id, { status: "CONFIRMED", reason: null }),
    ).rejects.toMatchObject({ code: "APPOINTMENT_STATUS_NOT_ALLOWED" });
  });
});

describe("changeAppointment (plan §11.1, D161)", () => {
  it("changes notes alone, keeping a confirmed one confirmed, audited by name", async () => {
    const id = await book(patients.anita, doctors.B, nextWeek, 9, "First visit");
    await changeAppointmentStatus(desk.tenant!, id, { status: "CONFIRMED", reason: null });
    const changed = await changeAppointment(
      desk.tenant!,
      id,
      appointmentChangeSchema.parse({ notes: "Bring reports" }),
    );
    expect(changed.status).toBe("CONFIRMED");
    expect((await getAppointment(desk.tenant!, id)).notes).toBe("Bring reports");

    const audit = (await auditsOf(id)).at(-1)!;
    expect(audit).toMatchObject({ action: "UPDATE", changes: { fields: ["notes"] } });
    expect(JSON.stringify(audit.changes)).not.toContain("reports");
  });

  it("moves a confirmed one to another time and schedules it again (D142), audited from where to where", async () => {
    const id = await book(patients.anita, doctors.B, nextWeek, 10);
    await changeAppointmentStatus(desk.tenant!, id, { status: "CONFIRMED", reason: null });
    const changed = await changeAppointment(
      desk.tenant!,
      id,
      moved({ doctorId: doctors.B, date: nextWeek, time: { hour: "11", minute: "30" }, notes: "Moved by phone" }),
    );
    expect(changed).toMatchObject({ status: "SCHEDULED", scheduledAt: expect.any(String) });
    expect(new Date(changed.scheduledAt).getTime()).toBe(new Date(dayHour(nextWeek, 11)).getTime() + 30 * 60_000);

    const audit = (await auditsOf(id)).at(-1)!;
    expect(audit.changes).toMatchObject({
      scheduled_at: { from: expect.any(String), to: expect.any(String) },
      status: { from: "CONFIRMED", to: "SCHEDULED" },
      fields: ["notes"],
    });
  });

  it("names the time taken when moved into another booking", async () => {
    await book(patients.kiran, doctors.A, nextWeek, 15);
    const id = await book(patients.rohan, doctors.A, nextWeek, 16);
    await expect(
      changeAppointment(desk.tenant!, id, moved({ date: nextWeek, time: { hour: "15", minute: "00" } })),
    ).rejects.toMatchObject({ code: "APPOINTMENT_SLOT_TAKEN", details: { startsAt: expect.any(String) } });
  });

  it("does not move one no longer a booking to come", async () => {
    const id = await book(patients.kiran, doctors.B, nextWeek, 17);
    await changeAppointmentStatus(desk.tenant!, id, { status: "CANCELLED", reason: "Patient asked" });
    await expect(
      changeAppointment(
        desk.tenant!,
        id,
        moved({ doctorId: doctors.B, date: nextWeek, time: { hour: "18", minute: "00" } }),
      ),
    ).rejects.toMatchObject({ code: "APPOINTMENT_NOT_MOVABLE" });
    // Notes change at any time (plan §11.1).
    const notes = await changeAppointment(desk.tenant!, id, appointmentChangeSchema.parse({ notes: "Called back" }));
    expect(notes.status).toBe("CANCELLED");
  });
});

describe("a patient's next appointment and history (D166, D167)", () => {
  let patientId: string;

  beforeAll(async () => {
    patientId = await addPatient("Meera Pillai");
    // More than a page of past visits, put in place as they stood.
    const { error } = await admin()
      .from("appointments")
      .insert(
        Array.from({ length: PAGE_SIZE }, (_, index) => ({
          clinic_id: clinic.clinicId,
          patient_id: patientId,
          doctor_id: doctors.A,
          source: "BOOKED",
          appointment_type_id: consultation,
          scheduled_at: dayHour(addDaysKey(todayKey(), -(index + 1)), 9),
          duration_minutes: 15,
          status: "COMPLETED",
        })),
      );
    if (error) throw error;
    const cancelled = await book(patientId, doctors.A, tomorrow, 17);
    await changeAppointmentStatus(desk.tenant!, cancelled, { status: "CANCELLED", reason: "Doctor unavailable" });
    await book(patientId, doctors.A, nextWeek, 12);
    await book(patientId, doctors.A, addDaysKey(nextWeek, 1), 12);
  });

  it("finds the soonest still to come — not one cancelled — or none", async () => {
    const next = await nextAppointment(desk.tenant!, patientId);
    expect(next).toMatchObject({ patientName: "Meera Pillai", day: nextWeek, status: "SCHEDULED" });
    expect(await nextAppointment(desk.tenant!, await addPatient("Sunil Nair"))).toBeNull();
  });

  it("lists every appointment newest first, a page and one more at a time, the cancelled with their reason", async () => {
    const first = await listPatientAppointments(desk.tenant!, patientId);
    expect(first).toHaveLength(PAGE_SIZE + 1);
    expect(first.map((appointment) => appointment.day).slice(0, 3)).toEqual([
      addDaysKey(nextWeek, 1),
      nextWeek,
      tomorrow,
    ]);
    expect(first[2]).toMatchObject({ status: "CANCELLED", cancelReason: "Doctor unavailable" });

    expect(await listPatientAppointments(desk.tenant!, patientId, PAGE_SIZE)).toHaveLength(3);
  });

  it("keeps a doctor to their own patients' (D3)", async () => {
    expect(await listPatientAppointments(doctorB.tenant!, patientId)).toEqual([]);
    expect(await nextAppointment(doctorB.tenant!, patientId)).toBeNull();
  });

  it("gives the summary and the history with appointments.view, and nothing of them without", async () => {
    expect((await getPatientSummary(desk.tenant!, patientId)).nextAppointment?.day).toBe(nextWeek);
    expect((await listPatientTimeline(desk.tenant!, patientId)).items).toHaveLength(PAGE_SIZE);
    expect(await getPatientSummary(reader.tenant!, patientId)).toEqual({});
    expect(await listPatientTimeline(reader.tenant!, patientId)).toEqual({ items: [], nextCursor: null });
  });
});
