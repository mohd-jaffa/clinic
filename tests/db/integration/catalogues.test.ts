import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEFAULT_APPOINTMENT_TYPES, DEFAULT_EXPENSE_CATEGORIES } from "@/constants/seeds";
import { appointmentTypes, expenseCategories, services } from "@/features/clinic/catalogues";
import {
  addMember,
  admin,
  registerClinic,
  removeAll,
  type SignedIn,
  type TestClinic,
} from "@tests/support/integration";

/**
 * The clinic's catalogues against the local Supabase (plan §9; R3.2, D80 –
 * D83): read by every member, changed with settings.manage; a name the
 * clinic's only once among its active entries; new types and categories
 * placed last; archived and restored, audited as that; and one of each
 * always kept, even when two people archive the last two at once.
 */
let clinic: TestClinic;
let other: TestClinic;
let manager: SignedIn & { memberId: string };
let receptionist: SignedIn & { memberId: string };

beforeAll(async () => {
  [clinic, other] = await Promise.all([registerClinic(), registerClinic()]);
  [manager, receptionist] = await Promise.all([
    addMember(clinic.clinicId, { permissions: ["settings.manage"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view"] }),
  ]);
});

afterAll(removeAll);

describe("reading them", () => {
  it("shows any member the clinic's own, seeded, in its order", async () => {
    const types = await appointmentTypes.list(receptionist.tenant!);
    expect(types.map(({ name, minutes }) => ({ name, minutes }))).toEqual(DEFAULT_APPOINTMENT_TYPES);
    expect((await expenseCategories.list(receptionist.tenant!)).map(({ name }) => name)).toEqual(
      DEFAULT_EXPENSE_CATEGORIES,
    );
    expect(await services.list(receptionist.tenant!)).toEqual([
      expect.objectContaining({ name: "Consultation", category: "CONSULTATION", pricePaise: 0, active: true }),
    ]);
  });

  it("never shows, nor changes, another clinic's", async () => {
    const [theirs] = await services.list(other.owner.tenant);
    expect((await services.list(clinic.owner.tenant)).map(({ id }) => id)).not.toContain(theirs.id);
    await expect(services.change(clinic.owner.tenant, theirs.id, { active: false })).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND",
    });
  });
});

describe("changing them", () => {
  it("adds for settings.manage only, audited with its values", async () => {
    const added = await services.add(
      manager.tenant!,
      { name: "Root canal", category: "PROCEDURE", price: 450_000 },
      "req_catalogue_1",
    );
    expect(added).toMatchObject({ name: "Root canal", pricePaise: 450_000, active: true });
    const { data: audit } = await admin()
      .from("audit_logs")
      .select("action, entity_type, entity_id, actor_id, changes")
      .eq("request_id", "req_catalogue_1")
      .single();
    expect(audit).toEqual({
      action: "CREATE",
      entity_type: "services",
      entity_id: added.id,
      actor_id: manager.userId,
      changes: {
        name: { from: null, to: "Root canal" },
        category: { from: null, to: "PROCEDURE" },
        price_paise: { from: null, to: 450_000 },
      },
    });

    await expect(
      services.add(receptionist.tenant!, { name: "Scaling", category: "PROCEDURE", price: 80_000 }),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
  });

  it("places a new appointment type and expense category last (D81)", async () => {
    await appointmentTypes.add(manager.tenant!, { name: "Root canal", minutes: 45 });
    await expenseCategories.add(manager.tenant!, { name: "Lab fees" });
    expect((await appointmentTypes.list(manager.tenant!)).at(-1)).toMatchObject({ name: "Root canal", minutes: 45 });
    expect((await expenseCategories.list(manager.tenant!)).at(-1)).toMatchObject({ name: "Lab fees" });

    const { data: positions } = await admin()
      .from("appointment_types")
      .select("position")
      .eq("clinic_id", clinic.clinicId)
      .order("position");
    expect(positions!.map(({ position }) => position)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("refuses a name an active entry has, whatever its case, in the catalogue's words", async () => {
    await expect(
      services.add(manager.tenant!, { name: "root CANAL", category: "PROCEDURE", price: 0 }),
    ).rejects.toMatchObject({ code: "SERVICE_ALREADY_EXISTS", kind: "CONFLICT" });
    await expect(appointmentTypes.add(manager.tenant!, { name: "review", minutes: 15 })).rejects.toMatchObject({
      code: "APPOINTMENT_TYPE_ALREADY_EXISTS",
    });
    await expect(expenseCategories.add(manager.tenant!, { name: "RENT" })).rejects.toMatchObject({
      code: "EXPENSE_CATEGORY_ALREADY_EXISTS",
    });
  });

  it("archives and restores, audited as that — refusing a restore while an active entry has the name (D80)", async () => {
    const types = await appointmentTypes.list(manager.tenant!);
    const review = types.find(({ name }) => name === "Review")!;
    expect(
      await appointmentTypes.change(manager.tenant!, review.id, { active: false }, "req_catalogue_2"),
    ).toMatchObject({ active: false });

    // Its name is free again, until the archived one would come back beside it.
    const second = await appointmentTypes.add(manager.tenant!, { name: "Review", minutes: 20 });
    await expect(appointmentTypes.change(manager.tenant!, review.id, { active: true })).rejects.toMatchObject({
      code: "APPOINTMENT_TYPE_ALREADY_EXISTS",
    });
    await appointmentTypes.change(manager.tenant!, second.id, { active: false });
    expect(
      await appointmentTypes.change(manager.tenant!, review.id, { active: true }, "req_catalogue_3"),
    ).toMatchObject({ name: "Review", minutes: 15, active: true });

    const { data: audit } = await admin()
      .from("audit_logs")
      .select("action, changes")
      .in("request_id", ["req_catalogue_2", "req_catalogue_3"])
      .order("created_at");
    expect(audit).toEqual([
      { action: "ARCHIVE", changes: { active: { from: true, to: false } } },
      { action: "RESTORE", changes: { active: { from: false, to: true } } },
    ]);
  });
});

describe("one of each is kept (D83)", () => {
  it("refuses archiving the last Consultation, or moving it out of Consultation", async () => {
    const [consultation] = (await services.list(clinic.owner.tenant)).filter(
      ({ category, active }) => category === "CONSULTATION" && active,
    );
    await expect(services.change(clinic.owner.tenant, consultation.id, { active: false })).rejects.toMatchObject({
      code: "CONSULTATION_SERVICE_REQUIRED",
      kind: "BUSINESS_RULE",
    });
    await expect(
      services.change(clinic.owner.tenant, consultation.id, {
        details: { name: "Consultation", category: "PROCEDURE", price: 0 },
      }),
    ).rejects.toMatchObject({ code: "CONSULTATION_SERVICE_REQUIRED" });

    // With another Consultation beside it, it may go.
    await services.add(clinic.owner.tenant, {
      name: "Emergency consultation",
      category: "CONSULTATION",
      price: 70_000,
    });
    expect(await services.change(clinic.owner.tenant, consultation.id, { active: false })).toMatchObject({
      active: false,
    });
  });

  it("refuses archiving the last expense category", async () => {
    const categories = (await expenseCategories.list(other.owner.tenant)).filter(({ active }) => active);
    for (const category of categories.slice(1)) {
      await expenseCategories.change(other.owner.tenant, category.id, { active: false });
    }
    await expect(
      expenseCategories.change(other.owner.tenant, categories[0].id, { active: false }),
    ).rejects.toMatchObject({ code: "EXPENSE_CATEGORY_REQUIRED" });
  });

  it("lets only one of two archives of the last two appointment types through, at the same moment", async () => {
    const types = (await appointmentTypes.list(other.owner.tenant)).filter(({ active }) => active);
    for (const type of types.slice(2)) await appointmentTypes.change(other.owner.tenant, type.id, { active: false });

    const outcomes = await Promise.allSettled(
      types.slice(0, 2).map((type) => appointmentTypes.change(other.owner.tenant, type.id, { active: false })),
    );
    expect(outcomes.map(({ status }) => status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(outcomes.find(({ status }) => status === "rejected")).toMatchObject({
      reason: { code: "APPOINTMENT_TYPE_REQUIRED" },
    });
    expect((await appointmentTypes.list(other.owner.tenant)).filter(({ active }) => active)).toHaveLength(1);
  });
});
