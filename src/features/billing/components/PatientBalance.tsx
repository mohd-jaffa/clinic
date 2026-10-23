"use client";

import { IndianRupee, Undo2 } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { LoadFailed } from "@/components/ui/list-screen";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonRows } from "@/components/ui/skeleton";
import { UI_TEXT } from "@/constants/messages";
import { hasAccess } from "@/constants/permissions";
import type { Gender, PaymentKind } from "@/constants/statuses";
import { useAuth } from "@/features/auth/AuthProvider";
import { usePatientSummary } from "@/features/patients/hooks/usePatientSummary";
import { ReadOnlyNote } from "@/features/subscription/components/ReadOnlyNote";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";

import { balanceWords } from "../form";
import { RecordPaymentSheet } from "./RecordPaymentSheet";

const { patients, billing, payment: words } = UI_TEXT;

/**
 * A patient's balance on their profile (plan §10.3 item 4; D295, D311,
 * D322): due, in coral, or an advance — or nothing due — for whoever reads
 * bills. **Record payment** for `payments.create`, filled with what they
 * owe (D324); **Refund** for `payments.edit`, only while they hold an
 * advance, filled with it (D297, D322). Neither for an archived patient —
 * restored first (D300) — nor in a view-only clinic, which says why. Each
 * sheet opens afresh with the balance as it stands.
 */
export function PatientBalance({
  patient,
}: {
  patient: { id: string; name: string; number: number; dateOfBirth: string; gender: Gender; archivedAt: string | null };
}) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const summary = usePatientSummary(patient.id);
  const [paying, setPaying] = useState<{ open: boolean; kind: PaymentKind; count: number }>({
    open: false,
    kind: "PAYMENT",
    count: 0,
  });
  const headingId = useId();
  const may = (permission: Parameters<typeof hasAccess>[1]) => membership !== null && hasAccess(membership, permission);
  const balance = summary.data?.balancePaise ?? 0;
  const writable = !readOnly && patient.archivedAt === null;
  const pays = writable && may("payments.create");
  const refunds = writable && may("payments.edit") && balance < 0;
  const open = (kind: PaymentKind) => setPaying(({ count }) => ({ open: true, kind, count: count + 1 }));

  let body;
  if (summary.data === undefined) {
    body =
      summary.error != null ? (
        <LoadFailed query={summary} loadFailed="BALANCE_LOAD_FAILED" />
      ) : (
        <section aria-busy="true" aria-label={UI_TEXT.states.loading}>
          <SkeletonRows rows={1} />
        </section>
      );
  } else {
    body = (
      <div className="grid justify-items-start gap-3 rounded-row bg-surface px-5 py-4">
        <p
          className={cn(
            "text-title tabular-nums",
            balance > 0 ? "font-bold text-coral" : balance < 0 ? "font-bold text-ink" : "text-muted",
          )}
        >
          {balanceWords(balance)}
        </p>
        {(pays || refunds) && (
          <div className="flex flex-wrap gap-2">
            {pays && (
              <Button
                label={billing.recordPayment}
                aria-label={billing.recordPaymentFrom(patient.name)}
                icon={IndianRupee}
                size="sm"
                onClick={() => open("PAYMENT")}
              />
            )}
            {refunds && (
              <Button
                label={words.refund}
                aria-label={words.refundTo(patient.name)}
                icon={Undo2}
                variant="secondary"
                size="sm"
                onClick={() => open("REFUND")}
              />
            )}
          </div>
        )}
        {(may("payments.create") || may("payments.edit")) && <ReadOnlyNote />}
      </div>
    );
  }

  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} title={patients.balance} />
      {body}
      {paying.count > 0 && (
        <RecordPaymentSheet
          key={paying.count}
          open={paying.open}
          onClose={() => setPaying((now) => ({ ...now, open: false }))}
          kind={paying.kind}
          patient={{ ...patient, balancePaise: balance }}
        />
      )}
    </section>
  );
}
