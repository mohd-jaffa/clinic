// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import type { BookingPayload } from "@/lib/validation";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe, addPatient } = vi.hoisted(() => ({ logActionSafe: vi.fn(), addPatient: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));
vi.mock("@/features/patients/api", () => ({ addPatient }));

const { bookAppointment, listBookedTimes } = await import("@/features/appointments/api");

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
