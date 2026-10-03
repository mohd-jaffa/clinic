import { describe, expect, it } from "vitest";

import { PERMISSION_PRESET_SETS, PERMISSIONS } from "@/constants/permissions";
import { grantable, lockOf, presetOf, presetPermissions, toggled } from "@/features/team/access";

const owner = { role: "OWNER" as const, permissions: [] };
const manager = {
  role: "STAFF" as const,
  permissions: ["team.manage" as const, "patients.view" as const, "patients.create" as const],
};

describe("grantable (plan §8.2 rule 5)", () => {
  it("lets the owner give anything, and anyone else what they hold but team.manage", () => {
    expect(grantable(owner)).toEqual(PERMISSIONS);
    expect(grantable(manager)).toEqual(["patients.view", "patients.create"]);
  });
});

describe("presets (plan §8.3)", () => {
  it("fill a preset within what may be given", () => {
    expect(presetPermissions("RECEPTIONIST", PERMISSIONS)).toEqual(PERMISSION_PRESET_SETS.RECEPTIONIST.permissions);
    expect(presetPermissions("RECEPTIONIST", grantable(manager))).toEqual(["patients.view", "patients.create"]);
  });

  it("name the preset a set is exactly, and Custom for anything else", () => {
    const all = PERMISSIONS;
    expect(presetOf(PERMISSION_PRESET_SETS.DOCTOR.permissions, all)).toBe("DOCTOR");
    expect(presetOf(["patients.view"], all)).toBe("CUSTOM");
    expect(presetOf([], all)).toBe("CUSTOM");
    expect(presetOf(["patients.view", "patients.create"], grantable(manager))).toBe("DOCTOR");
  });
});

describe("toggled (plan §8.2 rule 2)", () => {
  it("ticks what a permission needs with it, and unticks only itself", () => {
    expect(toggled([], "payments.discount", true)).toEqual(["patients.view", "payments.create", "payments.discount"]);
    expect(toggled(["patients.view", "patients.create"], "patients.create", false)).toEqual(["patients.view"]);
  });
});

describe("lockOf", () => {
  it("locks what may not be given, saying why, and what another ticked one needs", () => {
    expect(lockOf("team.manage", [], grantable(manager))).toEqual({
      locked: true,
      reason: "Only the owner can give this.",
    });
    expect(lockOf("visits.view", [], grantable(manager))).toEqual({
      locked: true,
      reason: "You don’t have this yourself.",
    });
    expect(lockOf("patients.view", ["patients.view", "appointments.view"], PERMISSIONS)).toEqual({ locked: true });
    expect(lockOf("patients.view", ["patients.view"], PERMISSIONS)).toEqual({ locked: false });
  });
});
