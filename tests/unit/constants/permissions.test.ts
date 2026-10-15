import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRESET,
  effectivePermissions,
  FOLLOW_UP_ACCESS,
  hasAccess,
  isPermission,
  OWNER_ONLY_PERMISSION,
  PERMISSION_DEPENDENCIES,
  PERMISSION_GROUPS,
  PERMISSION_PRESET_SETS,
  PERMISSION_PRESETS,
  PERMISSION_TEXT,
  PERMISSIONS,
  permissionsAreConsistent,
  withDependencies,
} from "@/constants/permissions";

describe("the permission catalogue (plan §8.1)", () => {
  it("names each permission once, with words for the editor", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
    for (const permission of PERMISSIONS) {
      expect(PERMISSION_TEXT[permission].label, permission).not.toBe("");
      expect(PERMISSION_TEXT[permission].description, permission).toMatch(/\.$/);
    }
  });

  it("knows its own names, and no other", () => {
    expect(isPermission("patients.view")).toBe(true);
    expect(isPermission("patients.delete")).toBe(false);
  });

  it("makes everything that shows a patient need patients.view (plan §8.2 rule 2, D102)", () => {
    for (const permission of PERMISSIONS.filter(
      (name) => /^(appointments|visits|payments|prescriptions)\./.test(name) || /^patients\.(create|edit)$/.test(name),
    )) {
      expect(PERMISSION_DEPENDENCIES[permission], permission).toContain("patients.view");
    }
  });

  it("lists what a permission needs in full, so one pass adds everything", () => {
    for (const [permission, needs] of Object.entries(PERMISSION_DEPENDENCIES)) {
      for (const needed of needs!) {
        for (const further of PERMISSION_DEPENDENCIES[needed] ?? []) expect(needs, permission).toContain(further);
      }
    }
  });
});

describe("withDependencies", () => {
  it("adds what each permission needs, in catalogue order", () => {
    expect(withDependencies(["payments.discount"])).toEqual(["patients.view", "payments.create", "payments.discount"]);
    expect(withDependencies(["prescriptions.write"])).toEqual(["patients.view", "visits.view", "prescriptions.write"]);
  });

  it("leaves a set that needs nothing as it is, once each", () => {
    expect(withDependencies(["settings.manage", "reports.view", "reports.view"])).toEqual([
      "reports.view",
      "settings.manage",
    ]);
  });
});

describe("permissionsAreConsistent", () => {
  it("is true when every permission has what it needs", () => {
    expect(permissionsAreConsistent([])).toBe(true);
    expect(permissionsAreConsistent(["patients.view", "visits.view", "prescriptions.write"])).toBe(true);
  });

  it("is false when one does not", () => {
    expect(permissionsAreConsistent(["visits.view"])).toBe(false);
    expect(permissionsAreConsistent(["patients.view", "payments.discount"])).toBe(false);
  });
});

describe("the presets (plan §8.3)", () => {
  it("are each consistent, so ticking one is always accepted", () => {
    for (const preset of PERMISSION_PRESETS) {
      expect(permissionsAreConsistent(PERMISSION_PRESET_SETS[preset].permissions), preset).toBe(true);
    }
  });

  it("start a doctor as a doctor and staff as reception, and a clinic manager without the settings", () => {
    expect(DEFAULT_PRESET).toEqual({ DOCTOR: "DOCTOR", STAFF: "RECEPTIONIST" });
    expect(PERMISSION_PRESET_SETS.MANAGER.permissions).not.toContain("settings.manage");
    expect(PERMISSION_PRESET_SETS.MANAGER.permissions).toContain(OWNER_ONLY_PERMISSION);
    expect(PERMISSION_PRESET_SETS.CUSTOM.permissions).toEqual([]);
  });

  it("never let an assistant bill or a receptionist see clinical records", () => {
    expect(PERMISSION_PRESET_SETS.ASSISTANT.permissions).not.toContain("payments.create");
    expect(PERMISSION_PRESET_SETS.RECEPTIONIST.permissions).not.toContain("visits.view");
  });

  it("let a receptionist bill and collect, never discount (D88)", () => {
    expect(PERMISSION_PRESET_SETS.RECEPTIONIST.permissions).toEqual(
      expect.arrayContaining(["payments.view", "payments.create"]),
    );
    expect(PERMISSION_PRESET_SETS.RECEPTIONIST.permissions).not.toContain("payments.discount");
  });
});

describe("PERMISSION_GROUPS (D89)", () => {
  it("puts every permission in one group, in catalogue order", () => {
    expect(PERMISSION_GROUPS.flatMap((group) => group.permissions)).toEqual([...PERMISSIONS]);
  });
});

describe("effectivePermissions", () => {
  it("gives the owner every permission, whatever is stored", () => {
    expect(effectivePermissions("OWNER", [])).toEqual(PERMISSIONS);
  });

  it("gives anyone else exactly what is stored", () => {
    expect(effectivePermissions("STAFF", ["patients.view"])).toEqual(["patients.view"]);
    expect(effectivePermissions("DOCTOR", [])).toEqual([]);
  });
});

describe("hasAccess", () => {
  it("lets any member through to a member route, the owner alone to an owner route, and a holder to a permission", () => {
    const staff = { role: "STAFF", permissions: ["patients.view"] } as const;
    const owner = { role: "OWNER", permissions: PERMISSIONS } as const;
    expect(hasAccess(staff, "MEMBER")).toBe(true);
    expect(hasAccess(staff, "OWNER")).toBe(false);
    expect(hasAccess(owner, "OWNER")).toBe(true);
    expect(hasAccess(staff, "patients.view")).toBe(true);
    expect(hasAccess(staff, "payments.create")).toBe(false);
  });

  it("lets a holder of any one of several through (D267)", () => {
    const desk = { role: "STAFF", permissions: ["patients.view", "appointments.view"] } as const;
    const nurse = { role: "STAFF", permissions: ["patients.view", "visits.view"] } as const;
    const billing = { role: "STAFF", permissions: ["patients.view", "payments.view"] } as const;
    expect(hasAccess(desk, FOLLOW_UP_ACCESS.list)).toBe(true);
    expect(hasAccess(nurse, FOLLOW_UP_ACCESS.list)).toBe(true);
    expect(hasAccess(billing, FOLLOW_UP_ACCESS.list)).toBe(false);
    expect(hasAccess(desk, FOLLOW_UP_ACCESS.note)).toBe(false);
  });
});
