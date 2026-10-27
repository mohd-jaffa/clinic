"use client";

import { Download, Printer } from "lucide-react";
import { useId } from "react";

import { Button, LinkButton } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { UI_TEXT } from "@/constants/messages";
import { PAYMENT_METHOD_LABELS } from "@/constants/statuses";
import { useCollectionsDownload } from "@/features/documents/hooks/useCollectionsDownload";
import { formatPaise } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { apiRoutes, withQuery } from "@/lib/query/keys";

import { dayEndOf, personLines, signedPaise, voidedLine } from "../collections";
import type { DailyReport } from "../types";

const { reports: words } = UI_TEXT;

/**
 * The day-end collection summary (plan §18; D49, D357 – D360), under the
 * Daily report's figures: a card for each person who took money — what they
 * took and handed back by each method, and in bold the cash they hand over
 * (D357); then each method's received, refunded and net; the day's net
 * collected, and what was voided. **Print** opens it as a PDF on the
 * clinic's letterhead and paper, with lines to sign it over (D359, D360);
 * **Download** saves it. It locks nothing.
 */
export function DayEndSummary({ report }: { report: DailyReport }) {
  const id = useId();
  const dayEnd = dayEndOf(report);
  const voided = voidedLine(dayEnd.voided);
  const day = formatDate(report.day);
  const { download, downloading } = useCollectionsDownload(report.day);
  const { methodColumns: columns } = words;

  return (
    <section aria-labelledby={id} className="grid gap-4">
      <SectionHeading id={id} title={words.dayEnd}>
        <LinkButton
          href={withQuery(apiRoutes.reports.collectionsPdf, { day: report.day })}
          file
          newTab
          label={words.print}
          accessibleName={words.printOf(day)}
          icon={Printer}
          variant="secondary"
          size="sm"
        />
        <Button
          label={words.download}
          aria-label={words.downloadOf(day)}
          icon={Download}
          variant="secondary"
          size="sm"
          loading={downloading}
          onClick={() => void download()}
        />
      </SectionHeading>
      {dayEnd.people.length === 0 ? (
        <p className="text-small text-muted">{words.dayEndEmpty}</p>
      ) : (
        <>
          <ul aria-label={words.byPerson} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {dayEnd.people.map((person) => {
              const name = person.name ?? words.formerMember;
              return (
                <li key={person.receivedBy ?? name} className="grid gap-2 rounded-row bg-surface p-4">
                  <p className="font-bold text-ink">{name}</p>
                  <dl className="grid gap-1 text-small">
                    {personLines(person).map((line) => (
                      <div key={line.label} className="flex justify-between gap-3">
                        <dt className="text-muted">{line.label}</dt>
                        <dd className="text-ink tabular-nums">{line.value}</dd>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-between gap-3 border-t border-line pt-2 font-bold text-ink">
                      <dt>{words.handOver}</dt>
                      <dd className="tabular-nums">{signedPaise(person.cashPaise)}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
          <div className="overflow-x-auto">
            <table className="w-full max-w-2xl text-small tabular-nums">
              <caption className="pb-2 text-left text-title font-bold text-ink">{words.byMethod}</caption>
              <thead>
                <tr className="border-b border-line text-muted">
                  <th scope="col" className="py-2 text-left font-bold">
                    {columns.method}
                  </th>
                  <th scope="col" className="py-2 text-right font-bold">
                    {columns.received}
                  </th>
                  <th scope="col" className="py-2 text-right font-bold">
                    {columns.refunded}
                  </th>
                  <th scope="col" className="py-2 text-right font-bold">
                    {columns.net}
                  </th>
                </tr>
              </thead>
              <tbody>
                {dayEnd.methods.map((method) => (
                  <tr key={method.method} className="border-b border-line text-ink">
                    <th scope="row" className="py-2 text-left font-normal">
                      {PAYMENT_METHOD_LABELS[method.method]}
                    </th>
                    <td className="py-2 text-right">{formatPaise(method.receivedPaise)}</td>
                    <td className="py-2 text-right">{formatPaise(method.refundedPaise)}</td>
                    <td className="py-2 text-right">{signedPaise(method.netPaise)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold text-ink">
                  <th scope="row" colSpan={3} className="py-2 text-left">
                    {words.netCollected}
                  </th>
                  <td className="py-2 text-right">{signedPaise(dayEnd.netPaise)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {voided && <p className="text-small text-muted">{voided}</p>}
        </>
      )}
    </section>
  );
}
