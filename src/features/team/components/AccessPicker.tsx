"use client";

import { useId } from "react";

import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { FieldError } from "@/components/ui/field";
import { UI_TEXT } from "@/constants/messages";
import {
  PERMISSION_GROUPS,
  PERMISSION_PRESET_SETS,
  PERMISSION_PRESETS,
  PERMISSION_TEXT,
  type Permission,
} from "@/constants/permissions";

import { lockOf, presetOf, presetPermissions, toggled } from "../access";

const { team } = UI_TEXT;
const PRESETS = PERMISSION_PRESETS.map((preset) => ({ value: preset, label: PERMISSION_PRESET_SETS[preset].label }));

/**
 * What a member may do (plan §8.1 – §8.3, D89): a preset to start from, then
 * every permission by the part of the clinic it opens, each still
 * changeable. Ticking one ticks what it needs; what this person may not give
 * is shown and cannot be ticked, and says why. The chosen preset is whichever
 * the ticks are exactly — Custom when none.
 */
export function AccessPicker({
  value,
  onChange,
  allowed,
  error,
}: {
  value: readonly Permission[];
  onChange: (permissions: Permission[]) => void;
  /** What the person inviting may grant. */
  allowed: readonly Permission[];
  error?: string;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="grid gap-5 border-t border-line pt-5">
      <div>
        <h3 id={titleId} className="text-title font-bold text-ink">
          {team.accessTitle}
        </h3>
        <p className="mt-1 text-small text-muted">{team.accessHint}</p>
      </div>
      <div>
        <p className="mb-2 text-small font-bold text-ink">{team.presetLabel}</p>
        <ChoiceChips
          label={team.presetLabel}
          value={presetOf(value, allowed)}
          options={PRESETS}
          onChange={(preset) => onChange(presetPermissions(preset, allowed))}
          wrap
        />
      </div>
      {PERMISSION_GROUPS.map((group) => (
        <CheckboxGroup
          key={group.label}
          label={group.label}
          options={group.permissions.map((permission) => {
            const lock = lockOf(permission, value, allowed);
            return {
              value: permission,
              label: PERMISSION_TEXT[permission].label,
              hint: lock.reason ?? PERMISSION_TEXT[permission].description,
              disabled: lock.locked,
            };
          })}
          value={value.filter((permission) => group.permissions.includes(permission))}
          onChange={(next) => {
            const changed = group.permissions.find(
              (permission) => value.includes(permission) !== next.includes(permission),
            )!;
            onChange(toggled(value, changed, next.includes(changed)));
          }}
        />
      ))}
      <FieldError message={error} />
    </section>
  );
}
