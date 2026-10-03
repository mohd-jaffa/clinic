import { UI_TEXT } from "@/constants/messages";
import {
  OWNER_ONLY_PERMISSION,
  PERMISSION_DEPENDENCIES,
  PERMISSION_PRESET_SETS,
  PERMISSION_PRESETS,
  PERMISSIONS,
  withDependencies,
  type Permission,
  type PermissionPreset,
} from "@/constants/permissions";
import type { ClinicRole } from "@/constants/roles";

/**
 * What the team's editor lets someone grant (plan §8.2, D89), as plain
 * rules the sheet draws: the server and the database hold the same, and are
 * the last word.
 */
export interface Granter {
  role: ClinicRole;
  permissions: readonly Permission[];
}

/** What may be granted (rule 5): the owner anything; anyone else what they hold, never team.manage. */
export function grantable(granter: Granter): readonly Permission[] {
  if (granter.role === "OWNER") return PERMISSIONS;
  return granter.permissions.filter((permission) => permission !== OWNER_ONLY_PERMISSION);
}

/** A preset's permissions, within what may be granted. */
export function presetPermissions(preset: PermissionPreset, allowed: readonly Permission[]): Permission[] {
  return PERMISSION_PRESET_SETS[preset].permissions.filter((permission) => allowed.includes(permission));
}

/** The preset a set is, exactly, within what may be granted; Custom when it is none of them. */
export function presetOf(permissions: readonly Permission[], allowed: readonly Permission[]): PermissionPreset {
  const same = (preset: PermissionPreset) => {
    const expected = presetPermissions(preset, allowed);
    return expected.length === permissions.length && expected.every((permission) => permissions.includes(permission));
  };
  return PERMISSION_PRESETS.find((preset) => preset !== "CUSTOM" && same(preset)) ?? "CUSTOM";
}

/** Ticking one brings what it needs (rule 2); unticking takes only itself. */
export function toggled(permissions: readonly Permission[], permission: Permission, on: boolean): Permission[] {
  if (on) return withDependencies([...permissions, permission]);
  return PERMISSIONS.filter((held) => held !== permission && permissions.includes(held));
}

/**
 * Why a permission's box cannot be changed here, if it cannot: only the
 * owner gives team.manage; no one gives what they lack; and one another
 * ticked permission needs stays ticked (it has no words of its own — the
 * editor's hint says so).
 */
export function lockOf(
  permission: Permission,
  permissions: readonly Permission[],
  allowed: readonly Permission[],
): { locked: boolean; reason?: string } {
  if (!allowed.includes(permission)) {
    return {
      locked: true,
      reason: permission === OWNER_ONLY_PERMISSION ? UI_TEXT.team.ownerOnly : UI_TEXT.team.notYours,
    };
  }
  const needed = permissions.some((held) => PERMISSION_DEPENDENCIES[held]?.includes(permission));
  return { locked: needed };
}

/**
 * Whether the person signed in may change a member (D93), as 0013 decides
 * it: a joined member, not the owner, not themselves — and, for anyone but
 * the owner, one whose every permission they hold, without team.manage.
 */
export function canManage(
  granter: Granter & { memberId: string },
  member: { id: string; role: ClinicRole; status: string; permissions: readonly Permission[] },
): boolean {
  if (member.role === "OWNER" || member.id === granter.memberId || member.status === "INVITED") return false;
  if (granter.role === "OWNER") return true;
  return (
    !member.permissions.includes(OWNER_ONLY_PERMISSION) &&
    member.permissions.every((permission) => granter.permissions.includes(permission))
  );
}
