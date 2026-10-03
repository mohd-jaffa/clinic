import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PLATFORM_SETTING_DEFAULTS } from "@/constants/platform";
import { LOGO_BUCKET } from "@/constants/uploads";
import { getClinic, readLogo, removeLogo, replaceLogo, updateClinic } from "@/features/clinic/api";
import { logoFolder } from "@/features/clinic/logo";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
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
 * The clinic's profile and logo against the local Supabase (plan §9, §28.8;
 * R3.1): changed only with settings.manage while the clinic can write, by the
 * database's own functions; the logo stored, replaced and removed in the
 * order AGENTS.md §20 sets; and one clinic's logo out of every other's reach.
 */
let clinic: TestClinic;
let other: TestClinic;
let manager: SignedIn & { memberId: string };
let receptionist: SignedIn & { memberId: string };

// A 1×1 PNG.
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);

const filesOf = async (clinicId: string) => {
  const { data } = await admin().storage.from(LOGO_BUCKET).list(logoFolder(clinicId));
  return (data ?? []).map((file) => file.name);
};

beforeAll(async () => {
  [clinic, other] = await Promise.all([registerClinic(), registerClinic()]);
  [manager, receptionist] = await Promise.all([
    addMember(clinic.clinicId, { permissions: ["settings.manage"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view"] }),
  ]);
});

afterAll(removeAll);

describe("the clinic's profile (D78)", () => {
  it("is changed by settings.manage, only in what is named, and audited", async () => {
    const saved = await updateClinic(
      manager.tenant!,
      {
        details: {
          name: "Smile Care Dental",
          clinicType: "DENTAL",
          address: "12 MG Road",
          city: "Kochi",
          phone: "0484 234 5678",
          email: "desk@smilecare.in",
          gstin: "32ABCDE1234F1Z5",
        },
        paperSize: "A5",
      },
      "req_clinic_1",
    );
    expect(saved).toMatchObject({
      name: "Smile Care Dental",
      email: "desk@smilecare.in",
      gstin: "32ABCDE1234F1Z5",
      paperSize: "A5",
      feeTiming: "AFTER_CONSULTATION",
    });

    const fee = await updateClinic(clinic.owner.tenant, { feeTiming: "AT_ARRIVAL" });
    expect(fee).toMatchObject({ name: "Smile Care Dental", paperSize: "A5", feeTiming: "AT_ARRIVAL" });

    const { data: audit } = await admin()
      .from("audit_logs")
      .select("action, entity_type, entity_id, changes, actor_id")
      .eq("request_id", "req_clinic_1")
      .single();
    expect(audit).toMatchObject({
      action: "UPDATE",
      entity_type: "clinics",
      entity_id: clinic.clinicId,
      actor_id: manager.userId,
      changes: { paper_size: { from: "A4", to: "A5" }, name: { to: "Smile Care Dental" } },
    });
  });

  it("clears an optional detail given as none", async () => {
    const current = await getClinic(clinic.owner.tenant);
    const cleared = await updateClinic(clinic.owner.tenant, {
      details: {
        name: current.name,
        clinicType: current.clinicType,
        address: current.address,
        city: current.city,
        phone: null,
        email: null,
        gstin: null,
      },
    });
    expect(cleared).toMatchObject({ phone: null, email: null, gstin: null });
  });

  it("is refused to a member without settings.manage, by the database itself", async () => {
    await expect(updateClinic(receptionist.tenant!, { paperSize: "A4" })).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
  });

  it("is never written straight to the table, not even by the owner", async () => {
    const { error } = await clinic.owner.tenant.supabase
      .from("clinics")
      .update({ name: "Renamed" })
      .eq("id", clinic.clinicId);
    expect(error?.code).toBe("42501");
  });
});

describe("the logo (AGENTS.md §20, D79)", () => {
  it("is stored, read back as the image it is, and replaced with the old file removed", async () => {
    const first = await replaceLogo(manager.tenant!, PNG);
    expect(first.logoUrl).toMatch(/^\/api\/clinic\/logo\?v=[0-9a-f-]{36}$/);
    expect(await filesOf(clinic.clinicId)).toHaveLength(1);

    const { file, type } = await readLogo(receptionist.tenant!);
    expect(type).toBe("image/png");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(PNG);

    const second = await replaceLogo(clinic.owner.tenant, PNG);
    expect(second.logoUrl).not.toBe(first.logoUrl);
    expect(await filesOf(clinic.clinicId)).toEqual([second.logoUrl!.split("v=")[1]]);
  });

  it("is out of reach of another clinic, and of a member without settings.manage", async () => {
    const [name] = await filesOf(clinic.clinicId);
    const path = `${logoFolder(clinic.clinicId)}/${name}`;

    const peek = await other.owner.tenant.supabase.storage.from(LOGO_BUCKET).download(path);
    expect(peek.data).toBeNull();
    await expect(replaceLogo({ ...other.owner.tenant, clinicId: clinic.clinicId }, PNG)).rejects.toMatchObject({
      code: "LOGO_UPLOAD_FAILED",
    });
    await expect(replaceLogo(receptionist.tenant!, PNG)).rejects.toMatchObject({ code: "LOGO_UPLOAD_FAILED" });

    // Pointing a clinic at another's file is refused by the reference's own shape.
    const { error } = await other.owner.tenant.supabase.rpc("set_clinic_logo", { p_path: path });
    expect(error?.code).toBe("23514");
    expect(await filesOf(clinic.clinicId)).toEqual([name]);
  });

  it("is never pointed at a file that is not stored", async () => {
    const { error } = await clinic.owner.tenant.supabase.rpc("set_clinic_logo", {
      p_path: `${logoFolder(clinic.clinicId)}/00000000-0000-4000-8000-000000000000`,
    });
    expect(error?.hint).toBe("LOGO_UPLOAD_FAILED");
  });

  it("is removed, its file with it, leaving the clinic's name alone", async () => {
    expect((await removeLogo(manager.tenant!)).logoUrl).toBeNull();
    expect(await filesOf(clinic.clinicId)).toEqual([]);
    await expect(readLogo(clinic.owner.tenant)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await removeLogo(manager.tenant!)).logoUrl).toBeNull();
  });
});

describe("a view-only clinic (plan §7.3)", () => {
  beforeAll(async () => {
    await setValidUntil(other.clinicId, addDaysKey(todayKey(), -PLATFORM_SETTING_DEFAULTS.graceDays - 1));
  });

  it("changes nothing of itself, and stores no logo", async () => {
    await expect(updateClinic(other.owner.tenant, { paperSize: "A5" })).rejects.toMatchObject({
      code: "CLINIC_PLAN_EXPIRED",
    });
    await expect(replaceLogo(other.owner.tenant, PNG)).rejects.toMatchObject({ code: "LOGO_UPLOAD_FAILED" });
    await expect(removeLogo(other.owner.tenant)).rejects.toMatchObject({ code: "CLINIC_PLAN_EXPIRED" });
    expect(await filesOf(other.clinicId)).toEqual([]);
  });
});
