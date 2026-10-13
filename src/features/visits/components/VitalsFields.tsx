"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import { TextField } from "@/components/ui/text-field";
import { VITAL_DECIMALS, VITAL_SIGNS } from "@/constants/clinical";
import { UI_TEXT } from "@/constants/messages";
import type { VitalsInput } from "@/lib/validation";

import { bmiOf, formatReading, vitalLabel } from "../vitals";

const { vitals: words } = UI_TEXT;

/** A reading as typed, for the BMI beside it: a number, or none while it is not one yet. */
const typed = (text: string | undefined) => (text && /^\d+(\.\d+)?$/.test(text.trim()) ? Number(text) : null);

/**
 * The vitals' fields (plan §12.2): blood pressure, pulse, temperature in °F
 * (D31), SpO₂, respiratory rate, weight and height — each may be left blank —
 * two to a row on a phone, four on a wider screen, and the BMI worked out as
 * weight and height are typed. A number pad on a phone.
 */
export function VitalsFields({ form, disabled = false }: { form: UseFormReturn<VitalsInput>; disabled?: boolean }) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const [weightKg, heightCm] = useWatch({ control, name: ["weightKg", "heightCm"] });
  const bmi = bmiOf({ weightKg: typed(weightKg), heightCm: typed(heightCm) });
  return (
    // Aligned at their wells, so a label running onto two lines never drops its field below its row.
    <div className="grid grid-cols-2 items-end gap-x-3 gap-y-4 sm:grid-cols-4">
      {VITAL_SIGNS.map((sign) => (
        <TextField
          key={sign}
          label={vitalLabel(sign)}
          inputMode={VITAL_DECIMALS[sign] === 0 ? "numeric" : "decimal"}
          autoComplete="off"
          enterKeyHint="next"
          disabled={disabled}
          error={errors[sign]?.message}
          {...register(sign)}
        />
      ))}
      <p className="col-span-2 text-small text-muted sm:col-span-4" aria-live="polite">
        {words.bmi}{" "}
        <span className="font-bold text-ink tabular-nums">{bmi === null ? words.notTaken : formatReading(bmi, 1)}</span>
      </p>
    </div>
  );
}
