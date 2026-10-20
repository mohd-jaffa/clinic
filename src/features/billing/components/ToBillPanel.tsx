"use client";

import { HandHeart, ReceiptIndianRupee } from "lucide-react";
import { useState } from "react";

import { Button, LinkButton } from "@/components/ui/button";
import { DetailList, type Detail } from "@/components/ui/detail-list";
import { Sheet } from "@/components/ui/sheet";
import { UI_TEXT } from "@/constants/messages";
import { newBillRoute, type BillFrom } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReadOnly } from "@/features/subscription/hooks/useReadOnly";
import { formatDate } from "@/lib/format/date";

import { toBillWorked } from "../describe";
import type { ToBillVisit } from "../types";
import { FeePaidTag } from "./FeePaidTag";
import { NoChargeSheet } from "./NoChargeSheet";

const { billing: words, appointment } = UI_TEXT;

/** What a visit waiting in To bill holds: its doctor, day, token and what was done. */
function detailsOf(visit: ToBillVisit): Detail[] {
  const lines: [string, string | null][] = [
    [appointment.doctorLabel, visit.doctor ? (visit.doctor.name ?? appointment.formerDoctor) : words.noDoctor],
    [UI_TEXT.visit.dayLabel, formatDate(visit.day)],
    [appointment.tokenLabel, visit.token === null ? null : words.token(visit.token)],
    [words.workedLabel, toBillWorked(visit) || null],
  ];
  return lines.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

/**
 * A visit waiting in To bill, opened (plan §15.6; D319): its doctor, day,
 * token and what was done, then **Bill** — the new bill, filled from it,
 * leading back where it was opened — and **No charge**, whose reason opens
 * over it; closing that comes back here. For whoever may bill, while the
 * clinic can write; an archived patient's says to restore them first. The
 * screen keys it by the visit, so each opens afresh.
 */
export function ToBillPanel({
  visit,
  open,
  onClose,
  from,
}: {
  visit: ToBillVisit | null;
  open: boolean;
  onClose: () => void;
  /** Where the new bill leads back to. */
  from: BillFrom;
}) {
  const { membership } = useAuth();
  const { readOnly } = useReadOnly();
  const [charging, setCharging] = useState(false);
  if (visit === null) return null;
  const mayBill = membership !== null && hasAccess(membership, "payments.create") && !readOnly;
  const bills = mayBill && !visit.patient.archived;
  const done = () => {
    setCharging(false);
    onClose();
  };
  const named = { id: visit.visitId, patient: visit.patient };

  return (
    <>
      <Sheet
        open={open && !charging}
        onClose={done}
        title={words.visitOf(visit.patient.name)}
        footer={
          bills && (
            <div className="flex flex-wrap gap-2">
              <LinkButton
                href={newBillRoute({ visit: visit.visitId }, from)}
                label={words.bill}
                accessibleName={words.billNowOf(visit.patient.name)}
                icon={ReceiptIndianRupee}
                size="sm"
              />
              <Button
                label={words.noCharge}
                aria-label={words.noChargeOf(visit.patient.name)}
                icon={HandHeart}
                variant="secondary"
                size="sm"
                onClick={() => setCharging(true)}
              />
            </div>
          )
        }
      >
        <div className="grid gap-4">
          {visit.feePaid && (
            <div>
              <FeePaidTag />
            </div>
          )}
          {mayBill && visit.patient.archived && <p className="text-small text-muted">{words.archivedNoBill}</p>}
          <DetailList details={detailsOf(visit)} />
        </div>
      </Sheet>
      {bills && (
        <NoChargeSheet visit={named} open={open && charging} onClose={() => setCharging(false)} onDone={done} />
      )}
    </>
  );
}
