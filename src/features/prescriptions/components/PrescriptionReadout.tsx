import { UI_TEXT } from "@/constants/messages";

import { howTaken, medicineTitle } from "../content";
import type { PrescriptionContent } from "../types";

const { prescription: words } = UI_TEXT;

/**
 * A prescription read out (plan §13): each medicine in order — its name and
 * strength, how it is taken, its instructions — then the advice, and whether
 * the diagnosis prints. "No prescription yet" until it holds anything.
 */
export function PrescriptionReadout({ prescription }: { prescription: PrescriptionContent | null }) {
  if (prescription === null || (prescription.items.length === 0 && prescription.advice === null)) {
    return <p className="text-small text-muted">{words.none}</p>;
  }
  return (
    <div className="grid gap-4">
      {prescription.items.length > 0 && (
        <ol aria-label={words.title} className="grid gap-3">
          {prescription.items.map((item, index) => (
            <li key={index} className="flex gap-3">
              <span aria-hidden="true" className="w-5 shrink-0 text-right font-bold text-muted tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="font-bold break-words text-ink">{medicineTitle(item)}</p>
                {howTaken(item) && <p className="text-small text-ink">{howTaken(item)}</p>}
                {item.instructions && <p className="text-small break-words text-muted">{item.instructions}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {prescription.advice && (
        <div className="grid gap-0.5">
          <p className="text-small font-bold text-muted">{words.adviceLabel}</p>
          <p className="break-words whitespace-pre-line text-ink">{prescription.advice}</p>
        </div>
      )}
      {prescription.printDiagnosis && <p className="text-small text-muted">{words.printsDiagnosis}</p>}
    </div>
  );
}
