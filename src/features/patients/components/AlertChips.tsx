import { AlertChip } from "@/components/ui/alert-chip";
import { UI_TEXT } from "@/constants/messages";
import { ALERT_KIND_LABELS } from "@/constants/statuses";

import type { PatientAlert } from "../types";

/**
 * A patient's active alerts as chips (plan §10.4, §12.2), in the order given —
 * allergies first — each its own item in the row it sits in, an allergy in
 * the danger tone. The profile's header and the visit's both show them.
 */
export function AlertChips({ alerts }: { alerts: readonly PatientAlert[] }) {
  return (
    <ul aria-label={UI_TEXT.alerts.title} className="contents">
      {alerts.map((alert) => (
        <li key={alert.id} className="max-w-full">
          <AlertChip
            label={alert.label}
            kind={ALERT_KIND_LABELS[alert.kind]}
            tone={alert.kind === "ALLERGY" ? "danger" : "note"}
          />
        </li>
      ))}
    </ul>
  );
}
