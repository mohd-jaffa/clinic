"use client";

import { useState } from "react";

import type { Treatment } from "../types";
import { CancelTreatmentSheet } from "./CancelTreatmentSheet";
import { EditTreatmentSheet } from "./TreatmentForms";
import { TreatmentSheet, type TreatmentVisit } from "./TreatmentSheet";

type Step = "DETAIL" | "EDIT" | "CANCEL";

/**
 * A treatment opened (D261), from a visit's card or the patient's profile:
 * its sheet, and the sheet **Edit** or **Cancel treatment** opens over the
 * screen in its place. Closing one of those goes back to its sheet; done,
 * everything closes, and the card says so.
 */
export function TreatmentPanel({
  treatment,
  visit,
  writes,
  open,
  onClose,
}: {
  treatment: Treatment | null;
  visit: TreatmentVisit | null;
  writes: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("DETAIL");
  // How many times Edit or Cancel was opened: each opens afresh on the treatment as it is then.
  const [count, setCount] = useState(0);
  if (treatment === null) return null;
  const to = (next: Step) => () => {
    setCount((was) => was + 1);
    setStep(next);
  };
  const back = () => setStep("DETAIL");
  const done = () => {
    setStep("DETAIL");
    onClose();
  };

  return (
    <>
      <TreatmentSheet
        treatment={treatment}
        visit={visit}
        writes={writes}
        open={open && step === "DETAIL"}
        onClose={done}
        onEdit={to("EDIT")}
        onCancel={to("CANCEL")}
      />
      {writes && (
        <>
          <EditTreatmentSheet
            key={`edit-${count}`}
            treatment={treatment}
            visitId={visit?.id ?? null}
            open={open && step === "EDIT"}
            onClose={back}
            onDone={done}
          />
          <CancelTreatmentSheet
            key={`cancel-${count}`}
            treatment={treatment}
            visitId={visit?.id ?? null}
            open={open && step === "CANCEL"}
            onClose={back}
            onDone={done}
          />
        </>
      )}
    </>
  );
}
