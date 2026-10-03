import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { listDoctors } from "@/features/team/api";
import { getMember, updateOwnDoctor } from "@/features/team/members";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  setValidUntil,
  signIn,
  tenantOf,
  type TestClinic,
} from "@tests/support/integration";

/**
 * The owner's own doctor profile against the local Supabase (plan §3.1;
 * R3.7, D96, D97): turned off it is kept, inactive — out of the pickers and
 * the session — and turned on it comes back as it was; one is made for an
 * owner who never had one; details change only while it is on; only the
 * owner changes it, and not in a view-only clinic.
 */
let clinic: TestClinic;

const details = { specialization: "Orthodontist", qualifications: "BDS, MDS", registrationNumber: "KL-1", fee: 70_000 };

beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon" });
});

afterAll(removeAll);

describe("the owner's doctor profile (D96, D97)", () => {
  it("changes their details, audited, while they see patients", async () => {
    const saved = await updateOwnDoctor(clinic.owner.tenant, { doctor: details }, "req_own_1");
    expect(saved).toMatchObject({
      role: "OWNER",
      seesPatients: true,
      doctor: {
        specialization: "Orthodontist",
        qualifications: "BDS, MDS",
        registrationNumber: "KL-1",
        feePaise: 70_000,
      },
    });
    const { data: audit } = await admin()
      .from("audit_logs")
      .select("action, changes")
      .eq("request_id", "req_own_1")
      .single();
    expect(audit).toMatchObject({
      action: "UPDATE",
      changes: {
        specialization: { from: null, to: "Orthodontist" },
        consultation_fee_paise: { from: null, to: 70_000 },
      },
    });
  });

  it("keeps the profile when they stop seeing patients, out of the pickers and their session, and brings it back", async () => {
    const doctorId = clinic.owner.session.membership!.doctorId!;
    const off = await updateOwnDoctor(clinic.owner.tenant, { seesPatients: false });
    expect(off).toMatchObject({ seesPatients: false, doctor: { specialization: "Orthodontist" } });
    expect((await listDoctors(clinic.owner.tenant)).map(({ id }) => id)).not.toContain(doctorId);
    expect((await signIn(clinic.owner.email, clinic.owner.password)).membership?.doctorId).toBeNull();
    await expect(updateOwnDoctor(clinic.owner.tenant, { doctor: details })).rejects.toMatchObject({
      code: "OWNER_NOT_DOCTOR",
      kind: "BUSINESS_RULE",
    });

    expect(await updateOwnDoctor(clinic.owner.tenant, { seesPatients: true })).toMatchObject({
      seesPatients: true,
      doctor: { registrationNumber: "KL-1" },
    });
    expect((await signIn(clinic.owner.email, clinic.owner.password)).membership?.doctorId).toBe(doctorId);
  });

  it("makes one for an owner who never saw patients, and turns it on and fills it in at once", async () => {
    const other = await registerClinic({ seesPatients: false });
    expect(await getMember(other.owner.tenant, other.owner.session.membership!.id)).toMatchObject({
      seesPatients: false,
      doctor: null,
    });
    expect(await updateOwnDoctor(other.owner.tenant, { seesPatients: true, doctor: details })).toMatchObject({
      seesPatients: true,
      doctor: { specialization: "Orthodontist" },
    });
    const session = await signIn(other.owner.email, other.owner.password);
    expect((await listDoctors(tenantOf(session)!)).map(({ id }) => id)).toContain(session.membership!.doctorId);
  });

  it("is the owner's alone, and not in a view-only clinic", async () => {
    const manager = await addMember(clinic.clinicId, { permissions: ["team.manage", "patients.view"] });
    await expect(updateOwnDoctor(manager.tenant!, { seesPatients: true })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });

    const lapsed = await registerClinic();
    await setValidUntil(lapsed.clinicId, addDaysKey(todayKey(), -PLATFORM_SETTING_DEFAULTS.graceDays - 30));
    await expect(updateOwnDoctor(lapsed.owner.tenant, { seesPatients: false })).rejects.toMatchObject({
      code: "CLINIC_PLAN_EXPIRED",
    });
  });
});
