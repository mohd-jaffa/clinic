import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { getMember, setMemberActive, updateMember } from "@/features/team/members";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
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
 * Changing the team against the local Supabase (plan §8.2, §8.6; R3.6, D93
 * – D95): the owner changes a member's access, job title or doctor's
 * details and deactivates and reactivates them, each audited; a manager
 * changes only those within their own access, never the owner, never
 * themselves, and gives only what they hold; the role stays what it was.
 */
let clinic: TestClinic;
let other: TestClinic;
let manager: SignedIn & { memberId: string };
let staff: SignedIn & { memberId: string };
let senior: SignedIn & { memberId: string };
let doctor: SignedIn & { memberId: string };

beforeAll(async () => {
  [clinic, other] = await Promise.all([registerClinic(), registerClinic()]);
  [manager, staff, senior, doctor] = await Promise.all([
    addMember(clinic.clinicId, {
      permissions: ["team.manage", "patients.view", "patients.create", "appointments.view"],
    }),
    addMember(clinic.clinicId, { permissions: ["patients.view"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "reports.view"] }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view"] }),
  ]);
});

afterAll(removeAll);

describe("the owner (plan §8.6)", () => {
  it("reads a member with their mobile and a doctor's details", async () => {
    expect(await getMember(clinic.owner.tenant, doctor.memberId)).toMatchObject({
      role: "DOCTOR",
      status: "ACTIVE",
      isDoctor: true,
      phone: null,
      doctor: { specialization: null, qualifications: null, registrationNumber: null, feePaise: null },
    });
    await expect(getMember(other.owner.tenant, doctor.memberId)).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
  });

  it("changes access and a job title, audited with what changed", async () => {
    const changed = await updateMember(
      clinic.owner.tenant,
      staff.memberId,
      { permissions: ["patients.view", "patients.create"], jobTitle: "Front desk" },
      "req_member_1",
    );
    expect(changed).toMatchObject({ permissions: ["patients.view", "patients.create"], jobTitle: "Front desk" });
    const { data: audit } = await admin()
      .from("audit_logs")
      .select("action, entity_id, changes")
      .eq("request_id", "req_member_1")
      .single();
    expect(audit).toEqual({
      action: "UPDATE",
      entity_id: staff.memberId,
      changes: {
        permissions: { from: "patients.view", to: "patients.view,patients.create" },
        job_title: { from: null, to: "Front desk" },
      },
    });
  });

  it("changes a doctor's details, and keeps each role's own (D95)", async () => {
    expect(
      await updateMember(clinic.owner.tenant, doctor.memberId, {
        doctor: { specialization: "Orthodontist", qualifications: "BDS, MDS", registrationNumber: "KL-1", fee: 70_000 },
      }),
    ).toMatchObject({
      specialization: "Orthodontist",
      doctor: { qualifications: "BDS, MDS", registrationNumber: "KL-1", feePaise: 70_000 },
    });
    await expect(updateMember(clinic.owner.tenant, doctor.memberId, { jobTitle: "Surgeon" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(
      updateMember(clinic.owner.tenant, staff.memberId, {
        doctor: { specialization: null, qualifications: null, registrationNumber: null, fee: null },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("deactivates and reactivates, audited; a deactivated member reaches nothing", async () => {
    const leaving = await addMember(clinic.clinicId, { permissions: ["patients.view"] });
    expect(await setMemberActive(clinic.owner.tenant, leaving.memberId, false, "req_member_2")).toMatchObject({
      status: "INACTIVE",
    });
    const { data: row } = await admin()
      .from("clinic_members")
      .select("deactivated_by")
      .eq("id", leaving.memberId)
      .single();
    expect(row).toEqual({ deactivated_by: clinic.owner.userId });
    const { data: seen } = await leaving.tenant!.supabase.from("clinic_members").select("id");
    expect(seen).toEqual([]);

    expect(await setMemberActive(clinic.owner.tenant, leaving.memberId, true)).toMatchObject({ status: "ACTIVE" });
    expect(await setMemberActive(clinic.owner.tenant, leaving.memberId, true)).toMatchObject({ status: "ACTIVE" });
    const { data: audit } = await admin()
      .from("audit_logs")
      .select("action, changes")
      .eq("request_id", "req_member_2")
      .single();
    expect(audit).toEqual({ action: "STATUS_CHANGE", changes: { status: { from: "ACTIVE", to: "INACTIVE" } } });
  });

  it("reactivates no one who has joined another clinic meanwhile (D23)", async () => {
    const moved = await addMember(clinic.clinicId, { permissions: ["patients.view"] });
    await setMemberActive(clinic.owner.tenant, moved.memberId, false);
    await admin().from("clinic_members").insert({
      clinic_id: other.clinicId,
      user_id: moved.userId,
      role: "STAFF",
      status: "ACTIVE",
      permissions: [],
      joined_at: new Date().toISOString(),
    });
    await expect(setMemberActive(clinic.owner.tenant, moved.memberId, true)).rejects.toMatchObject({
      code: "MEMBER_ALREADY_EXISTS",
    });
  });

  it("never deactivates the owner — the last one (plan §8.2 rule 7) — nor changes an invite", async () => {
    await expect(
      setMemberActive(clinic.owner.tenant, clinic.owner.session.membership!.id, false),
    ).rejects.toMatchObject({ code: "TEAM_OWNER_UNCHANGEABLE" });
    const invited = await addMember(clinic.clinicId, { permissions: ["patients.view"] });
    await setMemberStatus(invited.memberId, "INVITED");
    await expect(setMemberActive(clinic.owner.tenant, invited.memberId, false)).rejects.toMatchObject({
      code: "MEMBER_STILL_INVITED",
    });
  });
});

describe("a manager (D93)", () => {
  it("changes a member within their own access, giving only what they hold", async () => {
    expect(
      await updateMember(manager.tenant!, staff.memberId, { permissions: ["patients.view", "appointments.view"] }),
    ).toMatchObject({ permissions: ["patients.view", "appointments.view"] });
    await expect(
      updateMember(manager.tenant!, staff.memberId, { permissions: ["patients.view", "reports.view"] }),
    ).rejects.toMatchObject({ code: "TEAM_PERMISSION_NOT_HELD" });
    await expect(updateMember(manager.tenant!, staff.memberId, { permissions: ["team.manage"] })).rejects.toMatchObject(
      { code: "TEAM_MANAGE_OWNER_ONLY" },
    );
  });

  it("leaves to the owner anyone beyond them, the owner, and themselves", async () => {
    await expect(setMemberActive(manager.tenant!, senior.memberId, false)).rejects.toMatchObject({
      code: "TEAM_MEMBER_NOT_YOURS",
      kind: "BUSINESS_RULE",
    });
    await expect(setMemberActive(manager.tenant!, clinic.owner.session.membership!.id, false)).rejects.toMatchObject({
      code: "TEAM_OWNER_UNCHANGEABLE",
    });
    await expect(updateMember(manager.tenant!, manager.memberId, { permissions: [] })).rejects.toMatchObject({
      code: "TEAM_NOT_YOURSELF",
    });
    const peer = await addMember(clinic.clinicId, { permissions: ["team.manage"] });
    await expect(setMemberActive(manager.tenant!, peer.memberId, false)).rejects.toMatchObject({
      code: "TEAM_MEMBER_NOT_YOURS",
    });
  });

  it("is refused without team.manage, and in a view-only clinic", async () => {
    await expect(setMemberActive(staff.tenant!, doctor.memberId, false)).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    const { error } = await clinic.owner.tenant.supabase.rpc("team_target", {});
    expect(error?.code).toMatch(/^(42501|PGRST202)$/);

    await setValidUntil(other.clinicId, addDaysKey(todayKey(), -PLATFORM_SETTING_DEFAULTS.graceDays - 30));
    const theirs = await addMember(other.clinicId, { permissions: ["patients.view"] });
    await expect(setMemberActive(other.owner.tenant, theirs.memberId, false)).rejects.toMatchObject({
      code: "CLINIC_PLAN_EXPIRED",
    });
  });
});
