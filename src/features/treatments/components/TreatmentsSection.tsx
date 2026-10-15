"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { SectionHeading } from "@/components/ui/section-heading";
import { UI_TEXT } from "@/constants/messages";
import type { Visit } from "@/features/visits/types";

import { useOpenedTreatment } from "../hooks/useOpenedTreatment";
import { NewTreatmentSheet } from "./TreatmentForms";
import { TreatmentPanel } from "./TreatmentPanel";
import { TreatmentRows } from "./TreatmentRows";

const { treatments: words } = UI_TEXT;

/**
 * A visit's Treatments (plan §12.2 item 4; D256 – D258, D263): the patient's
 * open treatments, and those started or worked on in this visit — each row
 * saying what this visit did for it, and opening its sheet, where the note
 * for this visit is written and the last sitting completes it. **Add
 * treatment** starts one, begun today unless planned, for `visits.edit`.
 */
export function TreatmentsSection({ visit, writes, className }: { visit: Visit; writes: boolean; className?: string }) {
  const headingId = useId();
  const opened = useOpenedTreatment(visit.treatments);
  const [adding, setAdding] = useState({ open: false, count: 0 });

  return (
    <section aria-labelledby={headingId} className={cn("min-w-0", className)}>
      <SectionHeading id={headingId} title={words.title}>
        {writes && (
          <Button
            label={words.add}
            aria-label={words.addFor(visit.patient.name)}
            icon={Plus}
            variant="secondary"
            size="sm"
            onClick={() => setAdding(({ count }) => ({ open: true, count: count + 1 }))}
          />
        )}
      </SectionHeading>
      {visit.treatments.length === 0 ? (
        <div className="grid gap-1 rounded-row bg-surface px-5 py-4">
          <p className="text-muted">{words.none}</p>
          <p className="text-small text-muted">{words.noneHint}</p>
        </div>
      ) : (
        <TreatmentRows label={words.title} treatments={visit.treatments} visitId={visit.id} onOpen={opened.show} />
      )}
      {writes && (
        <NewTreatmentSheet
          key={adding.count}
          patientId={visit.patient.id}
          visitId={visit.id}
          firstDoctor=""
          open={adding.open}
          onClose={() => setAdding((now) => ({ ...now, open: false }))}
        />
      )}
      <TreatmentPanel
        treatment={opened.treatment}
        visit={{ id: visit.id, open: visit.status === "OPEN" }}
        writes={writes}
        open={opened.open}
        onClose={opened.close}
      />
    </section>
  );
}
