import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { markReminded } from "@/features/appointments/api";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
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
 * Reminders on WhatsApp (plan §22.1; R5.7, D179 – D184): a booking still to
 * come is noted as reminded — again each time — audited from when it was
 * last sent; nothing else is; and only someone who may change appointments,
 * in a clinic that can write, notes one.
 */
type Member = SignedIn & { memberId: string };

let clinic: TestClinic;
let desk: Member;
let reader: Member;
let doctorId: string;
let consultation: string;
let patientId: string;

const tomorrow = addDaysKey(todayKey(), 1);

/** An appointment put in place as it stood. */
async function placed(fields: Record<string, unknown>) {
  const { data, error } = await admin()
    .from("appointments")
    .insert({
      clinic_id: clinic.clinicId,
      patient_id: patientId,
      doctor_id: doctorId,
      source: "BOOKED",
      appointment_type_id: consultation,
      scheduled_at: dayHour(tomorrow, 10),
      duration_minutes: 15,
      ...fields,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
  [desk, reader] = await Promise.all([
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view", "appointments.edit"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view"] }),
  ]);
  doctorId = (await admin().from("doctors").select("id").eq("clinic_id", clinic.clinicId).single()).data!.id as string;
  consultation = (
    await admin()
      .from("appointment_types")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("name", "Consultation")
      .single()
  ).data!.id as string;
  const { data, error } = await clinic.owner.tenant.supabase
    .rpc("create_patient", {
      p_patient: { full_name: "Rohan Mehta", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  patientId = data.patient_id;
});

afterAll(removeAll);

describe("markReminded (plan §22.1, D180)", () => {
  it("notes a booking still to come as reminded — again each time — audited from when it was last sent", async () => {
    const id = await placed({});
    const first = await markReminded(desk.tenant!, id, "req_remind");
    const { data: row } = await admin().from("appointments").select("reminded_at").eq("id", id).single();
    expect(new Date(row!.reminded_at as string).getTime()).toBe(new Date(first.remindedAt).getTime());

    const again = await markReminded(desk.tenant!, id);
    expect(new Date(again.remindedAt).getTime()).toBeGreaterThanOrEqual(new Date(first.remindedAt).getTime());
    const { data: audits } = await admin()
      .from("audit_logs")
      .select("action, changes, actor_id")
      .eq("entity_id", id)
      .order("created_at");
    expect(audits).toHaveLength(2);
    expect(audits![0]).toMatchObject({
      action: "UPDATE",
      actor_id: desk.userId,
      changes: { reminded_at: { from: null } },
    });
    expect(new Date((audits![1].changes as { reminded_at: { from: string } }).reminded_at.from).getTime()).toBe(
      new Date(first.remindedAt).getTime(),
    );
  });

  it("notes a confirmed one, and one later today", async () => {
    await expect(
      markReminded(desk.tenant!, await placed({ status: "CONFIRMED", scheduled_at: dayHour(tomorrow, 11) })),
    ).resolves.toMatchObject({ remindedAt: expect.any(String) });
    const today = new Date(Math.floor(Date.now() / 300_000) * 300_000).toISOString();
    await expect(markReminded(desk.tenant!, await placed({ scheduled_at: today }))).resolves.toMatchObject({
      remindedAt: expect.any(String),
    });
  });

  it("notes nothing but a booking still to come (D184)", async () => {
    const walkIn = await placed({
      source: "WALK_IN",
      status: "ARRIVED",
      token_number: 1,
      scheduled_at: new Date().toISOString(),
      arrived_at: new Date().toISOString(),
    });
    const cancelled = await placed({
      scheduled_at: dayHour(tomorrow, 12),
      status: "CANCELLED",
      cancel_reason: "Patient asked",
      cancelled_at: new Date().toISOString(),
    });
    const past = await placed({ scheduled_at: dayHour(addDaysKey(todayKey(), -1), 10) });
    for (const id of [walkIn, cancelled, past]) {
      await expect(markReminded(desk.tenant!, id)).rejects.toMatchObject({ code: "APPOINTMENT_NOT_REMINDABLE" });
    }
  });

  it("needs appointments.edit (D182), and a clinic that can write (D181)", async () => {
    const id = await placed({ scheduled_at: dayHour(tomorrow, 13) });
    await expect(markReminded(reader.tenant!, id)).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });

    await setValidUntil(clinic.clinicId, addDaysKey(todayKey(), -60));
    await expect(markReminded(desk.tenant!, id)).rejects.toMatchObject({ code: "CLINIC_PLAN_EXPIRED" });
  });
});
