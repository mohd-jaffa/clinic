"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeAlert, BookmarkPlus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { useFieldArray, type Resolver } from "react-hook-form";

import { LinkButton, Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Panel } from "@/components/ui/panel";
import { useResponse } from "@/components/ui/response-card";
import { TextAreaField } from "@/components/ui/text-field";
import { PRESCRIPTION_MAX_ITEMS, TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { TEAM_ROUTE } from "@/constants/navigation";
import { hasAccess } from "@/constants/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { AlertChips } from "@/features/patients/components/AlertChips";
import { PrescriptionPdf } from "@/features/documents/components/PrescriptionPdf";
import { ChangedMeanwhile } from "@/features/visits/components/ChangedMeanwhile";
import { useVisitSection } from "@/features/visits/hooks/useVisitSection";
import type { Visit } from "@/features/visits/types";
import { ApiError } from "@/lib/api/client";
import { apiRoutes } from "@/lib/query/keys";
import { useApiMutation } from "@/lib/query/useApiMutation";
import { useRevalidate } from "@/lib/query/useRevalidate";
import { prescriptionSchema, type PrescriptionInput } from "@/lib/validation";

import { allergiesIn } from "../allergies";
import { PrescriptionsClient } from "../api.client";
import { withAdvice } from "../content";
import type { Prescription, PrescriptionContent } from "../types";
import { EMPTY_LINE, lineInput, MedicineLine } from "./MedicineLine";
import { PrescriptionAids, type Addition } from "./PrescriptionAids";
import { PrescriptionReadout } from "./PrescriptionReadout";
import { SaveTemplateSheet } from "./SaveTemplateSheet";

const { prescription: words, visit: visitWords } = UI_TEXT;

/** What the prescription says, as its section compares copies: none until one is saved. */
const contentOf = (prescription: Prescription | null): PrescriptionContent | null =>
  prescription && {
    items: prescription.items,
    advice: prescription.advice,
    printDiagnosis: prescription.printDiagnosis,
  };

/** Its fields for a copy of it: nothing typed for none. */
const prescriptionInput = (saved: PrescriptionContent | null): PrescriptionInput => ({
  items: saved?.items.map(lineInput) ?? [],
  advice: saved?.advice ?? "",
  printDiagnosis: saved?.printDiagnosis ?? false,
});

/**
 * The prescription (plan §13; D210 – D217): for the visit's doctor, or
 * whoever types for them (`prescriptions.write`, D45), each medicine its
 * fields on the screen and one **Save prescription** for the whole, shown
 * once something is typed (D210); read out for whoever may only read. The
 * patient's allergies stand above it, and a medicine that names one is
 * warned on its line and asked about at Save (D212). Until the doctor has a
 * registration number, it is not written, and says why (D213). **Repeat**
 * and **Templates** add to what is typed (D236 – D241); the doctor saves it
 * as a template of their own (D240, D243).
 */
export function PrescriptionSection({
  visit,
  writes,
  className,
}: {
  visit: Visit;
  /** Whether this member may write it: the visit's doctor, or `prescriptions.write`, the clinic and patient writable. */
  writes: boolean;
  className?: string;
}) {
  if (writes && visit.doctorRegistration !== null) return <PrescriptionForm visit={visit} className={className} />;
  return (
    <Panel title={words.title} className={className} footer={printout(visit)}>
      <PrescriptionReadout prescription={visit.prescription} />
      <TypedBy prescription={visit.prescription} />
      {writes && <NeedsRegistration doctor={visit.doctorName ?? UI_TEXT.appointment.formerDoctor} />}
    </Panel>
  );
}

/**
 * Print and Download, for a prescription saved with a medicine on it, its
 * doctor with a registration number (D222) — for anyone who reads it, in a
 * view-only clinic too — or nothing.
 */
function printout(visit: Visit) {
  const printable = (visit.prescription?.items.length ?? 0) > 0 && visit.doctorRegistration !== null;
  return printable && <PrescriptionPdf visitId={visit.id} patient={visit.patient.name} day={visit.day} />;
}

/** Who typed it for the doctor, when that was not the doctor (D45). */
function TypedBy({ prescription }: { prescription: Prescription | null }) {
  return prescription?.typedBy ? <p className="text-small text-muted">{words.typedBy(prescription.typedBy)}</p> : null;
}

/** The doctor has no registration number yet (D213): nothing is written in their name until they do. */
function NeedsRegistration({ doctor }: { doctor: string }) {
  const { membership } = useAuth();
  const manages = membership !== null && hasAccess(membership, "team.manage");
  return (
    <div className="grid gap-3 rounded-row bg-coral-soft p-4 text-ink">
      <div className="flex items-start gap-2.5">
        <BadgeAlert size={20} strokeWidth={2.25} aria-hidden="true" className="mt-0.5 shrink-0 text-coral" />
        <div className="min-w-0">
          <p className="font-bold">{words.needsRegistration(doctor)}</p>
          <p className="text-small">{words.needsRegistrationHint}</p>
        </div>
      </div>
      {manages && (
        <div>
          <LinkButton href={TEAM_ROUTE} label={words.openTeam} variant="secondary" size="sm" />
        </div>
      )}
    </div>
  );
}

function PrescriptionForm({ visit, className }: { visit: Visit; className?: string }) {
  const respond = useResponse();
  const { membership } = useAuth();
  // Templates are the doctor's own (D240): only they save one.
  const own = membership !== null && membership.doctorId === visit.doctorId;
  const [naming, setNaming] = useState(false);
  const refresh = useRevalidate();
  const formId = useId();
  const route = apiRoutes.visits.one(visit.id);
  const allergies = visit.alerts.filter((alert) => alert.kind === "ALLERGY");
  const section = useVisitSection({
    saved: contentOf(visit.prescription),
    toInput: prescriptionInput,
    resolver: zodResolver(prescriptionSchema) as unknown as Resolver<PrescriptionInput>,
  });
  const {
    control,
    register,
    formState: { errors },
  } = section.form;
  const lines = useFieldArray({ control, name: "items" });

  const saving = useApiMutation(
    async (input: PrescriptionInput) => {
      const result = await PrescriptionsClient.save({
        visitId: visit.id,
        input: { prescription: input, seen: section.seen },
      });
      section.saved(result.prescription);
      return result;
    },
    {
      revalidate: [route],
      onSuccess: () => respond.success({ title: words.saved }),
      onError: (failure) => {
        // Someone saved it meanwhile: theirs is read, to show beside what is typed.
        if (failure instanceof ApiError && failure.code === "VISIT_CHANGED") void refresh([route]);
        respond.failure(failure, { title: visitWords.notSaved });
      },
    },
  );

  /** What was typed is sent — asked about first when a medicine names an allergy (D212). */
  const save = async () => {
    const input = section.form.getValues();
    const matches = input.items.flatMap(({ medicine }) => {
      const labels = allergiesIn(medicine, allergies);
      return labels.length > 0 ? [words.allergyLine(medicine.trim(), labels.join(", "))] : [];
    });
    if (matches.length > 0) {
      const sure = await respond.confirm({
        title: words.allergyConfirmTitle,
        message: words.allergyConfirmBody(matches.join("; ")),
        confirmLabel: words.saveAnyway,
        tone: "danger",
      });
      if (!sure) return;
    }
    await saving.submit(input);
  };

  const count = lines.fields.length;

  /**
   * Repeat's or a template's medicines after those typed, and its advice in
   * the box (D237, D238) — nothing at all past the most a prescription holds.
   */
  const add = ({ items, advice, from }: Addition) => {
    if (count + items.length > PRESCRIPTION_MAX_ITEMS) {
      respond.warning({ title: words.tooManyTitle, message: words.tooManyBody(PRESCRIPTION_MAX_ITEMS, items.length) });
      return;
    }
    lines.append(items.map(lineInput), { shouldFocus: false });
    const typed = section.form.getValues("advice");
    const advised = withAdvice(typed, advice);
    if (advised !== typed) section.form.setValue("advice", advised, { shouldDirty: true });
    respond.success({ title: words.added(from) });
  };

  /** Save as template: the medicines and advice checked first, as Save would (D239). */
  const nameTemplate = async () => {
    if (await section.form.trigger(["items", "advice"])) setNaming(true);
  };

  return (
    <Panel
      title={words.title}
      className={className}
      footer={
        // While typing, Save; once saved, its printout (D222).
        section.dirty ? (
          <Button type="submit" form={formId} label={words.save} size="sm" loading={saving.submitting} />
        ) : (
          printout(visit)
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-small font-bold text-ink">{words.allergiesLabel}</span>
        {allergies.length > 0 ? (
          <AlertChips alerts={allergies} />
        ) : (
          <span className="text-small text-muted">{words.noAllergies}</span>
        )}
      </div>
      <PrescriptionAids visit={visit} own={own} onAdd={add} />
      <form id={formId} noValidate className="grid gap-4" onSubmit={section.form.handleSubmit(save)}>
        {lines.fields.map((field, index) => (
          <MedicineLine
            key={field.id}
            form={section.form}
            index={index}
            count={count}
            doctorId={visit.doctorId}
            allergies={allergies}
            onMove={(to) => lines.move(index, to)}
            onRemove={() => lines.remove(index)}
          />
        ))}
        <div className="flex flex-wrap gap-2 empty:hidden">
          {count < PRESCRIPTION_MAX_ITEMS && (
            <Button
              label={words.addMedicine}
              icon={Plus}
              variant="secondary"
              size="sm"
              onClick={() => lines.append(EMPTY_LINE, { focusName: `items.${count}.medicine` })}
            />
          )}
          {own && count > 0 && (
            <Button
              label={words.saveAsTemplate}
              icon={BookmarkPlus}
              variant="secondary"
              size="sm"
              onClick={() => void nameTemplate()}
            />
          )}
        </div>
        <TextAreaField
          label={words.adviceLabel}
          rows={2}
          autoComplete="off"
          maxLength={TEXT_LIMITS.advice}
          error={errors.advice?.message}
          {...register("advice")}
        />
        <Checkbox label={words.printDiagnosis} hint={words.printDiagnosisHint} {...register("printDiagnosis")} />
      </form>
      <TypedBy prescription={visit.prescription} />
      {section.theirs !== undefined && (
        <ChangedMeanwhile onTake={section.takeTheirs}>
          <PrescriptionReadout prescription={section.theirs} />
        </ChangedMeanwhile>
      )}
      {own && (
        <SaveTemplateSheet
          open={naming}
          onClose={() => setNaming(false)}
          content={() => ({ items: section.form.getValues("items"), advice: section.form.getValues("advice") })}
        />
      )}
    </Panel>
  );
}
