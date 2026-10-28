import { StatusPill } from "@/components/ui/status-pill";
import { CLINIC_STANDING_LABELS, CLINIC_STANDING_TONES, CONSOLE_CLINIC_FILTER_LABELS } from "@/constants/statuses";

import type { ConsoleClinic } from "../types";

/**
 * Where a clinic stands (D368), and **No trial** in coral while it waits for
 * activation (plan §7.6) — in words, never colour alone. `brief`, on a list's
 * row: one pill, No trial in place of the View only it always is.
 */
export function ClinicPills({
  clinic,
  brief = false,
}: {
  clinic: Pick<ConsoleClinic, "standing" | "noTrial">;
  brief?: boolean;
}) {
  const noTrial = clinic.noTrial && <StatusPill label={CONSOLE_CLINIC_FILTER_LABELS.NO_TRIAL} tone="attention" />;
  if (brief && noTrial) return noTrial;
  return (
    <span className="flex flex-wrap gap-1.5">
      <StatusPill label={CLINIC_STANDING_LABELS[clinic.standing]} tone={CLINIC_STANDING_TONES[clinic.standing]} />
      {noTrial}
    </span>
  );
}
