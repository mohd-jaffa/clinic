import { VITAL_DECIMALS } from "@/constants/clinical";
import { UI_TEXT } from "@/constants/messages";
import { GENDER_LABELS } from "@/constants/statuses";
import { howTaken, medicineTitle } from "@/features/prescriptions/content";
import { bmiOf, formatReading } from "@/features/visits/vitals";
import type { Vitals } from "@/features/visits/types";
import { formatDate, formatLongDate } from "@/lib/format/date";
import { formatAge } from "@/lib/format/age";
import { composer, type Measure, type PdfLayout, type TextStyle } from "@/lib/pdf/layout";
import { layoutLetterhead } from "@/lib/pdf/letterhead";
import { PDF_INNER } from "@/lib/pdf/render";

import type { PrescriptionSheet, PrescriptionSource } from "./types";

const { documents: words, vitals: vitalWords, patients: patientWords } = UI_TEXT;

/** Between readings on the vitals' line: where it may break. */
const VITALS_BETWEEN = " · ";

/** A reading and its unit: "98.6 °F", but "72/min" and "98%". */
const withUnit = (value: string, unit: string) => (/^[/%]/.test(unit) ? `${value}${unit}` : `${value} ${unit}`);

/** The readings taken, in one line (plan §13): "BP 120/80 mmHg · Pulse 72/min · Temp 98.6 °F · BMI 24.4". */
export function vitalsLine(vitals: Vitals | null): string | null {
  if (vitals === null) return null;
  const { units } = vitalWords;
  const short = words.vitals;
  const read = (sign: keyof typeof VITAL_DECIMALS) => formatReading(vitals[sign]!, VITAL_DECIMALS[sign]);
  const bmi = bmiOf(vitals);
  const parts = [
    vitals.systolic !== null &&
      `${short.bloodPressure} ${withUnit(`${read("systolic")}/${read("diastolic")}`, units.bloodPressure)}`,
    vitals.pulse !== null && `${short.pulse} ${withUnit(read("pulse"), units.pulse)}`,
    vitals.temperatureF !== null && `${short.temperatureF} ${withUnit(read("temperatureF"), units.temperatureF)}`,
    vitals.spo2 !== null && `${short.spo2} ${withUnit(read("spo2"), units.spo2)}`,
    vitals.respiratoryRate !== null &&
      `${short.respiratoryRate} ${withUnit(read("respiratoryRate"), units.respiratoryRate)}`,
    vitals.weightKg !== null && `${short.weightKg} ${withUnit(read("weightKg"), units.weightKg)}`,
    vitals.heightCm !== null && `${short.heightCm} ${withUnit(read("heightCm"), units.heightCm)}`,
    bmi !== null && `${short.bmi} ${formatReading(bmi, 1)}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(VITALS_BETWEEN) : null;
}

/**
 * A prescription in the words it is printed in (plan §13; D218, D219): the
 * letterhead, the doctor with their qualifications and registration number,
 * the visit's date, the patient — their age on that day — the vitals taken,
 * the diagnosis when it prints (D216), the medicines, the advice and the
 * review.
 */
export function prescriptionSheet(source: PrescriptionSource, { logo }: { logo: boolean }): PrescriptionSheet {
  const { clinic, doctor, patient, prescription } = source;
  const study = [doctor.qualifications, doctor.specialization].filter(Boolean).join(" · ");
  return {
    letterhead: { name: clinic.name, address: clinic.address, city: clinic.city, phone: clinic.phone, logo },
    doctor: doctor.name === null ? null : words.doctor(doctor.name),
    credentials: [study, words.registration(doctor.registration)].filter(Boolean),
    date: formatDate(source.day),
    patient: patient.name,
    // Their age on the visit's day: a prescription printed again later says what it said then.
    about: [
      formatAge(patient.dateOfBirth, source.day),
      GENDER_LABELS[patient.gender],
      patientWords.number(patient.number),
    ].join(" · "),
    vitals: vitalsLine(source.vitals),
    diagnosis: source.diagnosis,
    items: prescription.items.map((item) => ({
      title: medicineTitle(item),
      how: howTaken(item),
      instructions: item.instructions,
    })),
    advice: prescription.advice,
    followUp: source.followUpOn === null ? null : words.followUp(formatLongDate(source.followUpOn)),
  };
}

const style = (face: TextStyle["face"], size: number, color: TextStyle["color"] = "ink"): TextStyle => ({
  face,
  size,
  color,
});

/** How far in a medicine's lines start from its number. */
const NUMBER = 16;
/** The signature's line. */
const SIGNATURE = 130;

/**
 * Where everything on the prescription goes (D218, D219): the clinic across
 * the top; under it the doctor on the left and the date on the right; the
 * patient, the vitals and the diagnosis; then "Rx" and each medicine
 * numbered, how it is taken under it; the advice and the review. The
 * signature stands at the foot of the last page. A page may end only
 * between medicines, or around the advice and the review.
 */
export function layoutPrescription(sheet: PrescriptionSheet, measure: Measure): PdfLayout {
  const page = composer(measure, PDF_INNER);
  layoutLetterhead(page, sheet.letterhead);
  page.space(10);
  page.row(
    { text: sheet.doctor ?? "", style: style("semibold", 10.5) },
    { text: sheet.date, style: style("regular", 8.5) },
  );
  for (const line of sheet.credentials) page.text(line, style("regular", 7.5, "muted"));
  page.space(8);
  page.rule();
  page.space(9);
  page.pair(
    { text: sheet.patient, style: style("semibold", 10) },
    { text: sheet.about, style: style("regular", 8.5, "muted") },
    { gap: 6 },
  );
  if (sheet.vitals) {
    page.space(2);
    page.text(sheet.vitals, style("regular", 8), { between: VITALS_BETWEEN });
  }
  if (sheet.diagnosis) {
    page.space(2);
    page.pair(
      { text: `${words.diagnosis}:`, style: style("semibold", 8.5) },
      { text: sheet.diagnosis, style: style("regular", 8.5) },
    );
  }
  page.space(12);
  page.mayBreak();

  page.text(words.rx, style("bold", 13));
  page.space(3);
  sheet.items.forEach((item, index) => {
    page.mark(String(index + 1), style("semibold", 9.5, "muted"));
    page.text(item.title, style("semibold", 9.5), { x: NUMBER });
    if (item.how) page.text(item.how, style("regular", 8.5), { x: NUMBER });
    if (item.instructions) page.text(item.instructions, style("regular", 8, "muted"), { x: NUMBER });
    page.space(6);
    page.mayBreak();
  });

  if (sheet.advice) {
    page.space(4);
    page.text(words.advice, style("semibold", 8.5));
    page.text(sheet.advice, style("regular", 8.5));
    page.space(4);
    page.mayBreak();
  }
  if (sheet.followUp) {
    page.space(4);
    page.text(sheet.followUp, style("semibold", 9));
    page.mayBreak();
  }

  const foot = composer(measure, PDF_INNER);
  foot.space(24);
  foot.rule({ x: PDF_INNER - SIGNATURE, wide: SIGNATURE, color: "ink" });
  foot.space(4);
  if (sheet.doctor) foot.mark(sheet.doctor, style("regular", 8.5), { right: true });
  foot.space(12);

  const { height, ops, breaks } = page.done();
  const signature = foot.done();
  return {
    height,
    ops,
    breaks,
    foot: { height: signature.height, ops: signature.ops },
    running: words.running(sheet.patient, sheet.about, sheet.date),
  };
}
