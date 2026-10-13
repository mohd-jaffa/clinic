import { VITAL_DECIMALS, VITAL_SIGNS } from "@/constants/clinical";
import { UI_TEXT } from "@/constants/messages";

import type { Vitals } from "../types";
import { bmiOf, formatReading, vitalLabel } from "../vitals";

const { vitals: words, visit } = UI_TEXT;

/**
 * The vitals read out (plan §32.1: "vitals in big numerals"), for whoever
 * may read but not write them: each taken reading in heading size over its
 * name and unit — blood pressure as one, "120/80" — and the BMI when weight
 * and height are both taken. "Nothing recorded" until any is.
 */
export function VitalsReadout({ vitals }: { vitals: Vitals | null }) {
  const bmi = vitals && bmiOf(vitals);
  const shown: { label: string; value: string }[] = [];
  if (vitals?.systolic != null && vitals.diastolic != null) {
    shown.push({
      label: `${words.bloodPressure} (${words.units.bloodPressure})`,
      value: `${vitals.systolic}/${vitals.diastolic}`,
    });
  }
  for (const sign of VITAL_SIGNS.filter((sign) => sign !== "systolic" && sign !== "diastolic")) {
    const value = vitals?.[sign];
    if (value != null) shown.push({ label: vitalLabel(sign), value: formatReading(value, VITAL_DECIMALS[sign]) });
  }
  if (bmi != null) shown.push({ label: words.bmi, value: formatReading(bmi, 1) });

  if (shown.length === 0) return <p className="text-small text-muted">{visit.nothingRecorded}</p>;
  return (
    <dl className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-4 gap-y-5">
      {shown.map(({ label, value }) => (
        <div key={label} className="flex min-w-0 flex-col">
          <dt className="order-2 text-small text-muted">{label}</dt>
          <dd className="order-1 text-heading font-bold tracking-[-0.02em] text-ink tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
