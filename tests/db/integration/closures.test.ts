import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { addClosure, listClosures, removeClosure } from "@/features/clinic/closures";
import { listDoctors } from "@/features/team/api";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import type { ClosurePayload } from "@/lib/validation";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  setMemberStatus,
  setValidUntil,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * Holidays and leave against the local Supabase (plan §9; R3.3, D84 – D86):
 * read by every member, added with settings.manage from today on and for at
 * most a year; never two for the same people on one day, though a doctor's
 * leave may sit inside a clinic holiday; removed while not yet over, a past
 * one kept; each audited. And the doctors a closure can name.
 */
let clinic: TestClinic;
let other: TestClinic;
let manager: SignedIn & { memberId: string };
let receptionist: SignedIn & { memberId: string };
let doctor: SignedIn & { memberId: string };
let doctorId: string;
let ownerDoctorId: string;

const day = (days: number) => addDaysKey(todayKey(), days);
const closure = (overrides: Partial<ClosurePayload> = {}): ClosurePayload => ({
  doctorId: null,
  startsOn: day(10),
  endsOn: day(12),
  reason: "Diwali",
  ...overrides,
});

const doctorIdOf = async (memberId: string) => {
  const { data } = await admin().from("doctors").select("id").eq("member_id", memberId).single();
  return data!.id as string;
};

beforeAll(async () => {
  [clinic, other] = await Promise.all([
    registerClinic({ fullName: "Asha Menon" }),
    registerClinic({ fullName: "Ravi Kumar" }),
  ]);
  [manager, receptionist, doctor] = await Promise.all([
    addMember(clinic.clinicId, { permissions: ["settings.manage"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view"] }),
  ]);
  doctorId = await doctorIdOf(doctor.memberId);
  ownerDoctorId = clinic.owner.session.membership!.doctorId!;
});

afterAll(removeAll);

describe("the doctors a closure can name", () => {
  it("lists the clinic's active doctors by name, for any member", async () => {
    expect(await listDoctors(receptionist.tenant!)).toEqual([
      { id: ownerDoctorId, name: "Asha Menon" },
      { id: doctorId, name: "Test doctor" },
    ]);
    expect((await listDoctors(other.owner.tenant)).map(({ name }) => name)).toEqual(["Ravi Kumar"]);
  });

  it("leaves out a doctor whose membership is no longer active", async () => {
    const leaving = await addMember(clinic.clinicId, { role: "DOCTOR" });
    expect((await listDoctors(clinic.owner.tenant)).map(({ name }) => name)).toHaveLength(3);
    await setMemberStatus(leaving.memberId, "INACTIVE");
    expect((await listDoctors(clinic.owner.tenant)).map(({ name }) => name)).toEqual(["Asha Menon", "Test doctor"]);
  });
});

describe("adding one", () => {
  it("adds a clinic holiday and a doctor's leave for settings.manage, audited with its values", async () => {
    const holiday = await addClosure(manager.tenant!, closure(), "req_closure_1");
    expect(holiday).toEqual({
      id: expect.any(String),
      doctorId: null,
      doctorName: null,
      startsOn: day(10),
      endsOn: day(12),
      reason: "Diwali",
    });
    const leave = await addClosure(manager.tenant!, closure({ doctorId, reason: "Conference" }));
    expect(leave).toMatchObject({ doctorId, doctorName: "Test doctor", reason: "Conference" });

    const { data: audit } = await admin()
      .from("audit_logs")
      .select("action, entity_type, entity_id, actor_id, changes")
      .eq("request_id", "req_closure_1")
      .single();
    expect(audit).toEqual({
      action: "CREATE",
      entity_type: "clinic_closures",
      entity_id: holiday.id,
      actor_id: manager.userId,
      changes: {
        doctor_id: { from: null, to: null },
        starts_on: { from: null, to: day(10) },
        ends_on: { from: null, to: day(12) },
        reason: { from: null, to: "Diwali" },
      },
    });
    const { data: row } = await admin().from("clinic_closures").select("created_by").eq("id", holiday.id).single();
    expect(row).toEqual({ created_by: manager.userId });
  });

  it("is read by every member, by its first day — and never by another clinic", async () => {
    const seen = await listClosures(receptionist.tenant!);
    expect(seen.map(({ reason }) => reason)).toEqual(["Diwali", "Conference"]);
    expect(await listClosures(other.owner.tenant)).toEqual([]);
  });

  it("refuses a member without settings.manage", async () => {
    await expect(
      addClosure(receptionist.tenant!, closure({ startsOn: day(40), endsOn: day(40) })),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });

  it("refuses a start before today, and more than a year (D85)", async () => {
    await expect(addClosure(manager.tenant!, closure({ startsOn: day(-1), endsOn: day(1) }))).rejects.toMatchObject({
      code: "CLOSURE_STARTS_BEFORE_TODAY",
    });
    await expect(addClosure(manager.tenant!, closure({ startsOn: day(100), endsOn: day(466) }))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    // Today itself, and exactly 366 days, are fine.
    const year = await addClosure(
      manager.tenant!,
      closure({ doctorId: ownerDoctorId, startsOn: day(0), endsOn: day(365) }),
    );
    expect(year).toMatchObject({ doctorName: "Asha Menon" });
    await removeClosure(manager.tenant!, year.id);
  });

  it("refuses days the same people already have off, but lets a doctor's leave sit inside a holiday (D86)", async () => {
    await expect(addClosure(manager.tenant!, closure({ startsOn: day(12), endsOn: day(14) }))).rejects.toMatchObject({
      code: "CLOSURE_DAYS_TAKEN",
      kind: "CONFLICT",
    });
    await expect(
      addClosure(manager.tenant!, closure({ doctorId, startsOn: day(11), endsOn: day(11) })),
    ).rejects.toMatchObject({ code: "CLOSURE_DAYS_TAKEN" });

    // Another doctor on the same days, and the clinic the day after, are free.
    const owners = await addClosure(manager.tenant!, closure({ doctorId: ownerDoctorId, reason: "Wedding" }));
    const after = await addClosure(
      manager.tenant!,
      closure({ startsOn: day(13), endsOn: day(13), reason: "Bhai Dooj" }),
    );
    await Promise.all([removeClosure(manager.tenant!, owners.id), removeClosure(manager.tenant!, after.id)]);
  });

  it("refuses another clinic's doctor", async () => {
    const theirs = other.owner.session.membership!.doctorId!;
    await expect(
      addClosure(manager.tenant!, closure({ doctorId: theirs, startsOn: day(50), endsOn: day(50) })),
    ).rejects.toMatchObject({ kind: "CONFLICT" });
  });
});

describe("removing one (D84)", () => {
  it("removes one not yet over for settings.manage, audited with what it was", async () => {
    const today = await addClosure(manager.tenant!, closure({ startsOn: day(0), endsOn: day(0), reason: "Onam" }));
    await expect(removeClosure(receptionist.tenant!, today.id)).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    await expect(removeClosure(other.owner.tenant, today.id)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });

    expect(await removeClosure(manager.tenant!, today.id, "req_closure_2")).toMatchObject({
      id: today.id,
      reason: "Onam",
    });
    expect((await listClosures(manager.tenant!)).map(({ id }) => id)).not.toContain(today.id);
    const { data: audit } = await admin()
      .from("audit_logs")
      .select("action, entity_id, changes")
      .eq("request_id", "req_closure_2")
      .single();
    expect(audit).toEqual({
      action: "DELETE",
      entity_id: today.id,
      changes: {
        doctor_id: { from: null, to: null },
        starts_on: { from: day(0), to: null },
        ends_on: { from: day(0), to: null },
        reason: { from: "Onam", to: null },
      },
    });
  });

  it("keeps one that is over, as a record", async () => {
    const past = await addClosure(manager.tenant!, closure({ startsOn: day(0), endsOn: day(0), reason: "Past" }));
    await admin()
      .from("clinic_closures")
      .update({ starts_on: day(-3), ends_on: day(-1) })
      .eq("id", past.id);
    await expect(removeClosure(manager.tenant!, past.id)).rejects.toMatchObject({
      code: "CLOSURE_OVER",
      kind: "BUSINESS_RULE",
    });
  });

  it("deletes nothing, and changes nothing, straight through the database's API", async () => {
    const [first] = await listClosures(clinic.owner.tenant);
    const { data: deleted } = await clinic.owner.tenant.supabase
      .from("clinic_closures")
      .delete()
      .eq("id", first.id)
      .select("id");
    expect(deleted ?? []).toEqual([]);
    const { error: updated } = await clinic.owner.tenant.supabase
      .from("clinic_closures")
      .update({ reason: "Changed" })
      .eq("id", first.id);
    expect(updated?.code).toBe("42501");
  });
});

describe("a read-only clinic", () => {
  it("adds none and removes none", async () => {
    const [kept] = await listClosures(clinic.owner.tenant);
    await setValidUntil(clinic.clinicId, day(-PLATFORM_SETTING_DEFAULTS.graceDays - 30));
    await expect(
      addClosure(clinic.owner.tenant, closure({ startsOn: day(80), endsOn: day(80) })),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    await expect(removeClosure(clinic.owner.tenant, kept.id)).rejects.toMatchObject({ code: "CLINIC_PLAN_EXPIRED" });
    expect(await listClosures(clinic.owner.tenant)).not.toEqual([]);
  });
});
