"use client";

import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { CHECK_ROW, CheckBox } from "@/components/ui/checkbox";
import { LoadFailed } from "@/components/ui/list-screen";
import { Row, RowList } from "@/components/ui/row";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { PAGE_SIZE } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { formatCount } from "@/lib/format/count";

import type { CheckedRow, DuplicateOf } from "../import-rows";
import type { useImportMatches } from "../hooks/useImportMatches";
import { ImportStep } from "./ImportStep";

const { patientImport } = UI_TEXT;

/** A long list shows a page at a time, with Show more. */
function useShown(length: number) {
  const [shown, setShown] = useState(PAGE_SIZE);
  return { shown, more: shown < length ? () => setShown((count) => count + PAGE_SIZE) : undefined };
}

const matchOf = (of: DuplicateOf) =>
  of.kind === "PATIENT"
    ? patientImport.sameAsPatient(UI_TEXT.patients.number(of.number), of.name)
    : patientImport.sameAsRow(of.line);

/**
 * An import's third step (plan §10.5, D129): every row checked as the add
 * sheet checks a patient, and the ready ones against the clinic's patients
 * and each other. It counts what is ready, what may be a duplicate and what
 * has a problem; lists the problems with their reasons, left out; and lists
 * the possible duplicates with what each matched, skipped unless ticked to
 * import anyway — a family can share one mobile.
 */
export function ImportCheckStep({
  rows,
  matches,
  included,
  onToggle,
  onBack,
  onNext,
}: {
  rows: readonly CheckedRow[];
  matches: ReturnType<typeof useImportMatches>;
  /** The duplicates ticked to import anyway, by line. */
  included: ReadonlySet<number>;
  onToggle: (line: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const problemsId = useId();
  const duplicatesId = useId();
  const { checked, retry } = matches;
  const problems = rows.filter((row) => row.input === null);
  const duplicates = checked?.status === "DONE" ? rows.filter((row) => checked.duplicates.has(row.line)) : [];
  const ready = rows.length - problems.length - duplicates.length;
  const sending = ready + duplicates.filter((row) => included.has(row.line)).length;
  const problemList = useShown(problems.length);
  const duplicateList = useShown(duplicates.length);

  const back = <Button label={patientImport.back} icon={ArrowLeft} variant="secondary" onClick={onBack} />;

  if (checked === null) {
    return (
      <ImportStep title={patientImport.checkTitle} hint={patientImport.checking} actions={back}>
        <section aria-busy="true" aria-label={patientImport.checking}>
          <SkeletonRows rows={3} />
        </section>
      </ImportStep>
    );
  }
  if (checked.status === "FAILED") {
    return (
      <ImportStep title={patientImport.checkTitle} actions={back}>
        <LoadFailed
          query={{ isLoading: false, error: checked.failure, mutate: retry }}
          loadFailed="IMPORT_CHECK_FAILED"
        />
      </ImportStep>
    );
  }

  return (
    <ImportStep
      title={patientImport.checkTitle}
      actions={
        <>
          {back}
          <Button label={patientImport.next} icon={ArrowRight} disabled={sending === 0} onClick={onNext} />
        </>
      }
    >
      <section aria-label={patientImport.countsLabel}>
        <StatGrid>
          <StatTile label={patientImport.readyLabel} value={formatCount(ready)} />
          <StatTile label={patientImport.duplicatesTitle} value={formatCount(duplicates.length)} />
          <StatTile label={patientImport.problemsTitle} value={formatCount(problems.length)} />
        </StatGrid>
      </section>
      {sending === 0 && <p className="font-bold text-ink">{patientImport.noneReady}</p>}

      {problems.length > 0 && (
        <section aria-labelledby={problemsId}>
          <h3 id={problemsId} className="font-bold text-ink">
            {patientImport.problemsTitle}
          </h3>
          <p className="mb-3 text-small text-muted">{patientImport.problemsHint}</p>
          <RowList look="menu" label={patientImport.problemsTitle}>
            {problems.slice(0, problemList.shown).map((row) => (
              <Row
                key={row.line}
                look="menu"
                title={patientImport.row(row.line, row.name)}
                subtitle={row.problems.join(" ")}
                wrap
              />
            ))}
          </RowList>
          <ShowMore more={problemList.more} />
        </section>
      )}

      {duplicates.length > 0 && (
        <section aria-labelledby={duplicatesId}>
          <h3 id={duplicatesId} className="font-bold text-ink">
            {patientImport.duplicatesTitle}
          </h3>
          <p className="mb-3 text-small text-muted">{patientImport.duplicatesHint}</p>
          <ul aria-label={patientImport.duplicatesTitle} className="grid gap-1">
            {duplicates.slice(0, duplicateList.shown).map((row) => (
              <li key={row.line}>
                <Duplicate
                  row={row}
                  of={checked.duplicates.get(row.line)!}
                  included={included.has(row.line)}
                  onToggle={() => onToggle(row.line)}
                />
              </li>
            ))}
          </ul>
          <ShowMore more={duplicateList.more} />
        </section>
      )}
    </ImportStep>
  );
}

/** A possible duplicate: the row, what it matched, and whether to import it anyway. */
function Duplicate({
  row,
  of,
  included,
  onToggle,
}: {
  row: CheckedRow;
  of: DuplicateOf;
  included: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  return (
    <label className={CHECK_ROW}>
      <CheckBox aria-labelledby={`${id}-row`} aria-describedby={`${id}-match`} checked={included} onChange={onToggle} />
      <span className="min-w-0">
        <span id={`${id}-row`} className="block font-bold text-ink">
          {patientImport.row(row.line, row.name)}
        </span>
        <span id={`${id}-match`} className="block text-small text-muted">
          {matchOf(of)}
        </span>
      </span>
    </label>
  );
}

function ShowMore({ more }: { more?: () => void }) {
  if (!more) return null;
  return (
    <div className="mt-3">
      <Button label={patientImport.showMore} icon={ChevronDown} variant="quiet" size="sm" onClick={more} />
    </div>
  );
}
