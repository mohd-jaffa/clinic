// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import type { BookingPayload } from "@/lib/validation";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe, addPatient } = vi.hoisted(() => ({ logActionSafe: vi.fn(), addPatient: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));
vi.mock("@/features/patients/api", () => ({ addPatient }));

const { bookAppointment, listAppointments, listBookedTimes } = await import("@/features/appointments/api");

function tenantWith(options: FakeSupabaseOptions, member: Partial<Tenant> = {}) {
  const fake = fakeSupabase(options);
  const tenant: Tenant = {
    supabase: fake.client,
    clinicId: "clinic-1",
    actorId: "user-1",
    memberId: "member-1",
    role: "OWNER",
    permissions: [],
    doctorId: null,
    ...member,
  };
  return { ...fake, tenant };
}

const found: BookingPayload = {
  patient: { mode: "FOUND", id: "p-1" },
  doctorId: "d-1",
  typeId: "t-1",
  scheduledAt: "2026-10-13T05:00:00.000Z",
  minutes: 15,
  notes: "Bring the X-ray",
};
const meera = {
  mode: "NEW" as const,
  fullName: "Meera Pillai",
  phone: "+919876543210",
  born: { dateOfBirth: "1992-10-11", dobIsEstimated: true },
  gender: "FEMALE" as const,
};
const added = {
  id: "p-9",
  number: 1009,
  name: "Meera Pillai",
  phone: "+919876543210",
  dateOfBirth: "1992-10-11",
  gender: "FEMALE",
};
const booked = { data: { appointment_id: "a-1", created: true } };
const clash = {
  error: {
    ...postgrestError("P0001"),
    hint: "APPOINTMENT_SLOT_TAKEN",
    details: '{"startsAt": "2026-10-13T04:30:00+00:00", "endsAt": "2026-10-13T05:00:00+00:00"}',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  addPatient.mockResolvedValue({ id: "p-9", recorded: Promise.resolve(added) });
});

describe("bookAppointment (D144, D150)", () => {
  it("books a patient found through create_appointment with its key, audits it with its notes by name, and answers", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => booked });
    expect(await bookAppointment(tenant, found, "key-1", "req_1")).toEqual({
      id: "a-1",
      patientId: "p-1",
      scheduledAt: "2026-10-13T05:00:00.000Z",
      minutes: 15,
    });
    expect(rpcs).toEqual([
      {
        name: "create_appointment",
        args: {
          p_appointment: {
            patient_id: "p-1",
            doctor_id: "d-1",
            appointment_type_id: "t-1",
            scheduled_at: "2026-10-13T05:00:00.000Z",
            duration_minutes: 15,
            notes: "Bring the X-ray",
          },
          p_idempotency_key: "key-1",
        },
      },
    ]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "CREATE",
      entityType: "appointments",
      entityId: "a-1",
      changes: {
        patient_id: { from: null, to: "p-1" },
        doctor_id: { from: null, to: "d-1" },
        appointment_type_id: { from: null, to: "t-1" },
        scheduled_at: { from: null, to: "2026-10-13T05:00:00.000Z" },
        duration_minutes: { from: null, to: 15 },
        fields: ["notes"],
      },
      requestId: "req_1",
    });
    expect(addPatient).not.toHaveBeenCalled();
  });

  it("audits nothing for the booking a repeat of the key finds", async () => {
    const { tenant } = tenantWith({ rpc: () => ({ data: { appointment_id: "a-1", created: false } }) });
    expect((await bookAppointment(tenant, found, "key-1")).id).toBe("a-1");
    expect(logActionSafe).not.toHaveBeenCalled();
  });

  it("says why a booking of a patient found was refused, in its own words", async () => {
    const { tenant } = tenantWith({ rpc: () => clash });
    await expect(bookAppointment(tenant, found, "key-1")).rejects.toMatchObject({
      code: "APPOINTMENT_SLOT_TAKEN",
      kind: "CONFLICT",
      details: { startsAt: "2026-10-13T04:30:00+00:00", endsAt: "2026-10-13T05:00:00+00:00" },
    });
  });
});

describe("a new patient booked with it (D145)", () => {
  const withNew: BookingPayload = { ...found, patient: meera, patientKey: "pkey-1" };
  const desk = {
    role: "STAFF" as const,
    permissions: ["patients.view", "patients.create", "appointments.create"] as Tenant["permissions"],
  };

  it("adds the patient under their own key, then books them", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => booked }, desk);
    expect((await bookAppointment(tenant, withNew, "key-1", "req_1")).patientId).toBe("p-9");
    expect(addPatient).toHaveBeenCalledWith(tenant, meera, "pkey-1", "req_1");
    expect((rpcs[0].args as { p_appointment: { patient_id: string } }).p_appointment.patient_id).toBe("p-9");
  });

  it("names the patient it added when the booking is refused, beside what refused it", async () => {
    const { tenant } = tenantWith({ rpc: () => clash }, desk);
    await expect(bookAppointment(tenant, withNew, "key-1")).rejects.toMatchObject({
      code: "APPOINTMENT_SLOT_TAKEN",
      kind: "CONFLICT",
      details: { startsAt: "2026-10-13T04:30:00+00:00", patient: added },
    });
    const refused = tenantWith(
      { rpc: () => ({ error: { ...postgrestError("P0001"), hint: "APPOINTMENT_IN_PAST" } }) },
      desk,
    );
    await expect(bookAppointment(refused.tenant, withNew, "key-1")).rejects.toMatchObject({
      code: "APPOINTMENT_IN_PAST",
      details: { patient: added },
    });
  });

  it("needs patients.create, and the patient's own key", async () => {
    const { tenant } = tenantWith({ rpc: () => booked }, { role: "STAFF", permissions: ["appointments.create"] });
    await expect(bookAppointment(tenant, withNew, "key-1")).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    const unkeyed = tenantWith({ rpc: () => booked }, desk);
    await expect(bookAppointment(unkeyed.tenant, { ...withNew, patientKey: undefined }, "key-1")).rejects.toMatchObject(
      {
        code: "IDEMPOTENCY_KEY_REQUIRED",
      },
    );
    expect(addPatient).not.toHaveBeenCalled();
  });
});

describe("listBookedTimes (D147)", () => {
  it("asks doctor_booked_times for the doctor's day, and answers each time's start and end", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({ data: [{ starts_at: "2026-10-13T04:30:00+00:00", ends_at: "2026-10-13T05:00:00+00:00" }] }),
    });
    expect(await listBookedTimes(tenant, { doctorId: "d-1", date: "2026-10-13" })).toEqual([
      { startsAt: "2026-10-13T04:30:00+00:00", endsAt: "2026-10-13T05:00:00+00:00" },
    ]);
    expect(rpcs).toEqual([{ name: "doctor_booked_times", args: { p_doctor_id: "d-1", p_day: "2026-10-13" } }]);
  });

  it("says why it could not ask", async () => {
    const { tenant } = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "AUTH_PERMISSION_DENIED" } }),
    });
    await expect(listBookedTimes(tenant, { doctorId: "d-1", date: "2026-10-13" })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});

describe("listAppointments (plan §11.5)", () => {
  const row = {
    id: "a-1",
    patient_id: "p-1",
    doctor_id: "d-1",
    source: "BOOKED",
    status: "CONFIRMED",
    scheduled_at: "2026-10-13T04:30:00+00:00",
    duration_minutes: 30,
    local_date: "2026-10-13",
    token_number: null,
    patient: { full_name: "Rohan Mehta", patient_number: 1012 },
    doctor: { member: { profile: { full_name: "Maya Rao" } } },
    type: { name: "Procedure" },
  };

  it("reads the days asked, by time, with each patient, doctor and type, in one query", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: [row] }) });
    expect(await listAppointments(tenant, { from: "2026-10-13", to: "2026-10-13" })).toEqual([
      {
        id: "a-1",
        patientId: "p-1",
        patientName: "Rohan Mehta",
        patientNumber: 1012,
        doctorId: "d-1",
        doctorName: "Maya Rao",
        typeName: "Procedure",
        source: "BOOKED",
        status: "CONFIRMED",
        scheduledAt: "2026-10-13T04:30:00+00:00",
        minutes: 30,
        day: "2026-10-13",
        token: null,
      },
    ]);
    expect(queries).toHaveLength(1);
    expect(queries[0].table).toBe("appointments");
    expect(argsOf(queries[0], "eq")).toEqual([["clinic_id", "clinic-1"]]);
    expect(argsOf(queries[0], "gte")).toEqual([["local_date", "2026-10-13"]]);
    expect(argsOf(queries[0], "lte")).toEqual([["local_date", "2026-10-13"]]);
    expect(argsOf(queries[0], "order")).toEqual([["scheduled_at"]]);
  });

  it("keeps to one doctor when asked, and reads a doctor no longer on the team as no name", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: [{ ...row, doctor: null }] }) });
    const [found] = await listAppointments(tenant, { from: "2026-10-12", to: "2026-10-18", doctorId: "d-1" });
    expect(found.doctorName).toBeNull();
    expect(argsOf(queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["doctor_id", "d-1"],
    ]);
  });

  it("says why it could not read them", async () => {
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("42501") }) });
    await expect(listAppointments(tenant, { from: "2026-10-13", to: "2026-10-13" })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });
});
