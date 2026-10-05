"use client";

import { useState } from "react";

import { CoastHeader } from "@/components/ui/coast-header";
import { LoadFailed } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Steps } from "@/components/ui/steps";
import { UI_TEXT } from "@/constants/messages";
import { SETTINGS_ROUTE } from "@/constants/navigation";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";

import { useImportLimits } from "../hooks/useImportLimits";
import { useImportMatches } from "../hooks/useImportMatches";
import { useImportSend } from "../hooks/useImportSend";
import { guessColumns, type ColumnMap } from "../import-columns";
import type { ImportSheet } from "../import-file";
import { checkRows, type CheckedRow } from "../import-rows";
import type { ImportLimits } from "../types";
import { ImportCheckStep } from "./ImportCheckStep";
import { ImportColumnsStep } from "./ImportColumnsStep";
import { ImportFileStep } from "./ImportFileStep";
import { ImportSendStep } from "./ImportSendStep";

const { patientImport } = UI_TEXT;
const STEPS = [
  patientImport.steps.FILE,
  patientImport.steps.COLUMNS,
  patientImport.steps.CHECK,
  patientImport.steps.SEND,
];

/**
 * Importing patients (plan §10.5, D51, D127 – D133), the owner's: four steps,
 * one at a time — the file, read on this device; its columns matched to the
 * patient's fields; its rows checked, with problems and possible duplicates;
 * and the import itself, a batch at a time, then what came of it. Nothing
 * leaves the device until the last step's Import.
 */
export function PatientImport() {
  const limits = useImportLimits();
  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={patientImport.title} subtitle={patientImport.subtitle} back={SETTINGS_ROUTE} />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 pb-8 md:px-8">
        {limits.data ? (
          <ImportFlow limits={limits.data} />
        ) : limits.error != null ? (
          <LoadFailed query={limits} loadFailed="IMPORT_LIMITS_LOAD_FAILED" />
        ) : (
          <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
            <SkeletonRows rows={3} />
          </section>
        )}
      </div>
    </>
  );
}

function ImportFlow({ limits }: { limits: ImportLimits }) {
  const { readOnly } = useReadOnly();
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState<ImportSheet | null>(null);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [rows, setRows] = useState<readonly CheckedRow[]>([]);
  const [included, setIncluded] = useState<ReadonlySet<number>>(new Set());
  const matches = useImportMatches(rows, limits.batchSize);
  const sender = useImportSend(limits.batchSize);

  const duplicates = matches.checked?.status === "DONE" ? matches.checked.duplicates : new Map();
  const toSend = rows.filter((row) => row.input !== null && (!duplicates.has(row.line) || included.has(row.line)));
  const problems = rows.filter((row) => row.input === null);

  const restart = () => {
    setStep(0);
    setSheet(null);
    setMap(null);
    setRows([]);
    setIncluded(new Set());
    sender.reset();
  };

  return (
    // One column that never grows past the screen, whatever a step holds.
    <div className="grid grid-cols-1 gap-8">
      <div className="max-w-2xl">
        <Steps
          label={patientImport.stepsLabel}
          steps={STEPS}
          current={sender.state.status === "DONE" ? STEPS.length : step}
        />
      </div>
      {step === 0 && (
        <ImportFileStep
          sheet={sheet}
          maxRows={limits.maxRows}
          readOnly={readOnly}
          onRead={(read) => {
            setSheet(read);
            setMap(guessColumns(read.headers));
          }}
          onNext={() => setStep(1)}
        />
      )}
      {step === 1 && sheet && map && (
        <ImportColumnsStep
          sheet={sheet}
          map={map}
          onChange={setMap}
          onBack={() => setStep(0)}
          onNext={() => {
            setRows(checkRows(sheet, map));
            setIncluded(new Set());
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <ImportCheckStep
          rows={rows}
          matches={matches}
          included={included}
          onToggle={(line) =>
            setIncluded((now) => {
              const next = new Set(now);
              if (!next.delete(line)) next.add(line);
              return next;
            })
          }
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && sheet && (
        <ImportSendStep
          sheet={sheet}
          toSend={toSend}
          skipped={duplicates.size - included.size}
          problems={problems}
          sender={sender}
          readOnly={readOnly}
          onBack={() => setStep(2)}
          onRestart={restart}
        />
      )}
    </div>
  );
}
