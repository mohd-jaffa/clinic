"use client";

import { UserPlus } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Row, RowList } from "@/components/ui/row";
import { SearchField } from "@/components/ui/search-field";
import { PICKER_RESULTS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { describePatient } from "@/features/patients/describe";
import { usePatientSearch } from "@/features/patients/hooks/usePatientSearch";
import { prefillFrom, type PatientPrefill } from "@/features/patients/prefill";
import type { PatientListItem } from "@/features/patients/types";

const { appointments } = UI_TEXT;

/** A patient as a picker shows the one chosen: enough to tell one of a family from another. */
export type ChosenPatient = Pick<PatientListItem, "id" | "number" | "name" | "dateOfBirth" | "gender">;

/**
 * Who the booking is for (D144): a search in the sheet — name, mobile or
 * number — its best matches under it to choose from, and once chosen the
 * patient with **Change**. **New patient** (for `patients.create`) leaves the
 * search for the new patient's fields, filled from what was typed (D112).
 */
export function PatientPicker({
  chosen,
  onChoose,
  onClear,
  onNew,
  error,
}: {
  chosen: ChosenPatient | null;
  onChoose: (patient: ChosenPatient) => void;
  /** Change; none where nothing stays chosen — a new bill leaves for the patient's own (D313). */
  onClear?: () => void;
  /** None for someone who may not add a patient. */
  onNew?: (prefill: PatientPrefill) => void;
  error?: string;
}) {
  const [typed, setTyped] = useState("");
  const { data } = usePatientSearch(chosen ? "" : typed);
  const labelId = useId();
  const errorId = useId();
  const found = typed.trim() ? (data?.items.slice(0, PICKER_RESULTS) ?? []) : [];

  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={error ? errorId : undefined}>
      <p id={labelId} className="mb-1.5 text-small font-bold text-ink">
        {appointments.patientLabel}
        <span className="text-muted" aria-hidden="true">
          {" *"}
        </span>
      </p>
      {chosen ? (
        <RowList label={appointments.patientLabel} look="menu">
          <Row
            look="menu"
            title={chosen.name}
            subtitle={describePatient(chosen)}
            trailing={
              <Button
                variant="quiet"
                size="sm"
                label={appointments.change}
                aria-label={appointments.changeNamed(chosen.name)}
                onClick={onClear}
              />
            }
          />
        </RowList>
      ) : (
        <div className="grid gap-2.5">
          <SearchField value={typed} onChange={setTyped} placeholder={appointments.searchPatients} />
          {found.length > 0 && (
            <RowList label={appointments.patientLabel} look="menu">
              {found.map((patient) => (
                <Row
                  key={patient.id}
                  look="menu"
                  title={patient.name}
                  subtitle={describePatient(patient)}
                  onClick={() => {
                    setTyped("");
                    onChoose(patient);
                  }}
                />
              ))}
            </RowList>
          )}
          {data && typed.trim() && found.length === 0 && (
            <p role="status" className="text-small text-muted">
              {appointments.noMatches}
            </p>
          )}
          {onNew && (
            <div>
              <Button
                variant="quiet"
                size="sm"
                icon={UserPlus}
                label={appointments.newPatient}
                onClick={() => onNew(prefillFrom(typed.trim()))}
              />
            </div>
          )}
        </div>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}
