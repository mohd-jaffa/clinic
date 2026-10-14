import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GET as medicinesRoute } from "@/app/api/prescriptions/medicines/route";
import { PUT as prescriptionRoute } from "@/app/api/visits/[id]/prescription/route";
import { GET as prescriptionPdfRoute } from "@/app/api/visits/[id]/prescription.pdf/route";
import type { RouteAccess } from "@/constants/permissions";
import { withClinicRoute } from "@/features/auth/guard";
import { addDaysKey, dayHour, todayKey } from "@/lib/dates/calendar";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  setMemberStatus,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * The permission matrix, so far (plan §34.3, R1.11, R3.8, R4.7, R5.1, R6.1, R6.3, R6.4): every
 * permission the schema enforces yet, allowed and refused — by the route
 * guard, and by RLS or a function with the member's own token. Each phase
 * adds the rows its tables bring; the patients routes themselves are asked in
 * patient-access.test.ts.
 */
let clinic: TestClinic;
let manager: SignedIn & { memberId: string };
let receptionist: SignedIn & { memberId: string };

beforeAll(async () => {
  clinic = await registerClinic();
  [manager, receptionist] = await Promise.all([
    addMember(clinic.clinicId, { permissions: ["settings.manage"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view"] }),
  ]);
});

afterAll(removeAll);

/** A request to a route that serves `access`, as a member's browser sends it. */
async function ask(member: SignedIn, access: RouteAccess, method = "POST") {
  const request = new Request("http://localhost/api/thing", {
    method,
    headers: { authorization: `Bearer ${member.session.accessToken}` },
  });
  const response = await withClinicRoute(request, { access }, async ({ clinicId, role }) => ({ clinicId, role }));
  return { status: response.status, body: await response.json() };
}

describe("by the route guard", () => {
  it("lets a member through to what their permissions allow", async () => {
    await expect(ask(manager, "settings.manage")).resolves.toMatchObject({ status: 200 });
    await expect(ask(receptionist, "appointments.view", "GET")).resolves.toMatchObject({ status: 200 });
  });

  it("refuses what they do not hold, with AUTH_PERMISSION_DENIED", async () => {
    await expect(ask(receptionist, "settings.manage")).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_PERMISSION_DENIED" } },
    });
  });

  it("lets the owner through to everything, owner-only routes included", async () => {
    await expect(ask(clinic.owner, "settings.manage")).resolves.toMatchObject({ status: 200 });
    await expect(ask(clinic.owner, "OWNER")).resolves.toMatchObject({ status: 200 });
    await expect(ask(manager, "OWNER")).resolves.toMatchObject({ status: 403 });
    await expect(ask(receptionist, "MEMBER")).resolves.toMatchObject({ status: 200 });
  });

  it("builds the tenant from the session, never from the request", async () => {
    await expect(ask(receptionist, "MEMBER")).resolves.toMatchObject({
      body: { data: { clinicId: clinic.clinicId, role: "STAFF" } },
    });
  });
});

describe("settings.manage, by RLS", () => {
  const entry = () => ({ name: `Scaling ${Math.random()}`, category: "PROCEDURE", price_paise: 150_000 });

  it("lets a member who holds it add and change the price list, appointment types and expense categories", async () => {
    const { supabase } = manager.tenant!;
    const { data: service, error } = await supabase
      .from("services")
      .insert({ clinic_id: clinic.clinicId, ...entry() })
      .select("id, created_by")
      .single();
    expect(error).toBeNull();
    // Who wrote it is the session's, whatever the client sent (plan §27.4).
    expect(service!.created_by).toBe(manager.userId);

    const { data: changed } = await supabase
      .from("services")
      .update({ price_paise: 1 })
      .eq("id", service!.id)
      .select("id");
    expect(changed).toHaveLength(1);

    const { error: type } = await supabase
      .from("appointment_types")
      .insert({ clinic_id: clinic.clinicId, name: `Scaling ${Math.random()}`, default_minutes: 45 });
    expect(type).toBeNull();
    const { error: category } = await supabase
      .from("expense_categories")
      .insert({ clinic_id: clinic.clinicId, name: `Lab ${Math.random()}` });
    expect(category).toBeNull();
  });

  it("refuses a member who does not hold it", async () => {
    const { supabase } = receptionist.tenant!;
    const { error } = await supabase.from("services").insert({ clinic_id: clinic.clinicId, ...entry() });
    expect(error?.code).toBe("42501");
    const { data: changed } = await supabase
      .from("services")
      .update({ price_paise: 1 })
      .eq("clinic_id", clinic.clinicId)
      .select("id");
    expect(changed).toEqual([]);
    const { error: type } = await supabase
      .from("appointment_types")
      .insert({ clinic_id: clinic.clinicId, name: "Nope", default_minutes: 10 });
    expect(type?.code).toBe("42501");
  });

  it("deletes nothing, for anyone: an entry is archived", async () => {
    const { data } = await clinic.owner.tenant.supabase
      .from("services")
      .delete()
      .eq("clinic_id", clinic.clinicId)
      .select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("settings.manage on holidays and leave, by RLS and its function", () => {
  it("lets a member who holds it add and remove one, and refuses one who does not", async () => {
    const { data: added, error } = await manager
      .tenant!.supabase.from("clinic_closures")
      .insert({ clinic_id: clinic.clinicId, starts_on: todayKey(), ends_on: todayKey(), reason: "Matrix" })
      .select("id")
      .single();
    expect(error).toBeNull();

    const { error: refused } = await receptionist
      .tenant!.supabase.from("clinic_closures")
      .insert({ clinic_id: clinic.clinicId, starts_on: todayKey(), ends_on: todayKey(), reason: "Nope" });
    expect(refused?.code).toBe("42501");
    const { error: notTheirs } = await receptionist.tenant!.supabase.rpc("remove_closure", { p_closure_id: added!.id });
    expect(notTheirs?.hint).toBe("AUTH_PERMISSION_DENIED");

    const { error: removed } = await manager.tenant!.supabase.rpc("remove_closure", { p_closure_id: added!.id });
    expect(removed).toBeNull();
  });
});

describe("team.manage, by the route guard and the database", () => {
  it("lets a member who holds it through, and refuses one who does not", async () => {
    const lead = await addMember(clinic.clinicId, { permissions: ["team.manage", "patients.view"] });
    await expect(ask(lead, "team.manage", "GET")).resolves.toMatchObject({ status: 200 });
    await expect(ask(receptionist, "team.manage", "GET")).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_PERMISSION_DENIED" } },
    });

    const junior = await addMember(clinic.clinicId, { permissions: ["patients.view"] });
    const { error: allowed } = await lead.tenant!.supabase.rpc("update_member", {
      p_member_id: junior.memberId,
      p_changes: { job_title: "Front desk" },
    });
    expect(allowed).toBeNull();
    const { error: refused } = await receptionist.tenant!.supabase.rpc("set_member_active", {
      p_member_id: junior.memberId,
      p_active: false,
    });
    expect(refused?.hint).toBe("AUTH_PERMISSION_DENIED");
  });
});

describe("patients.view, patients.create and patients.edit, by the guard, RLS and create_patient", () => {
  const patient = { full_name: "Matrix Patient", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" };
  const add = (member: SignedIn) =>
    member
      .tenant!.supabase.rpc("create_patient", { p_patient: patient, p_idempotency_key: randomUUID() })
      .single<{ patient_id: string }>();
  let editor: SignedIn & { memberId: string };
  let viewer: SignedIn & { memberId: string };
  let patientId: string;

  beforeAll(async () => {
    [editor, viewer] = await Promise.all([
      addMember(clinic.clinicId, { permissions: ["patients.view", "patients.create", "patients.edit"] }),
      addMember(clinic.clinicId, { permissions: ["patients.view"] }),
    ]);
    const { data, error } = await add(editor);
    expect(error).toBeNull();
    patientId = data!.patient_id;
  });

  it("lets each through the guard to what it allows, and no further", async () => {
    for (const access of ["patients.view", "patients.create", "patients.edit"] as const) {
      await expect(ask(editor, access)).resolves.toMatchObject({ status: 200 });
    }
    await expect(ask(viewer, "patients.view", "GET")).resolves.toMatchObject({ status: 200 });
    for (const access of ["patients.create", "patients.edit"] as const) {
      await expect(ask(viewer, access)).resolves.toMatchObject({ status: 403 });
    }
    await expect(ask(manager, "patients.view", "GET")).resolves.toMatchObject({ status: 403 });
  });

  it("reads patients with patients.view, and none without it", async () => {
    const { data: seen } = await viewer.tenant!.supabase.from("patients").select("id").eq("id", patientId);
    expect(seen).toHaveLength(1);
    const { data: unseen } = await manager.tenant!.supabase.from("patients").select("id");
    expect(unseen).toEqual([]);
  });

  it("adds a patient with patients.create, and refuses one without it", async () => {
    const { error } = await add(viewer);
    expect(error?.hint).toBe("AUTH_PERMISSION_DENIED");
  });

  it("changes a patient with patients.edit, and changes none without it", async () => {
    const change = (member: SignedIn) =>
      member.tenant!.supabase.from("patients").update({ full_name: "Changed" }).eq("id", patientId).select("id");
    expect((await change(viewer)).data).toEqual([]);
    expect((await change(editor)).data).toHaveLength(1);
  });
});

describe("visits.view and visits.edit on a patient's alerts, by RLS", () => {
  let reader: SignedIn & { memberId: string };
  let writer: SignedIn & { memberId: string };
  let patientId: string;

  beforeAll(async () => {
    [reader, writer] = await Promise.all([
      addMember(clinic.clinicId, { permissions: ["patients.view", "visits.view"] }),
      addMember(clinic.clinicId, { permissions: ["patients.view", "visits.view", "visits.edit"] }),
    ]);
    const { data, error } = await clinic.owner.tenant.supabase
      .rpc("create_patient", {
        p_patient: { full_name: "Alert Matrix", phone: "+919876543211", date_of_birth: "1990-04-12", gender: "FEMALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    expect(error).toBeNull();
    patientId = data!.patient_id;
  });

  const addAlert = (member: SignedIn, label: string) =>
    member
      .tenant!.supabase.from("patient_alerts")
      .insert({ clinic_id: clinic.clinicId, patient_id: patientId, kind: "ALLERGY", label })
      .select("id")
      .maybeSingle();

  it("adds and changes an alert with visits.edit, and neither without it", async () => {
    const { data: added, error } = await addAlert(writer, "Penicillin");
    expect(error).toBeNull();
    expect((await addAlert(reader, "Latex")).error?.code).toBe("42501");

    const turnOff = (member: SignedIn) =>
      member.tenant!.supabase.from("patient_alerts").update({ active: false }).eq("id", added!.id).select("id");
    expect((await turnOff(reader)).data).toEqual([]);
    expect((await turnOff(writer)).data).toHaveLength(1);
  });

  it("reads alerts with visits.view, and none with patients.view alone", async () => {
    const { data: read } = await reader
      .tenant!.supabase.from("patient_alerts")
      .select("id")
      .eq("patient_id", patientId);
    expect(read).toHaveLength(1);
    const { data: hidden } = await receptionist.tenant!.supabase.from("patient_alerts").select("id");
    expect(hidden).toEqual([]);
  });
});

describe("appointments.view, .create, .edit and .cancel, by the guard, RLS and the 0017 functions", () => {
  let booker: SignedIn & { memberId: string };
  let changer: SignedIn & { memberId: string };
  let canceller: SignedIn & { memberId: string };
  const fields: Record<string, unknown> = {};

  beforeAll(async () => {
    [booker, changer, canceller] = await Promise.all([
      addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view", "appointments.create"] }),
      addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view", "appointments.edit"] }),
      addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view", "appointments.cancel"] }),
    ]);
    const { supabase } = clinic.owner.tenant;
    const { data: patient } = await supabase
      .rpc("create_patient", {
        p_patient: { full_name: "Booking Matrix", phone: "+919876543212", date_of_birth: "1990-04-12", gender: "MALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    const [{ data: type }, { data: doctor }] = await Promise.all([
      supabase.from("appointment_types").select("id").eq("name", "Consultation").single(),
      supabase.from("doctors").select("id").eq("member_id", clinic.owner.session.membership!.id).single(),
    ]);
    Object.assign(fields, { patient_id: patient!.patient_id, doctor_id: doctor!.id, appointment_type_id: type!.id });
  });

  let hour = 9;
  const book = (member: SignedIn) =>
    member
      .tenant!.supabase.rpc("create_appointment", {
        p_appointment: { ...fields, scheduled_at: dayHour(addDaysKey(todayKey(), 1), hour++), duration_minutes: 15 },
        p_idempotency_key: randomUUID(),
      })
      .single<{ appointment_id: string }>();
  const status = (member: SignedIn, id: string, to: string) =>
    member.tenant!.supabase.rpc("change_appointment_status", {
      p_appointment_id: id,
      p_status: to,
      p_reason: "Matrix",
    });

  it("lets each through the guard to what it allows, and no further", async () => {
    await expect(ask(booker, "appointments.create")).resolves.toMatchObject({ status: 200 });
    await expect(ask(booker, "appointments.edit")).resolves.toMatchObject({ status: 403 });
    await expect(ask(changer, "appointments.edit")).resolves.toMatchObject({ status: 200 });
    await expect(ask(changer, "appointments.cancel")).resolves.toMatchObject({ status: 403 });
    await expect(ask(canceller, "appointments.cancel")).resolves.toMatchObject({ status: 200 });
    await expect(ask(manager, "appointments.view", "GET")).resolves.toMatchObject({ status: 403 });
  });

  it("reads appointments with appointments.view, and none without it", async () => {
    const { data } = await book(booker);
    const { data: seen } = await receptionist
      .tenant!.supabase.from("appointments")
      .select("id")
      .eq("id", data!.appointment_id);
    expect(seen).toHaveLength(1);
    const { data: unseen } = await manager.tenant!.supabase.from("appointments").select("id");
    expect(unseen).toEqual([]);
  });

  it("books with appointments.create, changes with .edit, cancels with .cancel — each and no other", async () => {
    expect((await book(changer)).error?.hint).toBe("AUTH_PERMISSION_DENIED");
    const { data } = await book(booker);
    const id = data!.appointment_id;
    expect((await status(booker, id, "CONFIRMED")).error?.hint).toBe("AUTH_PERMISSION_DENIED");
    expect((await status(canceller, id, "CONFIRMED")).error?.hint).toBe("AUTH_PERMISSION_DENIED");
    expect((await status(changer, id, "CONFIRMED")).error).toBeNull();
    expect((await status(changer, id, "CANCELLED")).error?.hint).toBe("AUTH_PERMISSION_DENIED");
    expect((await status(canceller, id, "CANCELLED")).error).toBeNull();
  });
});

describe("visits.view and the queue's moves, by the guard, RLS and the 0018 and 0020 functions", () => {
  let nurse: SignedIn & { memberId: string };
  let appointmentId: string;
  let doctorId: string;

  beforeAll(async () => {
    nurse = await addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view", "visits.view"] });
    const { supabase } = clinic.owner.tenant;
    const { data: patient } = await supabase
      .rpc("create_patient", {
        p_patient: { full_name: "Visit Matrix", phone: "+919876543213", date_of_birth: "1990-04-12", gender: "MALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    const [{ data: type }, { data: doctor }] = await Promise.all([
      supabase.from("appointment_types").select("id").eq("name", "Consultation").single(),
      supabase.from("doctors").select("id").eq("member_id", clinic.owner.session.membership!.id).single(),
    ]);
    doctorId = doctor!.id as string;
    const { data: walkIn } = await supabase
      .rpc("add_walk_in", {
        p_walk_in: { patient_id: patient!.patient_id, doctor_id: doctorId, appointment_type_id: type!.id },
        p_idempotency_key: randomUUID(),
      })
      .single<{ appointment_id: string }>();
    appointmentId = walkIn!.appointment_id;
  });

  it("lets visits.view through the guard to a visit, and no one without it", async () => {
    await expect(ask(nurse, "visits.view", "GET")).resolves.toMatchObject({ status: 200 });
    await expect(ask(receptionist, "visits.view", "GET")).resolves.toMatchObject({ status: 403 });
  });

  it("moves the queue only with appointments.edit — not with visits.view", async () => {
    for (const [name, args] of [
      ["send_in", { p_appointment_id: appointmentId }],
      ["mark_done", { p_appointment_id: appointmentId }],
      ["back_to_waiting", { p_appointment_id: appointmentId }],
      ["mark_stepped_out", { p_appointment_id: appointmentId, p_out: true }],
      ["mark_urgent", { p_appointment_id: appointmentId, p_urgent: true }],
      ["next_patient", { p_doctor_id: doctorId }],
    ] as const) {
      const { error } = await nurse.tenant!.supabase.rpc(name, args);
      expect(error?.hint, name).toBe("AUTH_PERMISSION_DENIED");
    }
    const { error } = await clinic.owner.tenant.supabase.rpc("send_in", { p_appointment_id: appointmentId });
    expect(error).toBeNull();
  });

  it("reads visits and vitals with visits.view, and none with appointments.view alone", async () => {
    const { data: visit } = await admin()
      .from("visits")
      .select("id, patient_id")
      .eq("appointment_id", appointmentId)
      .single();
    await admin()
      .from("vitals")
      .insert({ clinic_id: clinic.clinicId, patient_id: visit!.patient_id, visit_id: visit!.id, spo2: 98 });
    for (const table of ["visits", "vitals"]) {
      const { data: seen } = await nurse.tenant!.supabase.from(table).select("id");
      expect(seen, table).toHaveLength(1);
      const { data: unseen } = await receptionist.tenant!.supabase.from(table).select("id");
      expect(unseen, table).toEqual([]);
    }
  });

  it("writes neither table directly, for anyone", async () => {
    const { error } = await clinic.owner.tenant.supabase
      .from("visits")
      .update({ notes: "Planted" })
      .eq("appointment_id", appointmentId);
    expect(error?.code).toBe("42501");
  });

  it("records a visit only with visits.create or visits.edit — not with visits.view (0020)", async () => {
    const { data: visit } = await admin()
      .from("visits")
      .select("id, patient_id")
      .eq("appointment_id", appointmentId)
      .single();
    for (const [name, args] of [
      ["save_vitals", { p_visit_id: visit!.id, p_appointment_id: null, p_vitals: { pulse: 70 }, p_seen: null }],
      ["save_vitals", { p_visit_id: null, p_appointment_id: appointmentId, p_vitals: { pulse: 70 }, p_seen: null }],
      ["update_visit", { p_visit_id: visit!.id, p_changes: { notes: "Planted" }, p_seen: { notes: null } }],
      ["start_visit", { p_patient_id: visit!.patient_id, p_doctor_id: doctorId }],
      ["finish_visit", { p_visit_id: visit!.id }],
    ] as const) {
      const { error } = await nurse.tenant!.supabase.rpc(name, args);
      expect(error?.hint, name).toBe("AUTH_PERMISSION_DENIED");
    }
    const { error } = await clinic.owner.tenant.supabase.rpc("update_visit", {
      p_visit_id: visit!.id,
      p_changes: { complaint: "Cough" },
      p_seen: { complaint: null },
    });
    expect(error).toBeNull();
  });
});

describe("a prescription: the visit's doctor or prescriptions.write, by the routes, RLS and the 0021 functions", () => {
  type Member = SignedIn & { memberId: string };
  let doctor: Member;
  let typist: Member;
  let reader: Member;
  let otherDoctor: Member;
  let doctorId: string;
  let visitId: string;

  const line = {
    medicine: "Paracetamol",
    strength: "500 mg",
    dose: "",
    frequency: "",
    timing: "",
    durationDays: "",
    instructions: "",
  };

  /** The prescription route, asked by one member as their browser asks it. */
  async function save(member: SignedIn, seen: unknown = null) {
    const request = new Request(`http://localhost/api/visits/${visitId}/prescription`, {
      method: "PUT",
      headers: { authorization: `Bearer ${member.session.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ prescription: { items: [line], advice: "", printDiagnosis: false }, seen }),
    });
    const response = await prescriptionRoute(request, { params: Promise.resolve({ id: visitId }) });
    return { status: response.status, body: await response.json() };
  }

  /** The prescription's PDF (R6.4), opened by one member: its status, and its type or refusal. */
  async function print(member: SignedIn) {
    const request = new Request(`http://localhost/api/visits/${visitId}/prescription.pdf`, {
      headers: { authorization: `Bearer ${member.session.accessToken}` },
    });
    const response = await prescriptionPdfRoute(request, { params: Promise.resolve({ id: visitId }) });
    const type = response.headers.get("content-type");
    return type === "application/pdf"
      ? { status: response.status, type }
      : { status: response.status, body: await response.json() };
  }

  /** The medicine suggestions, asked by one member. */
  async function suggest(member: SignedIn) {
    const request = new Request(`http://localhost/api/prescriptions/medicines?q=para&doctorId=${doctorId}`, {
      headers: { authorization: `Bearer ${member.session.accessToken}` },
    });
    const response = await medicinesRoute(request);
    return { status: response.status, body: await response.json() };
  }

  beforeAll(async () => {
    [doctor, typist, reader, otherDoctor] = await Promise.all([
      addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "visits.view"] }),
      addMember(clinic.clinicId, { permissions: ["patients.view", "visits.view", "prescriptions.write"] }),
      addMember(clinic.clinicId, { permissions: ["patients.view", "visits.view"] }),
      addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view", "visits.view"] }),
    ]);
    const { data: row } = await admin().from("doctors").select("id").eq("member_id", doctor.memberId).single();
    doctorId = row!.id as string;
    await admin().from("doctors").update({ registration_number: "KMC 24680" }).eq("id", doctorId);
    const { supabase } = clinic.owner.tenant;
    const [{ data: patient }, { data: type }] = await Promise.all([
      supabase
        .rpc("create_patient", {
          p_patient: { full_name: "Rx Matrix", phone: "+919876543214", date_of_birth: "1990-04-12", gender: "MALE" },
          p_idempotency_key: randomUUID(),
        })
        .single<{ patient_id: string }>(),
      supabase.from("appointment_types").select("id").eq("name", "Consultation").single(),
    ]);
    const { data: walkIn } = await supabase
      .rpc("add_walk_in", {
        p_walk_in: { patient_id: patient!.patient_id, doctor_id: doctorId, appointment_type_id: type!.id },
        p_idempotency_key: randomUUID(),
      })
      .single<{ appointment_id: string }>();
    const { error } = await supabase.rpc("send_in", { p_appointment_id: walkIn!.appointment_id });
    if (error) throw error;
    const { data: visit } = await admin()
      .from("visits")
      .select("id")
      .eq("appointment_id", walkIn!.appointment_id)
      .single();
    visitId = visit!.id as string;
  });

  it("is written through its route by the visit's doctor, and typed over by prescriptions.write", async () => {
    const written = await save(doctor);
    expect(written).toMatchObject({
      status: 200,
      body: { data: { prescription: { items: [{ medicine: "Paracetamol" }] } } },
    });
    const typed = await save(typist, (written.body as { data: { prescription: unknown } }).data.prescription);
    expect(typed.status).toBe(200);
  });

  it("is refused to a member with neither, to another doctor, and at the guard to one without visits.view", async () => {
    await expect(save(reader)).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_PERMISSION_DENIED" } },
    });
    await expect(save(otherDoctor)).resolves.toMatchObject({
      status: 404,
      body: { error: { code: "RECORD_NOT_FOUND" } },
    });
    await expect(save(receptionist)).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_PERMISSION_DENIED" } },
    });
  });

  it("prints for whoever reads visits and the visit's doctor; refused without visits.view and outside the scope", async () => {
    for (const member of [doctor, typist, reader]) {
      await expect(print(member)).resolves.toEqual({ status: 200, type: "application/pdf" });
    }
    await expect(print(otherDoctor)).resolves.toMatchObject({
      status: 404,
      body: { error: { code: "RECORD_NOT_FOUND" } },
    });
    await expect(print(receptionist)).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_PERMISSION_DENIED" } },
    });
  });

  it("suggests medicines to a doctor and to prescriptions.write, and to no one else", async () => {
    for (const member of [doctor, typist, otherDoctor]) {
      await expect(suggest(member)).resolves.toMatchObject({
        status: 200,
        body: { data: [{ medicine: "Paracetamol" }] },
      });
    }
    for (const member of [reader, receptionist]) {
      await expect(suggest(member)).resolves.toMatchObject({
        status: 403,
        body: { error: { code: "AUTH_PERMISSION_DENIED" } },
      });
    }
  });

  it("reads a prescription and its medicines with visits.view within the doctor scope, and none otherwise", async () => {
    for (const table of ["prescriptions", "prescription_items"]) {
      const { data: seen } = await reader.tenant!.supabase.from(table).select("id");
      expect(seen, table).toHaveLength(1);
      const { data: theirs } = await doctor.tenant!.supabase.from(table).select("id");
      expect(theirs, table).toHaveLength(1);
      const { data: notTheirs } = await otherDoctor.tenant!.supabase.from(table).select("id");
      expect(notTheirs, table).toEqual([]);
      const { data: unseen } = await receptionist.tenant!.supabase.from(table).select("id");
      expect(unseen, table).toEqual([]);
    }
  });

  it("writes neither table directly, for anyone", async () => {
    const { error: updated } = await clinic.owner.tenant.supabase
      .from("prescriptions")
      .update({ advice: "Planted" })
      .eq("visit_id", visitId);
    expect(updated?.code).toBe("42501");
    const { error: deleted } = await clinic.owner.tenant.supabase
      .from("prescription_items")
      .delete()
      .eq("clinic_id", clinic.clinicId);
    expect(deleted?.code).toBe("42501");
  });
});

describe("the owner's own", () => {
  it("lets only the owner read the plan, its payments and the activity log", async () => {
    for (const table of ["clinic_subscriptions", "audit_logs"]) {
      const { data: owners } = await clinic.owner.tenant.supabase.from(table).select("*");
      expect(owners!.length, table).toBeGreaterThan(0);
      const { data: managers } = await manager.tenant!.supabase.from(table).select("*");
      expect(managers, table).toEqual([]);
    }
  });
});

describe("a deactivated member", () => {
  it("reaches nothing with a token still in hand (plan §8.2 rule 6)", async () => {
    const leaving = await addMember(clinic.clinicId, { permissions: ["settings.manage"] });
    await setMemberStatus(leaving.memberId, "INACTIVE");

    const { data } = await leaving.tenant!.supabase.from("services").select("id");
    expect(data).toEqual([]);
    const { error } = await leaving
      .tenant!.supabase.from("services")
      .insert({ clinic_id: clinic.clinicId, name: "Late", category: "OTHER", price_paise: 0 });
    expect(error?.code).toBe("42501");
    await expect(ask(leaving, "MEMBER", "GET")).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "AUTH_MEMBERSHIP_INACTIVE" } },
    });
  });
});
