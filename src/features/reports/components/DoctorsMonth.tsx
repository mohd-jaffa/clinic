"use client";

import { useId } from "react";

import { Row, RowList } from "@/components/ui/row";
import { SectionHeading } from "@/components/ui/section-heading";
import { UI_TEXT } from "@/constants/messages";
import { OwingPill } from "@/features/billing/components/OwingPill";
import { formatPaise } from "@/lib/format/currency";

import type { DoctorMonth } from "../types";

const { reports: words, billing } = UI_TEXT;

/**
 * Monthly's **By doctor** (plan §18; D53, D361, D362): a row for each doctor
 * with a visit or a bill in the month — "12 patients · 18 visits", then
 * "₹20,000 billed · ₹18,000 paid" — paid being what is paid to date on the
 * bills issued with them, and what is still due on them in coral when any
 * is. The bills that name no doctor are a row of their own, last. Payments
 * go against the patient, so nothing is "collected" by a doctor.
 */
export function DoctorsMonth({ doctors }: { doctors: DoctorMonth[] }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="max-w-3xl">
      <SectionHeading id={id} title={words.byDoctor} />
      {doctors.length === 0 ? (
        <p className="text-small text-muted">{words.byDoctorEmpty}</p>
      ) : (
        <RowList label={words.byDoctor}>
          {doctors.map((doctor) => (
            <Row
              key={doctor.doctorId ?? billing.noDoctor}
              title={doctor.doctorId === null ? billing.noDoctor : (doctor.doctorName ?? words.formerMember)}
              // A bill with no doctor has no visit: its row says only what was billed and paid.
              subtitle={
                doctor.doctorId === null
                  ? undefined
                  : `${words.patientsCount(doctor.patientsSeen)} · ${words.visitsCount(doctor.visits)}`
              }
              note={words.billedPaid(formatPaise(doctor.billedPaise), formatPaise(doctor.paidPaise))}
              detail={<OwingPill balancePaise={doctor.billedPaise - doctor.paidPaise} />}
            />
          ))}
        </RowList>
      )}
    </section>
  );
}
