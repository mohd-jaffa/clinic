import type { PrescriptionTiming } from "@/constants/statuses";

/**
 * One medicine on a prescription (plan §13): its name, and each of the rest
 * as written — or none. The frequency is a chip's words or typed (D214); the
 * days a whole number (D217).
 */
export interface PrescriptionItem {
  medicine: string;
  strength: string | null;
  dose: string | null;
  frequency: string | null;
  timing: PrescriptionTiming | null;
  durationDays: number | null;
  instructions: string | null;
}

/**
 * What a prescription says (D210): its medicines in order, the advice, and
 * whether the diagnosis prints (D216). What its section saves, and what a
 * save is compared with (D206).
 */
export interface PrescriptionContent {
  items: PrescriptionItem[];
  advice: string | null;
  printDiagnosis: boolean;
}

/** A visit's prescription as its screen shows it: what it says, and who typed it for the doctor, if not the doctor (D45). */
export interface Prescription extends PrescriptionContent {
  id: string;
  /** None when the doctor wrote it, or the typist's account is gone. */
  typedBy: string | null;
}

/** A medicine line as the database names it. */
export interface PrescriptionItemRow {
  medicine: string;
  strength: string | null;
  dose: string | null;
  frequency: string | null;
  timing: PrescriptionTiming | null;
  duration_days: number | null;
  instructions: string | null;
}

/** A prescription as `prescription_of` (0021) hands it over: what a save is compared with. */
export interface PrescriptionRow {
  items: PrescriptionItemRow[];
  advice: string | null;
  print_diagnosis: boolean;
}

/** A prescription embedded in its visit's read: with its id, who typed it and its medicines' places. */
export interface EmbeddedPrescriptionRow {
  id: string;
  advice: string | null;
  print_diagnosis: boolean;
  entered_by: string | null;
  typist: { full_name: string } | null;
  items: (PrescriptionItemRow & { position: number })[];
}

/** A prescription saved (D210): what it says now. */
export interface PrescriptionSaved {
  prescription: PrescriptionContent;
}

/**
 * What Repeat fills (D236): the patient's latest prescription with a
 * medicine on it, from their visits before this one — its day, its doctor,
 * its advice and medicines.
 */
export interface PreviousPrescription {
  day: string;
  /** None once the doctor's account is gone. */
  doctorName: string | null;
  advice: string | null;
  items: PrescriptionItem[];
}

/** It as `previous_prescription` (0023) hands it over. */
export interface PreviousPrescriptionRow {
  day: string;
  doctor_name: string | null;
  advice: string | null;
  items: PrescriptionItemRow[];
}

/**
 * A doctor's prescription template (plan §13; D240 – D243): its name, its
 * medicines in order and its advice, and whether it is offered (archived
 * ones are not, D242).
 */
export interface PrescriptionTemplate {
  id: string;
  name: string;
  advice: string | null;
  active: boolean;
  items: PrescriptionItem[];
}

/** A template as it is read, with its medicines' places. */
export interface PrescriptionTemplateRow {
  id: string;
  name: string;
  advice: string | null;
  active: boolean;
  items: (PrescriptionItemRow & { position: number })[];
}

/** A template as `prescription_template_of` (0023) hands it over: what the trail compares. */
export interface PrescriptionTemplateContentRow {
  name: string;
  advice: string | null;
  active: boolean;
  items: PrescriptionItemRow[];
}
