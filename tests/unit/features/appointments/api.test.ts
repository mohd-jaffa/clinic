// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/lib/supabase/tenant";
import type { BookingPayload } from "@/lib/validation";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { logActionSafe, addPatient } = vi.hoisted(() => ({ logActionSafe: vi.fn(), addPatient: vi.fn() }));
vi.mock("@/lib/audit/auditLog", () => ({ logActionSafe }));
vi.mock("@/features/patients/api", () => ({ addPatient }));

const {
  addWalkIn,
  bookAppointment,
  changeAppointment,
  changeAppointmentStatus,
  getAppointment,
  listAppointments,
  listBookedTimes,
  listPatientAppointments,
  listQueue,
  markArrived,
  markReminded,
  nextAppointment,
} = await import("@/features/appointments/api");

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

/** An appointment as a read hands it back, with its patient, doctor and type. */
const calendarRow = {
  id: "a-1",
  patient_id: "p-1",
  doctor_id: "d-1",
  source: "BOOKED",
  status: "SCHEDULED",
  scheduled_at: "2026-10-13T04:30:00+00:00",
  duration_minutes: 15,
  local_date: "2026-10-13",
  token_number: null,
  reminded_at: null,
  patient: { full_name: "Rohan Mehta", patient_number: 1012, phone: "+919876543210" },
  doctor: { member: { profile: { full_name: "Maya Rao" } } },
  type: { name: "Consultation" },
};
const asRead = {
  id: "a-1",
  patientId: "p-1",
  patientName: "Rohan Mehta",
  patientNumber: 1012,
  patientPhone: "+919876543210",
  doctorId: "d-1",
  doctorName: "Maya Rao",
  typeName: "Consultation",
  source: "BOOKED",
  status: "SCHEDULED",
  scheduledAt: "2026-10-13T04:30:00+00:00",
  minutes: 15,
  day: "2026-10-13",
  token: null,
  remindedAt: null,
};

describe("getAppointment (D160)", () => {
  const detailRow = {
    ...calendarRow,
    appointment_type_id: "t-1",
    notes: "Bring the X-ray",
    created_at: "2026-10-10T06:00:00+00:00",
    cancelled_at: "2026-10-11T06:00:00+00:00",
    cancel_reason: "Patient asked",
    patient: { full_name: "Rohan Mehta", patient_number: 1012, phone: "+919876543210", archived_at: null },
    booker: { full_name: "Priya Nair" },
    canceller: null,
    stepped_out_at: null,
    urgent_at: null,
    visit: null,
  };

  it("reads one whole in one query: what the calendar shows, its notes, and who booked and cancelled it", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: detailRow }) });
    expect(await getAppointment(tenant, "a-1")).toEqual({
      ...asRead,
      typeId: "t-1",
      patientArchived: false,
      notes: "Bring the X-ray",
      bookedAt: "2026-10-10T06:00:00+00:00",
      bookedBy: "Priya Nair",
      cancelledAt: "2026-10-11T06:00:00+00:00",
      cancelledBy: null,
      cancelReason: "Patient asked",
      visitId: null,
      steppedOutAt: null,
      urgentAt: null,
    });
    expect(queries).toHaveLength(1);
    expect(argsOf(queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["id", "a-1"],
    ]);
  });

  it("names its visit — however it is embedded — and when its patient stepped out or was marked urgent (D195, D198, D201)", async () => {
    const one = tenantWith({ answer: () => ({ data: { ...detailRow, visit: { id: "v-1" } } }) });
    expect(await getAppointment(one.tenant, "a-1")).toMatchObject({ visitId: "v-1" });
    const listed = tenantWith({
      answer: () => ({
        data: {
          ...detailRow,
          visit: [{ id: "v-2" }],
          stepped_out_at: "2026-10-13T05:00:00Z",
          urgent_at: "2026-10-13T04:55:00Z",
        },
      }),
    });
    expect(await getAppointment(listed.tenant, "a-1")).toMatchObject({
      visitId: "v-2",
      steppedOutAt: "2026-10-13T05:00:00Z",
      urgentAt: "2026-10-13T04:55:00Z",
    });
    const none = tenantWith({ answer: () => ({ data: { ...detailRow, visit: [] } }) });
    expect(await getAppointment(none.tenant, "a-1")).toMatchObject({ visitId: null });
  });

  it("names who cancelled it, says when its patient is archived, and reads a booker gone as no one", async () => {
    const { tenant } = tenantWith({
      answer: () => ({
        data: {
          ...detailRow,
          patient: { ...detailRow.patient, archived_at: "2026-10-12T00:00:00Z" },
          booker: null,
          canceller: { full_name: "Asha Menon" },
        },
      }),
    });
    expect(await getAppointment(tenant, "a-1")).toMatchObject({
      patientArchived: true,
      bookedBy: null,
      cancelledBy: "Asha Menon",
    });
  });

  it("finds none it may not see, and says why it could not read", async () => {
    await expect(getAppointment(tenantWith({}).tenant, "a-9")).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("42501") }) });
    await expect(getAppointment(tenant, "a-1")).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

/** An appointment as it stands before a change, and as a change hands it back. */
const standing = {
  id: "a-1",
  doctor_id: "d-1",
  appointment_type_id: "t-1",
  scheduled_at: "2026-10-13T04:30:00+00:00",
  duration_minutes: 15,
  notes: "First visit",
  status: "CONFIRMED",
};

describe("changeAppointment (D161)", () => {
  it("changes its notes alone through update_appointment, audited by name, and answers where it stands", async () => {
    const { tenant, rpcs } = tenantWith({
      answer: () => ({ data: standing }),
      rpc: () => ({ data: { ...standing, notes: "Bring reports" } }),
    });
    expect(await changeAppointment(tenant, "a-1", { notes: "Bring reports" }, "req_1")).toEqual({
      id: "a-1",
      doctorId: "d-1",
      status: "CONFIRMED",
      scheduledAt: "2026-10-13T04:30:00+00:00",
      minutes: 15,
    });
    expect(rpcs).toEqual([
      { name: "update_appointment", args: { p_appointment_id: "a-1", p_changes: { notes: "Bring reports" } } },
    ]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "UPDATE",
      entityType: "appointments",
      entityId: "a-1",
      changes: { fields: ["notes"] },
      requestId: "req_1",
    });
  });

  it("moves it with every field, audited from where to where — its status set back too (D142)", async () => {
    const after = {
      ...standing,
      doctor_id: "d-2",
      scheduled_at: "2026-10-14T05:00:00+00:00",
      status: "SCHEDULED",
    };
    const { tenant, rpcs } = tenantWith({ answer: () => ({ data: standing }), rpc: () => ({ data: after }) });
    const move = {
      doctorId: "d-2",
      typeId: "t-1",
      notes: "First visit",
      scheduledAt: "2026-10-14T05:00:00.000Z",
      minutes: 15,
    };
    expect((await changeAppointment(tenant, "a-1", move)).status).toBe("SCHEDULED");
    expect(rpcs[0].args).toEqual({
      p_appointment_id: "a-1",
      p_changes: {
        doctor_id: "d-2",
        appointment_type_id: "t-1",
        scheduled_at: "2026-10-14T05:00:00.000Z",
        duration_minutes: 15,
        notes: "First visit",
      },
    });
    expect(logActionSafe.mock.calls[0][1].changes).toEqual({
      doctor_id: { from: "d-1", to: "d-2" },
      scheduled_at: { from: "2026-10-13T04:30:00+00:00", to: "2026-10-14T05:00:00+00:00" },
      status: { from: "CONFIRMED", to: "SCHEDULED" },
    });
  });

  it("audits nothing when nothing changed", async () => {
    const { tenant } = tenantWith({ answer: () => ({ data: standing }), rpc: () => ({ data: standing }) });
    await changeAppointment(tenant, "a-1", { notes: "First visit" });
    expect(logActionSafe).not.toHaveBeenCalled();
  });

  it("finds none it may not see, and says why a change was refused, in its own words", async () => {
    await expect(changeAppointment(tenantWith({}).tenant, "a-9", { notes: null })).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
    const refused = tenantWith({ answer: () => ({ error: postgrestError("42501") }) });
    await expect(changeAppointment(refused.tenant, "a-1", { notes: null })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    const { tenant } = tenantWith({
      answer: () => ({ data: standing }),
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "APPOINTMENT_NOT_MOVABLE" } }),
    });
    await expect(changeAppointment(tenant, "a-1", { notes: null })).rejects.toMatchObject({
      code: "APPOINTMENT_NOT_MOVABLE",
    });
    expect(logActionSafe).not.toHaveBeenCalled();
  });
});

describe("changeAppointmentStatus (plan §11.2, D162)", () => {
  const scheduled = { ...standing, status: "SCHEDULED" };
  const edits = { permissions: ["appointments.edit" as const] };
  const cancels = { permissions: ["appointments.cancel" as const] };

  it("confirms through change_appointment_status, audited as a status change from what to what", async () => {
    const { tenant, rpcs } = tenantWith(
      { answer: () => ({ data: scheduled }), rpc: () => ({ data: { ...scheduled, status: "CONFIRMED" } }) },
      edits,
    );
    expect((await changeAppointmentStatus(tenant, "a-1", { status: "CONFIRMED", reason: null }, "req_2")).status).toBe(
      "CONFIRMED",
    );
    expect(rpcs).toEqual([
      {
        name: "change_appointment_status",
        args: { p_appointment_id: "a-1", p_status: "CONFIRMED", p_reason: null },
      },
    ]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "STATUS_CHANGE",
      entityType: "appointments",
      entityId: "a-1",
      changes: { status: { from: "SCHEDULED", to: "CONFIRMED" } },
      requestId: "req_2",
    });
  });

  it("cancels with its reason, which the audit names alone", async () => {
    const { tenant, rpcs } = tenantWith(
      { answer: () => ({ data: scheduled }), rpc: () => ({ data: { ...scheduled, status: "CANCELLED" } }) },
      cancels,
    );
    await changeAppointmentStatus(tenant, "a-1", { status: "CANCELLED", reason: "Patient asked" });
    expect(rpcs[0].args).toEqual({ p_appointment_id: "a-1", p_status: "CANCELLED", p_reason: "Patient asked" });
    expect(logActionSafe.mock.calls[0][1].changes).toEqual({
      status: { from: "SCHEDULED", to: "CANCELLED" },
      fields: ["cancel_reason"],
    });
  });

  it("sends no reason but a cancellation's, and audits nothing when the status stood", async () => {
    const { tenant, rpcs } = tenantWith(
      { answer: () => ({ data: scheduled }), rpc: () => ({ data: scheduled }) },
      edits,
    );
    await changeAppointmentStatus(tenant, "a-1", { status: "SCHEDULED", reason: "stray" });
    expect(rpcs[0].args).toMatchObject({ p_reason: null });
    expect(logActionSafe).not.toHaveBeenCalled();
  });

  it("asks appointments.cancel to cancel and appointments.edit for the rest, before asking the database", async () => {
    const asked = tenantWith({}, edits);
    await expect(
      changeAppointmentStatus(asked.tenant, "a-1", { status: "CANCELLED", reason: "Patient asked" }),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    const other = tenantWith({}, cancels);
    await expect(
      changeAppointmentStatus(other.tenant, "a-1", { status: "NO_SHOW", reason: null }),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    expect([...asked.queries, ...other.queries, ...asked.rpcs, ...other.rpcs]).toEqual([]);
  });

  it("says why a status was refused", async () => {
    const { tenant } = tenantWith(
      {
        answer: () => ({ data: scheduled }),
        rpc: () => ({ error: { ...postgrestError("P0001"), hint: "APPOINTMENT_STATUS_NOT_ALLOWED" } }),
      },
      edits,
    );
    await expect(changeAppointmentStatus(tenant, "a-1", { status: "CONFIRMED", reason: null })).rejects.toMatchObject({
      code: "APPOINTMENT_STATUS_NOT_ALLOWED",
    });
  });
});

describe("nextAppointment (D166)", () => {
  it("reads the soonest still to come, today or later, in one query", async () => {
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: calendarRow }) });
    expect(await nextAppointment(tenant, "p-1")).toEqual(asRead);
    expect(argsOf(queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["patient_id", "p-1"],
    ]);
    expect(argsOf(queries[0], "in")).toEqual([["status", ["SCHEDULED", "CONFIRMED", "ARRIVED", "IN_PROGRESS"]]]);
    expect(argsOf(queries[0], "gte")[0][0]).toBe("local_date");
    expect(argsOf(queries[0], "order")).toEqual([["scheduled_at"]]);
    expect(argsOf(queries[0], "limit")).toEqual([[1]]);
  });

  it("is none when nothing is to come, and says why it could not read", async () => {
    expect(await nextAppointment(tenantWith({}).tenant, "p-1")).toBeNull();
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("42501") }) });
    await expect(nextAppointment(tenant, "p-1")).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("listPatientAppointments (D167)", () => {
  it("reads a page of a patient's appointments, newest first, each with why it was cancelled", async () => {
    const { tenant, queries, argsOf } = tenantWith({
      answer: () => ({ data: [{ ...calendarRow, status: "CANCELLED", cancel_reason: "Patient asked" }] }),
    });
    expect(await listPatientAppointments(tenant, "p-1")).toEqual({
      items: [{ ...asRead, status: "CANCELLED", cancelReason: "Patient asked" }],
      nextCursor: null,
    });
    expect(argsOf(queries[0], "order")).toEqual([
      ["scheduled_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(argsOf(queries[0], "range")).toEqual([[0, 20]]);
  });

  it("reads on from where the page before ended, and says why it could not read", async () => {
    const page = tenantWith({ answer: () => ({ data: [] }) });
    await listPatientAppointments(page.tenant, "p-1", 20);
    expect(page.argsOf(page.queries[0], "range")).toEqual([[20, 40]]);
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("42501") }) });
    await expect(listPatientAppointments(tenant, "p-1")).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("addWalkIn (plan §11.3, D171, D173)", () => {
  const walkIn = { patient: { mode: "FOUND" as const, id: "p-1" }, doctorId: "d-1", typeId: "t-1" };
  const walked = { data: { appointment_id: "a-7", token_number: 7, created: true } };

  it("adds a walk-in through add_walk_in with its key, audits it with its token, and answers the token", async () => {
    const { tenant, rpcs } = tenantWith({ rpc: () => walked });
    expect(await addWalkIn(tenant, walkIn, "key-7", "req_7")).toEqual({
      id: "a-7",
      patientId: "p-1",
      doctorId: "d-1",
      token: 7,
    });
    expect(rpcs).toEqual([
      {
        name: "add_walk_in",
        args: {
          p_walk_in: { patient_id: "p-1", doctor_id: "d-1", appointment_type_id: "t-1" },
          p_idempotency_key: "key-7",
        },
      },
    ]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "CREATE",
      entityType: "appointments",
      entityId: "a-7",
      changes: {
        patient_id: { from: null, to: "p-1" },
        doctor_id: { from: null, to: "d-1" },
        appointment_type_id: { from: null, to: "t-1" },
        token_number: { from: null, to: 7 },
      },
      requestId: "req_7",
    });
  });

  it("audits nothing for the walk-in a repeat of the key finds", async () => {
    const { tenant } = tenantWith({ rpc: () => ({ data: { ...walked.data, created: false } }) });
    expect((await addWalkIn(tenant, walkIn, "key-7")).token).toBe(7);
    expect(logActionSafe).not.toHaveBeenCalled();
  });

  it("adds a new patient first, and names them when the walk-in is refused on a closed day", async () => {
    const { tenant } = tenantWith(
      {
        rpc: () => ({
          error: {
            ...postgrestError("P0001"),
            hint: "APPOINTMENT_ON_CLOSED_DAY",
            details: '{"reason": "Diwali", "wholeClinic": true}',
          },
        }),
      },
      { permissions: ["patients.create"] },
    );
    await expect(addWalkIn(tenant, { ...walkIn, patient: meera, patientKey: "pk-1" }, "key-8")).rejects.toMatchObject({
      code: "APPOINTMENT_ON_CLOSED_DAY",
      details: { reason: "Diwali", wholeClinic: true, patient: added },
    });
    expect(addPatient).toHaveBeenCalledWith(tenant, meera, "pk-1", undefined);
  });
});

describe("markArrived (plan §11.3, D143, D173)", () => {
  it("arrives a booking through mark_arrived, audits its status and token, and answers the token", async () => {
    const { tenant, rpcs } = tenantWith({
      answer: () => ({ data: { ...standing, status: "SCHEDULED" } }),
      rpc: () => ({ data: { ...standing, status: "ARRIVED", patient_id: "p-1", token_number: 4 } }),
    });
    expect(await markArrived(tenant, "a-1", "req_9")).toEqual({
      id: "a-1",
      patientId: "p-1",
      doctorId: "d-1",
      token: 4,
    });
    expect(rpcs).toEqual([{ name: "mark_arrived", args: { p_appointment_id: "a-1" } }]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "STATUS_CHANGE",
      entityType: "appointments",
      entityId: "a-1",
      changes: { status: { from: "SCHEDULED", to: "ARRIVED" }, token_number: { from: null, to: 4 } },
      requestId: "req_9",
    });
  });

  it("audits nothing when it had arrived already, and says why it was refused", async () => {
    const arrived = { ...standing, status: "ARRIVED", patient_id: "p-1", token_number: 4 };
    const again = tenantWith({ answer: () => ({ data: arrived }), rpc: () => ({ data: arrived }) });
    await markArrived(again.tenant, "a-1");
    expect(logActionSafe).not.toHaveBeenCalled();
    const { tenant } = tenantWith({
      answer: () => ({ data: standing }),
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "APPOINTMENT_NOT_TODAY" } }),
    });
    await expect(markArrived(tenant, "a-1")).rejects.toMatchObject({ code: "APPOINTMENT_NOT_TODAY" });
  });
});

describe("listQueue (plan §11.4)", () => {
  it("reads today's live appointments and anyone still in, with when they arrived, went in and were done, in one query", async () => {
    const row = {
      ...calendarRow,
      status: "ARRIVED",
      token_number: 3,
      arrived_at: "2026-10-13T04:40:00+00:00",
      started_at: null,
      completed_at: null,
      stepped_out_at: "2026-10-13T04:50:00+00:00",
      urgent_at: "2026-10-13T04:45:00+00:00",
      visit: [],
    };
    const { tenant, queries, argsOf } = tenantWith({ answer: () => ({ data: [row] }) });
    expect(await listQueue(tenant, {})).toEqual([
      {
        ...asRead,
        status: "ARRIVED",
        token: 3,
        arrivedAt: "2026-10-13T04:40:00+00:00",
        startedAt: null,
        completedAt: null,
        steppedOutAt: "2026-10-13T04:50:00+00:00",
        urgentAt: "2026-10-13T04:45:00+00:00",
        visitId: null,
      },
    ]);
    expect(queries).toHaveLength(1);
    expect(argsOf(queries[0], "eq")).toEqual([["clinic_id", "clinic-1"]]);
    expect(argsOf(queries[0], "or")[0][0]).toMatch(/^local_date\.eq\.\d{4}-\d{2}-\d{2},status\.eq\.IN_PROGRESS$/);
    expect(argsOf(queries[0], "in")).toEqual([
      ["status", ["SCHEDULED", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED"]],
    ]);
    expect(argsOf(queries[0], "order")).toEqual([["scheduled_at"]]);
  });

  it("keeps to one doctor when asked, and says why it could not read", async () => {
    const one = tenantWith({ answer: () => ({ data: [] }) });
    await listQueue(one.tenant, { doctorId: "d-2" });
    expect(one.argsOf(one.queries[0], "eq")).toEqual([
      ["clinic_id", "clinic-1"],
      ["doctor_id", "d-2"],
    ]);
    const { tenant } = tenantWith({ answer: () => ({ error: postgrestError("42501") }) });
    await expect(listQueue(tenant, {})).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });
});

describe("markReminded (plan §22.1, D180)", () => {
  it("notes the reminder through mark_reminded, audited from when it was last sent", async () => {
    const { tenant, rpcs } = tenantWith({
      rpc: () => ({ data: { reminded_at: "2026-10-12T05:00:00+00:00", previously: "2026-10-11T05:00:00+00:00" } }),
    });
    expect(await markReminded(tenant, "a-1", "req_r")).toEqual({ remindedAt: "2026-10-12T05:00:00+00:00" });
    expect(rpcs).toEqual([{ name: "mark_reminded", args: { p_appointment_id: "a-1" } }]);
    expect(logActionSafe).toHaveBeenCalledWith(tenant, {
      action: "UPDATE",
      entityType: "appointments",
      entityId: "a-1",
      changes: { reminded_at: { from: "2026-10-11T05:00:00+00:00", to: "2026-10-12T05:00:00+00:00" } },
      requestId: "req_r",
    });
  });

  it("says why it was refused", async () => {
    const { tenant } = tenantWith({
      rpc: () => ({ error: { ...postgrestError("P0001"), hint: "APPOINTMENT_NOT_REMINDABLE" } }),
    });
    await expect(markReminded(tenant, "a-1")).rejects.toMatchObject({ code: "APPOINTMENT_NOT_REMINDABLE" });
    expect(logActionSafe).not.toHaveBeenCalled();
  });
});
