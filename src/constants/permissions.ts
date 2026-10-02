import type { ClinicRole } from "./roles";

/**
 * The permission catalogue (plan §8.1). A member holds a set of these on their
 * membership; the owner holds every one, implicitly, and stores none (§8.2).
 * The database's CHECK (`permissions_are_valid`, 0003) knows the same names
 * and the same dependencies; tests/db keeps them equal (AGENTS.md §8).
 */
export const PERMISSIONS = [
  "patients.view",
  "patients.create",
  "patients.edit",
  "appointments.view",
  "appointments.create",
  "appointments.edit",
  "appointments.cancel",
  "visits.view",
  "visits.create",
  "visits.edit",
  "prescriptions.write",
  "payments.view",
  "payments.create",
  "payments.discount",
  "payments.edit",
  "expenses.view",
  "expenses.create",
  "expenses.edit",
  "reports.view",
  "team.manage",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/** What each permission allows, in the words the permission editor shows. */
export const PERMISSION_TEXT: Record<Permission, { label: string; description: string }> = {
  "patients.view": { label: "See patients", description: "See patients and their contact details." },
  "patients.create": { label: "Add patients", description: "Add patients." },
  "patients.edit": { label: "Edit patients", description: "Edit patients; archive and restore them." },
  "appointments.view": { label: "See appointments", description: "See the calendar and today’s queue." },
  "appointments.create": { label: "Book appointments", description: "Book appointments and add walk-ins." },
  "appointments.edit": {
    label: "Change appointments",
    description: "Reschedule; confirm; mark arrived and no-show; run the queue.",
  },
  "appointments.cancel": { label: "Cancel appointments", description: "Cancel appointments." },
  "visits.view": {
    label: "See clinical records",
    description: "See visits, vitals, alerts, prescriptions, treatments and follow-ups.",
  },
  "visits.create": { label: "Start visits", description: "Start visits and record vitals." },
  "visits.edit": {
    label: "Write clinical notes",
    description: "Write and correct clinical notes, alerts, treatments and follow-ups.",
  },
  "prescriptions.write": {
    label: "Type prescriptions",
    description: "Type a prescription for the visit’s doctor, in the doctor’s name.",
  },
  "payments.view": { label: "See bills and payments", description: "See bills, payments and balances." },
  "payments.create": {
    label: "Bill and collect",
    description: "Create bills from the price list, record payments, mark a visit No charge.",
  },
  "payments.discount": {
    label: "Give discounts",
    description: "Give a discount, or change a line’s price from the price list.",
  },
  "payments.edit": { label: "Void and refund", description: "Void bills and payments; record refunds." },
  "expenses.view": { label: "See expenses", description: "See expenses." },
  "expenses.create": { label: "Add expenses", description: "Add expenses." },
  "expenses.edit": { label: "Edit expenses", description: "Edit and archive expenses." },
  "reports.view": { label: "See money and reports", description: "Home’s money figures and the reports." },
  "team.manage": {
    label: "Manage the team",
    description: "Invite members, change their permissions, deactivate them.",
  },
  "settings.manage": {
    label: "Manage clinic settings",
    description: "Clinic details, logo, price list, holidays and leave.",
  },
};

/**
 * What holding a permission needs (plan §8.2 rule 2): patient data needs
 * `patients.view`, so anything that shows a patient brings it; typing a
 * prescription needs the clinical record; a discount is given on a bill.
 * The editor ticks these itself, and a set without them is refused — by the
 * server and by the database.
 */
export const PERMISSION_DEPENDENCIES: Partial<Record<Permission, readonly Permission[]>> = {
  "appointments.view": ["patients.view"],
  "appointments.create": ["patients.view"],
  "appointments.edit": ["patients.view"],
  "appointments.cancel": ["patients.view"],
  "visits.view": ["patients.view"],
  "visits.create": ["patients.view"],
  "visits.edit": ["patients.view"],
  "prescriptions.write": ["patients.view", "visits.view"],
  "payments.view": ["patients.view"],
  "payments.create": ["patients.view"],
  "payments.discount": ["patients.view", "payments.create"],
  "payments.edit": ["patients.view"],
};

/** A set of permissions with everything they need added, in catalogue order. */
export function withDependencies(permissions: readonly Permission[]): Permission[] {
  const held = new Set<Permission>(permissions);
  for (const permission of permissions) {
    for (const needed of PERMISSION_DEPENDENCIES[permission] ?? []) held.add(needed);
  }
  return PERMISSIONS.filter((permission) => held.has(permission));
}

/** Whether every permission in the set has what it needs (§8.2 rule 2). */
export function permissionsAreConsistent(permissions: readonly Permission[]): boolean {
  return permissions.every((permission) =>
    (PERMISSION_DEPENDENCIES[permission] ?? []).every((needed) => permissions.includes(needed)),
  );
}

/** Only the owner grants this one (§8.2 rule 5). */
export const OWNER_ONLY_PERMISSION: Permission = "team.manage";

export const PERMISSION_PRESETS = ["DOCTOR", "RECEPTIONIST", "ASSISTANT", "MANAGER", "CUSTOM"] as const;
export type PermissionPreset = (typeof PERMISSION_PRESETS)[number];

/** The presets that fill the checkboxes (plan §8.3); the owner may change any of them after. */
export const PERMISSION_PRESET_SETS: Record<PermissionPreset, { label: string; permissions: readonly Permission[] }> = {
  DOCTOR: {
    label: "Doctor",
    permissions: [
      "patients.view",
      "patients.create",
      "patients.edit",
      "appointments.view",
      "appointments.create",
      "appointments.edit",
      "appointments.cancel",
      "visits.view",
      "visits.create",
      "visits.edit",
      "payments.view",
      "payments.create",
      "payments.discount",
    ],
  },
  RECEPTIONIST: {
    label: "Receptionist",
    permissions: [
      "patients.view",
      "patients.create",
      "patients.edit",
      "appointments.view",
      "appointments.create",
      "appointments.edit",
      "appointments.cancel",
      "payments.view",
      "payments.create",
    ],
  },
  ASSISTANT: {
    label: "Assistant / Nurse",
    permissions: [
      "patients.view",
      "appointments.view",
      "appointments.edit",
      "visits.view",
      "visits.create",
      "visits.edit",
      "prescriptions.write",
    ],
  },
  MANAGER: {
    label: "Clinic manager",
    permissions: PERMISSIONS.filter((permission) => permission !== "settings.manage"),
  },
  CUSTOM: { label: "Custom", permissions: [] },
};

/** The preset a new member of this role starts with (plan §8.3). */
export const DEFAULT_PRESET: Record<Exclude<ClinicRole, "OWNER">, PermissionPreset> = {
  DOCTOR: "DOCTOR",
  STAFF: "RECEPTIONIST",
};

/**
 * What a member may do: the owner everything (§8.2 rule 1), anyone else
 * exactly what is stored on their membership.
 */
export function effectivePermissions(role: ClinicRole, stored: readonly Permission[]): readonly Permission[] {
  return role === "OWNER" ? PERMISSIONS : stored;
}

/**
 * Who a route serves, besides a permission: any active member of the clinic,
 * or its owner alone (the Plan screen, the activity log, import, export,
 * deletion — plan §31.2). A route always names one of these or a permission;
 * there is no default (AGENTS.md §8).
 */
export const ROUTE_ACCESS = { member: "MEMBER", owner: "OWNER" } as const;
export type RouteAccess = Permission | (typeof ROUTE_ACCESS)[keyof typeof ROUTE_ACCESS];
