"use client";

import { ArrowDown, ArrowUp, Trash2, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { IconButton } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { SuggestField } from "@/components/ui/suggest-field";
import { TextField } from "@/components/ui/text-field";
import { PRESCRIPTION_DAYS, PRESCRIPTION_FREQUENCIES } from "@/constants/clinical";
import { TEXT_LIMITS } from "@/constants/limits";
import { UI_TEXT } from "@/constants/messages";
import { PRESCRIPTION_TIMING_LABELS, PRESCRIPTION_TIMINGS } from "@/constants/statuses";
import type { PatientAlert } from "@/features/patients/types";
import type { PrescriptionItemInput } from "@/lib/validation";

import { allergiesIn } from "../allergies";
import { howTaken, medicineTitle } from "../content";
import { useMedicineSuggestions } from "../hooks/useMedicineSuggestions";
import type { PrescriptionItem } from "../types";

const { prescription: words } = UI_TEXT;

/** A form of medicines, one line each: a prescription's, or a template's (D242). */
export interface MedicinesInput {
  items: PrescriptionItemInput[];
}

/** A medicine not yet written: every field blank. */
export const EMPTY_LINE: PrescriptionItemInput = {
  medicine: "",
  strength: "",
  dose: "",
  frequency: "",
  timing: "",
  durationDays: "",
  instructions: "",
};

/** A medicine's fields for a line as written: blank for none. */
export const lineInput = (item: PrescriptionItem): PrescriptionItemInput => ({
  medicine: item.medicine,
  strength: item.strength ?? "",
  dose: item.dose ?? "",
  frequency: item.frequency ?? "",
  timing: item.timing ?? "",
  durationDays: item.durationDays === null ? "" : String(item.durationDays),
  instructions: item.instructions ?? "",
});

/** The chip that opens a frequency to type (D214). */
const OTHER = "OTHER";
const CHIPS: readonly string[] = PRESCRIPTION_FREQUENCIES;
const FREQUENCY_OPTIONS = [
  ...PRESCRIPTION_FREQUENCIES.map((frequency) => ({ value: frequency as string, label: frequency })),
  { value: OTHER, label: words.otherFrequency },
];
const TIMING_OPTIONS = PRESCRIPTION_TIMINGS.map((timing) => ({
  value: timing as string,
  label: PRESCRIPTION_TIMING_LABELS[timing],
}));

/**
 * One medicine on the prescription (plan §13; D210 – D217), its fields open:
 * the name — with this clinic's medicines written before under it, one taken
 * filling in the whole line as last written (D211), and a warning when it
 * names one of the patient's allergies (D212) — then strength and dose, the
 * frequency and timing as chips (Other to type a frequency, D214; a chip
 * tapped again is none), the days (D217) and instructions. Moved up or down,
 * or removed, from its head.
 */
export function MedicineLine<Input extends MedicinesInput>({
  form,
  index,
  count,
  doctorId,
  allergies,
  onMove,
  onRemove,
}: {
  /** The form the line is in: a prescription's, or a template's. */
  form: UseFormReturn<Input>;
  index: number;
  count: number;
  /** Whose lines come first among the suggestions: the visit's doctor, or the template's. */
  doctorId: string;
  allergies: readonly PatientAlert[];
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const {
    control,
    register,
    setValue,
    formState: { errors, isSubmitted },
    // Only its own line is reached, under `items`, whatever else the form holds.
  } = form as unknown as UseFormReturn<MedicinesInput>;
  const n = index + 1;
  const headId = useId();
  const warningId = useId();
  const frequencyId = useId();
  const timingId = useId();
  const [medicine, frequency, timing] = useWatch({
    control,
    name: [`items.${index}.medicine`, `items.${index}.frequency`, `items.${index}.timing`],
  });
  // Suggestions are asked for only while the name is being typed.
  const [typing, setTyping] = useState(false);
  const [otherChosen, setOtherChosen] = useState(false);
  const { data: found } = useMedicineSuggestions(typing ? medicine : "", doctorId);
  const shown = typing ? (found ?? []) : [];
  const matched = allergiesIn(medicine, allergies);
  const typedFrequency = Boolean(frequency) && !CHIPS.includes(frequency!);
  const chip = otherChosen || typedFrequency ? OTHER : (frequency ?? "");
  const wrong = errors.items?.[index];

  const set = (field: keyof PrescriptionItemInput, value: string) =>
    setValue(`items.${index}.${field}`, value, { shouldDirty: true, shouldValidate: isSubmitted });

  /** A suggestion taken: the whole line as last written (D211). */
  const take = (line: PrescriptionItem) => {
    setTyping(false);
    setOtherChosen(false);
    for (const [field, value] of Object.entries(lineInput(line))) {
      set(field as keyof PrescriptionItemInput, String(value));
    }
  };

  const chooseFrequency = (value: string) => {
    if (value === OTHER) {
      setOtherChosen(true);
      if (!typedFrequency) set("frequency", "");
    } else {
      setOtherChosen(false);
      // A chip tapped again is none.
      set("frequency", value === chip ? "" : value);
    }
  };

  const name = register(`items.${index}.medicine`);
  return (
    <div role="group" aria-labelledby={headId} className="grid gap-3 rounded-row bg-ground p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p id={headId} className="font-bold text-ink">
          {words.medicineN(n)}
        </p>
        <div className="-my-1.5 -mr-1.5 flex items-center">
          <IconButton icon={ArrowUp} label={words.moveUp(n)} disabled={index === 0} onClick={() => onMove(index - 1)} />
          <IconButton
            icon={ArrowDown}
            label={words.moveDown(n)}
            disabled={index === count - 1}
            onClick={() => onMove(index + 1)}
          />
          <IconButton icon={Trash2} label={words.remove(n)} onClick={onRemove} />
        </div>
      </div>
      <SuggestField
        label={words.medicineLabel}
        required
        maxLength={TEXT_LIMITS.medicine}
        listLabel={words.suggestions}
        suggestions={shown.map((line, at) => ({
          key: String(at),
          label: medicineTitle(line),
          detail: howTaken(line) || undefined,
        }))}
        onPick={(key) => take(shown[Number(key)])}
        describedBy={matched.length > 0 ? warningId : undefined}
        error={wrong?.medicine?.message}
        {...name}
        onChange={(event) => {
          setTyping(true);
          return name.onChange(event);
        }}
        onBlur={(event) => {
          setTyping(false);
          return name.onBlur(event);
        }}
      />
      {matched.length > 0 && (
        <p id={warningId} className="-mt-1 flex items-start gap-1.5 text-small font-bold text-coral">
          <TriangleAlert size={16} strokeWidth={2.5} aria-hidden="true" className="mt-0.5 shrink-0" />
          {words.allergy(matched.join(", "))}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={words.strengthLabel}
          autoComplete="off"
          maxLength={TEXT_LIMITS.strength}
          error={wrong?.strength?.message}
          {...register(`items.${index}.strength`)}
        />
        <TextField
          label={words.doseLabel}
          autoComplete="off"
          maxLength={TEXT_LIMITS.dose}
          error={wrong?.dose?.message}
          {...register(`items.${index}.dose`)}
        />
      </div>
      <div className="grid gap-1">
        <p id={frequencyId} className="text-small font-bold text-ink">
          {words.frequencyLabel}
        </p>
        <ChoiceChips
          label={words.frequencyLabel}
          labelledBy={frequencyId}
          value={chip}
          options={FREQUENCY_OPTIONS}
          onChange={chooseFrequency}
          wrap
        />
        {chip === OTHER && (
          <TextField
            label={words.otherFrequencyLabel}
            autoComplete="off"
            maxLength={TEXT_LIMITS.frequency}
            error={wrong?.frequency?.message}
            {...register(`items.${index}.frequency`)}
          />
        )}
      </div>
      <div className="grid gap-1">
        <p id={timingId} className="text-small font-bold text-ink">
          {words.timingLabel}
        </p>
        <ChoiceChips
          label={words.timingLabel}
          labelledBy={timingId}
          value={timing ?? ""}
          options={TIMING_OPTIONS}
          // A chip tapped again is none.
          onChange={(value) => set("timing", value === timing ? "" : value)}
          wrap
        />
      </div>
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
        <TextField
          label={words.daysLabel}
          inputMode="numeric"
          autoComplete="off"
          maxLength={String(PRESCRIPTION_DAYS.max).length}
          error={wrong?.durationDays?.message}
          {...register(`items.${index}.durationDays`)}
        />
        <TextField
          label={words.instructionsLabel}
          autoComplete="off"
          maxLength={TEXT_LIMITS.instructions}
          error={wrong?.instructions?.message}
          {...register(`items.${index}.instructions`)}
        />
      </div>
    </div>
  );
}
