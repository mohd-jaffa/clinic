"use client";

import { ReceiptIndianRupee } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/ui/row";
import { UI_TEXT } from "@/constants/messages";

import { toBillAbout, toBillWorked } from "../describe";
import type { ToBillVisit } from "../types";
import { FeePaidTag } from "./FeePaidTag";

const { billing: words } = UI_TEXT;

/**
 * A visit waiting in To bill (plan §15.6; D318): the patient, the doctor —
 * on every doctor's list — the token and the day when not today, and what
 * was done, with **Fee paid** for a consultation paid at arrival. The row,
 * and its one **Bill** for whoever may bill (D319), open its sheet: Bill or
 * No charge.
 */
export function ToBillRow({
  visit,
  showDoctor,
  canBill,
  onOpen,
}: {
  visit: ToBillVisit;
  showDoctor: boolean;
  canBill: boolean;
  onOpen: (visit: ToBillVisit) => void;
}) {
  return (
    <Row
      leading={<Avatar name={visit.patient.name} />}
      title={visit.patient.name}
      subtitle={toBillAbout(visit, showDoctor)}
      note={toBillWorked(visit)}
      detail={visit.feePaid && <FeePaidTag />}
      trailing={
        canBill &&
        !visit.patient.archived && (
          <Button
            label={words.bill}
            aria-label={words.checkOut(visit.patient.name)}
            icon={ReceiptIndianRupee}
            size="sm"
            onClick={() => onOpen(visit)}
          />
        )
      }
      onClick={() => onOpen(visit)}
    />
  );
}
