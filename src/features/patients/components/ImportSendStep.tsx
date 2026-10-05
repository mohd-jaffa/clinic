"use client";

import { ArrowLeft, Download, RotateCcw, Upload, UsersRound } from "lucide-react";

import { Button, LinkButton } from "@/components/ui/button";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { UI_TEXT } from "@/constants/messages";
import { PATIENTS_ROUTE } from "@/constants/navigation";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { saveCsv } from "@/lib/download";
import { formatCount } from "@/lib/format/count";

import type { useImportSend } from "../hooks/useImportSend";
import type { ImportSheet } from "../import-file";
import { refusedCsv } from "../import-refused";
import type { CheckedRow } from "../import-rows";
import { ImportStep } from "./ImportStep";

const { patientImport } = UI_TEXT;

/**
 * An import's last step (plan §10.5, D131, D133): what will be added and
 * what left out, then **Import**. It sends a batch at a time, showing how
 * far it has got; a stop carries on from where it stopped, adding no one
 * twice. Once done it counts what was imported, skipped and not imported,
 * hands the rows not imported back as a CSV to fix, and leads to the
 * patients.
 */
export function ImportSendStep({
  sheet,
  toSend,
  skipped,
  problems,
  sender,
  readOnly,
  onBack,
  onRestart,
}: {
  sheet: ImportSheet;
  toSend: readonly CheckedRow[];
  skipped: number;
  problems: readonly CheckedRow[];
  sender: ReturnType<typeof useImportSend>;
  readOnly: boolean;
  onBack: () => void;
  onRestart: () => void;
}) {
  const { state } = sender;

  if (state.status === "DONE") {
    const notImported = [
      ...problems.map((row) => ({ line: row.line, cells: row.cells, problem: row.problems.join(" ") })),
      ...state.refused.map(({ row, problem }) => ({ line: row.line, cells: row.cells, problem })),
    ].sort((a, b) => a.line - b.line);
    return (
      <ImportStep
        title={patientImport.doneTitle}
        actions={
          <>
            <LinkButton href={PATIENTS_ROUTE} label={patientImport.openPatients} icon={UsersRound} />
            {notImported.length > 0 && (
              <Button
                label={patientImport.downloadRefused}
                icon={Download}
                variant="secondary"
                onClick={() => saveCsv(patientImport.refusedFile, refusedCsv(sheet, notImported))}
              />
            )}
            <Button label={patientImport.importAnother} icon={RotateCcw} variant="quiet" onClick={onRestart} />
          </>
        }
      >
        <StatGrid>
          <StatTile label={patientImport.importedLabel} value={formatCount(state.imported)} />
          <StatTile label={patientImport.skippedLabel} value={formatCount(skipped)} />
          <StatTile label={patientImport.refusedLabel} value={formatCount(notImported.length)} />
        </StatGrid>
      </ImportStep>
    );
  }

  if (state.status === "SENDING" || state.status === "STOPPED") {
    const stopped = state.status === "STOPPED";
    return (
      <ImportStep
        title={patientImport.sendTitle}
        actions={
          stopped && <Button label={UI_TEXT.actions.retry} icon={RotateCcw} onClick={() => void sender.retry()} />
        }
      >
        <div
          role="progressbar"
          aria-label={patientImport.progressLabel}
          aria-valuemin={0}
          aria-valuemax={state.total}
          aria-valuenow={state.done}
          className="h-2 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-action" style={{ width: `${(state.done / state.total) * 100}%` }} />
        </div>
        <p role="status" className="font-bold text-ink">
          {stopped ? patientImport.stopped(state.done, state.total) : patientImport.sending(state.done, state.total)}
        </p>
        {!stopped && <p className="text-small text-muted">{patientImport.keepOpen}</p>}
      </ImportStep>
    );
  }

  return (
    <ImportStep
      title={patientImport.sendTitle}
      actions={
        <>
          <Button label={patientImport.back} icon={ArrowLeft} variant="secondary" onClick={onBack} />
          <Button
            label={patientImport.send(toSend.length)}
            icon={Upload}
            disabled={readOnly}
            onClick={() => void sender.send(toSend)}
          />
        </>
      }
    >
      <div>
        <p className="font-bold text-ink">{patientImport.willAdd(toSend.length)}</p>
        <p className="mt-1 text-muted">{patientImport.willLeave(skipped, problems.length)}</p>
        <ReadOnlyNote />
      </div>
    </ImportStep>
  );
}
