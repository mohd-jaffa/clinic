"use client";

import { useId } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Row, RowList } from "@/components/ui/row";
import { StatusPill } from "@/components/ui/status-pill";
import { UI_TEXT } from "@/constants/messages";
import { patientRoute } from "@/constants/navigation";

import { describePatient } from "../describe";
import { usePatientMatches } from "../hooks/usePatientMatches";
import type { PatientMatch } from "../types";

const { patients } = UI_TEXT;

/**
 * "Already here?" (plan §10.1, D106): once a whole mobile is typed, the
 * patients already on it, each to open instead of adding them again —
 * archived ones marked. Nothing is refused: a family shares one number, and
 * the sheet carries on to add a brother or sister. With `onChoose` — a new
 * patient being added while booking (D145) — a row chooses that patient
 * instead of opening them, and an archived one, who cannot be booked
 * (D103), chooses nothing.
 */
export function PatientMatches({ typed, onChoose }: { typed: string; onChoose?: (match: PatientMatch) => void }) {
  const { data } = usePatientMatches(typed);
  const titleId = useId();
  if (!data?.length) return null;
  return (
    <section aria-labelledby={titleId} className="mt-3 grid gap-2.5 rounded-row bg-ground p-3">
      <div>
        <h3 id={titleId} className="text-small font-bold text-ink">
          {patients.matchesTitle(data.length)}
        </h3>
        <p className="mt-0.5 text-small text-muted">{onChoose ? patients.matchesChooseHint : patients.matchesHint}</p>
      </div>
      <RowList label={patients.matchesTitle(data.length)}>
        {data.map((match) => (
          <Row
            key={match.id}
            leading={<Avatar name={match.name} />}
            title={match.name}
            subtitle={describePatient(match)}
            href={onChoose ? undefined : patientRoute(match.id)}
            onClick={onChoose && !match.archived ? () => onChoose(match) : undefined}
            trailing={match.archived && <StatusPill label={patients.archived} />}
          />
        ))}
      </RowList>
    </section>
  );
}
