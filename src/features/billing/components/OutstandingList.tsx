"use client";

import { IndianRupee, MessageCircle, Phone, Smile } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button, IconLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListScreen } from "@/components/ui/list-screen";
import { Row, RowList } from "@/components/ui/row";
import { UI_TEXT, WHATSAPP_TEXT } from "@/constants/messages";
import { patientRoute } from "@/constants/navigation";
import { BILLING_TAB_LABELS } from "@/constants/statuses";
import { formatPaise } from "@/lib/format/currency";
import { callHref, formatPhoneDigits, whatsAppHref } from "@/lib/phone";

import { useOutstanding } from "../hooks/useOutstanding";
import type { OutstandingPatient } from "../types";
import { OwingPill } from "./OwingPill";

const { billing: words, patients } = UI_TEXT;

/**
 * Billing's Outstanding (plan §15.4; D321): the patients who owe, most
 * first, a page at a time — archived ones too, whose balance still counts
 * (D300). Each row opens the profile and carries **Call**, **WhatsApp** —
 * the dues reminder, from the clinic, for a person to send — and **Record
 * payment** for whoever may record one, filled with what they owe (D324).
 */
export function OutstandingList({
  clinic,
  canRecord,
  onRecord,
}: {
  /** Who the reminder is from: the clinic's name, and its phone when it has one. */
  clinic: { name: string; phone: string | null };
  canRecord: boolean;
  onRecord: (owing: OutstandingPatient) => void;
}) {
  const query = useOutstanding();
  return (
    <ListScreen
      query={query}
      loadFailed="OUTSTANDING_LOAD_FAILED"
      data={query.data}
      empty={<EmptyState icon={Smile} title={words.outstandingEmpty} hint={words.outstandingEmptyHint} />}
      renderList={(owing) => (
        <RowList label={BILLING_TAB_LABELS.OUTSTANDING}>
          {owing.map((each) => (
            <OwingRow
              key={each.patient.id}
              owing={each}
              clinic={clinic}
              canRecord={canRecord && !each.patient.archived}
              onRecord={onRecord}
            />
          ))}
        </RowList>
      )}
    />
  );
}

function OwingRow({
  owing,
  clinic,
  canRecord,
  onRecord,
}: {
  owing: OutstandingPatient;
  clinic: { name: string; phone: string | null };
  canRecord: boolean;
  onRecord: (owing: OutstandingPatient) => void;
}) {
  const { patient } = owing;
  const reminder = WHATSAPP_TEXT.duesReminder(
    patient.name.split(" ")[0],
    formatPaise(owing.balancePaise),
    clinic.name,
    clinic.phone,
  );
  return (
    <Row
      leading={<Avatar name={patient.name} />}
      title={patient.name}
      subtitle={[
        patients.number(patient.number),
        formatPhoneDigits(patient.phone),
        patient.archived && patients.archived,
      ]
        .filter(Boolean)
        .join(" · ")}
      detail={<OwingPill balancePaise={owing.balancePaise} />}
      href={patientRoute(patient.id)}
      trailing={
        <>
          <IconLink
            icon={Phone}
            label={patients.call(patient.name)}
            href={callHref(patient.phone)}
            newTab={false}
            tone="outline"
          />
          <IconLink
            icon={MessageCircle}
            label={words.remindDues(patient.name)}
            href={whatsAppHref(patient.phone, reminder)}
            tone="outline"
          />
          {canRecord && (
            <Button
              label={words.recordPayment}
              aria-label={words.recordPaymentFrom(patient.name)}
              icon={IndianRupee}
              variant="secondary"
              size="sm"
              onClick={() => onRecord(owing)}
            />
          )}
        </>
      }
    />
  );
}
