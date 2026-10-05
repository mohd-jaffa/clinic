"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { IMPORT_FIELDS, IMPORT_REQUIRED, type ImportField } from "@/constants/import";
import { UI_TEXT } from "@/constants/messages";

import { columnLetter, missingColumns, type ColumnMap } from "../import-columns";
import type { ImportSheet } from "../import-file";
import { cellText } from "../import-rows";
import { ImportStep } from "./ImportStep";

const { patientImport } = UI_TEXT;

/**
 * An import's second step (plan §10.5): each patient field and the file's
 * column that fills it, guessed from the headers and changed here, with the
 * first row's value under it to check against. A name, a mobile, a gender
 * and a date of birth or an age are needed before the rows are checked.
 */
export function ImportColumnsStep({
  sheet,
  map,
  onChange,
  onBack,
  onNext,
}: {
  sheet: ImportSheet;
  map: ColumnMap;
  onChange: (map: ColumnMap) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [tried, setTried] = useState(false);
  const missing = missingColumns(map);
  const options = sheet.headers.map((header, index) => ({
    value: String(index),
    label: patientImport.column(columnLetter(index), header),
  }));
  const first = sheet.rows[0].cells;

  const errorOf = (field: ImportField) => {
    if (!tried) return undefined;
    if (missing.fields.includes(field)) return patientImport.columnMissing(patientImport.fields[field]);
    if (field === "dateOfBirth" && missing.born) return patientImport.bornMissing;
    return undefined;
  };
  const sampleOf = (column: number | null) => {
    const value = column === null ? "" : cellText(first[column]);
    return value === "" ? undefined : patientImport.sample(value);
  };

  return (
    <ImportStep
      title={patientImport.columnsTitle}
      hint={patientImport.columnsHint}
      actions={
        <>
          <Button label={patientImport.back} icon={ArrowLeft} variant="secondary" onClick={onBack} />
          <Button
            label={patientImport.next}
            icon={ArrowRight}
            onClick={() => {
              setTried(true);
              if (missing.fields.length === 0 && !missing.born) onNext();
            }}
          />
        </>
      }
    >
      <p className="text-small text-muted">{patientImport.bornHint}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        {IMPORT_FIELDS.map((field) => (
          <SelectField
            key={field}
            label={patientImport.fields[field]}
            required={IMPORT_REQUIRED.includes(field)}
            placeholder={patientImport.notInFile}
            options={options}
            value={map[field] === null ? "" : String(map[field])}
            onChange={(value) => onChange({ ...map, [field]: value === "" ? null : Number(value) })}
            hint={sampleOf(map[field])}
            error={errorOf(field)}
          />
        ))}
      </div>
    </ImportStep>
  );
}
