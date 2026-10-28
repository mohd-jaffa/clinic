"use client";

import { Bug } from "lucide-react";
import { useState } from "react";

import { CoastHeader } from "@/components/ui/coast-header";
import { DetailList, type Detail } from "@/components/ui/detail-list";
import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { PageHeader } from "@/components/ui/page-header";
import { Row, RowList } from "@/components/ui/row";
import { Sheet } from "@/components/ui/sheet";
import { UI_TEXT } from "@/constants/messages";
import { formatDateTime } from "@/lib/format/date";

import { useConsoleErrors } from "../hooks/useConsoleErrors";
import type { ConsoleError } from "../types";

const { console: words } = UI_TEXT;
const { errorFields: fields } = words;

/** What failed where, in a line: its code, its status, the request. */
const whereOf = (failure: ConsoleError) =>
  [
    failure.code ?? failure.kind ?? failure.source,
    failure.httpStatus,
    [failure.method, failure.path].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * The console's Error log — `/admin/logs` (plan §20.6, §36; D372): the
 * server's own failures, the latest first, kept for `error_log_keep_days`.
 * Each row is what failed, where and when, and opens the whole entry. They
 * carry codes, paths and ids — never a patient's data.
 */
export function ConsoleErrors() {
  const query = useConsoleErrors();
  const [opened, setOpened] = useState<ConsoleError | null>(null);

  return (
    <>
      <CoastHeader>
        <div className="pb-6">
          <PageHeader title={words.places.logs} />
        </div>
      </CoastHeader>
      <div className="px-4 pt-4 md:px-8">
        <div className="grid max-w-3xl grid-cols-1 gap-6">
          <ListScreen
            query={query}
            loadFailed="CONSOLE_ERRORS_LOAD_FAILED"
            data={query.data}
            empty={<EmptyState icon={Bug} title={words.noErrors} />}
            renderList={(failures) => (
              <RowList label={words.places.logs}>
                {failures.map((failure) => (
                  <Row
                    key={failure.id}
                    onClick={() => setOpened(failure)}
                    title={failure.message}
                    subtitle={whereOf(failure)}
                    note={formatDateTime(failure.at)}
                  />
                ))}
              </RowList>
            )}
          />
        </div>
      </div>
      {opened && <ErrorSheet failure={opened} onClose={() => setOpened(null)} />}
    </>
  );
}

/** Text kept as it was written — a stack, the context — in the body's face, wrapping rather than widening the sheet. */
function Verbatim({ text }: { text: string }) {
  return <pre className="font-sans text-small break-words whitespace-pre-wrap text-ink">{text}</pre>;
}

/** The whole entry (D372): every field it holds, the context and the stack as they were written. */
function ErrorSheet({ failure, onClose }: { failure: ConsoleError; onClose: () => void }) {
  const details: Detail[] = [
    { label: fields.when, value: formatDateTime(failure.at) },
    { label: fields.source, value: failure.source },
    { label: fields.message, value: failure.message },
    ...(failure.code ? [{ label: fields.code, value: failure.code }] : []),
    ...(failure.kind ? [{ label: fields.kind, value: failure.kind }] : []),
    ...(failure.httpStatus ? [{ label: fields.status, value: String(failure.httpStatus) }] : []),
    ...(failure.path
      ? [{ label: fields.request, value: [failure.method, failure.path].filter(Boolean).join(" ") }]
      : []),
    ...(failure.reference ? [{ label: fields.reference, value: failure.reference }] : []),
    ...(failure.account
      ? [{ label: fields.account, value: `${failure.account.name} · ${failure.account.email}` }]
      : []),
    ...(failure.clinicName ? [{ label: fields.clinic, value: failure.clinicName }] : []),
    ...(failure.detail ? [{ label: fields.detail, value: <Verbatim text={failure.detail} /> }] : []),
    ...(failure.context
      ? [{ label: fields.context, value: <Verbatim text={JSON.stringify(failure.context, null, 2)} /> }]
      : []),
    ...(failure.stack ? [{ label: fields.stack, value: <Verbatim text={failure.stack} /> }] : []),
  ];
  return (
    <Sheet open onClose={onClose} title={words.errorTitle}>
      <DetailList details={details} />
    </Sheet>
  );
}
