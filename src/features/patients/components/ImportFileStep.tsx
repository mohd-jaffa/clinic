"use client";

import { ArrowRight, FileUp } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { IMPORT_ACCEPT } from "@/constants/import";
import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";

import { ImportFileError, readImportFile, type ImportSheet } from "../import-file";
import { ImportStep } from "./ImportStep";

const { patientImport } = UI_TEXT;

/**
 * An import's first step (plan §10.5, D127): a CSV or Excel (.xlsx) file,
 * read on this device and never sent. It says what it found — the file and
 * its rows — or why it could not be read, and refuses one with more rows than
 * the platform allows (D128). Nothing is chosen in a view-only clinic.
 */
export function ImportFileStep({
  sheet,
  maxRows,
  readOnly,
  onRead,
  onNext,
}: {
  sheet: ImportSheet | null;
  maxRows: number;
  readOnly: boolean;
  onRead: (sheet: ImportSheet) => void;
  onNext: () => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const chosen = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setProblem(null);
    try {
      const read = await readImportFile(file);
      if (read.rows.length > maxRows) setProblem(patientImport.tooLong(read.rows.length, maxRows));
      else onRead(read);
    } catch (failure) {
      setProblem(ERROR_MESSAGES[failure instanceof ImportFileError ? failure.code : "IMPORT_FILE_UNREADABLE"]);
    } finally {
      setReading(false);
    }
  };

  return (
    <ImportStep
      title={patientImport.fileTitle}
      hint={patientImport.fileHint}
      actions={sheet && <Button label={patientImport.next} icon={ArrowRight} disabled={readOnly} onClick={onNext} />}
    >
      <div>
        {sheet && (
          <p className="mb-4 font-bold break-words text-ink">{patientImport.chosen(sheet.name, sheet.rows.length)}</p>
        )}
        <Button
          label={sheet ? patientImport.chooseAnother : patientImport.choose}
          icon={FileUp}
          variant={sheet ? "secondary" : "primary"}
          size={sheet ? "sm" : "md"}
          loading={reading}
          disabled={readOnly}
          onClick={() => picker.current?.click()}
        />
        <FieldError message={problem} />
        <ReadOnlyNote />
        <input
          ref={picker}
          type="file"
          accept={IMPORT_ACCEPT}
          hidden
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            void chosen(event.target.files?.[0]);
            // So the same file may be chosen again once it has been fixed.
            event.target.value = "";
          }}
        />
      </div>
      <p className="text-small text-muted">{patientImport.patientsOnly}</p>
    </ImportStep>
  );
}
