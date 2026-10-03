import type { ClinicType, FeeTiming, PaperSize, ServiceCategory } from "@/constants/statuses";

/** A `clinics` row as Clinic details reads it. */
export interface ClinicRow {
  id: string;
  name: string;
  clinic_type: ClinicType;
  phone: string | null;
  email: string | null;
  address: string;
  city: string;
  gstin: string | null;
  timezone: string;
  paper_size: PaperSize;
  fee_timing: FeeTiming;
  logo_path: string | null;
}

/** The clinic's profile (plan §9), as the API answers it. */
export interface ClinicProfile {
  id: string;
  name: string;
  clinicType: ClinicType;
  phone: string | null;
  email: string | null;
  address: string;
  city: string;
  gstin: string | null;
  timezone: string;
  paperSize: PaperSize;
  feeTiming: FeeTiming;
  /** Where its logo is read, naming the logo's version; null while it has none. */
  logoUrl: string | null;
}

/** A `services` row: one line of the price list (plan §9, §28.2). */
export interface ServiceRow {
  id: string;
  name: string;
  category: ServiceCategory;
  price_paise: number;
  active: boolean;
}

/** A price-list entry, as the API answers it. Archived ones are `active: false` (D80). */
export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  pricePaise: number;
  active: boolean;
}

/** An `appointment_types` row (plan §9, D32). */
export interface AppointmentTypeRow {
  id: string;
  name: string;
  default_minutes: number;
  position: number;
  active: boolean;
}

/** An appointment type, as the API answers it: its usual length in minutes. */
export interface AppointmentType {
  id: string;
  name: string;
  minutes: number;
  active: boolean;
}

/** An `expense_categories` row (plan §9, D40). */
export interface ExpenseCategoryRow {
  id: string;
  name: string;
  position: number;
  active: boolean;
}

/** An expense category, as the API answers it. */
export interface ExpenseCategory {
  id: string;
  name: string;
  active: boolean;
}

/** What every catalogue entry has: a name, and whether it is still offered. */
export interface CatalogueEntry {
  id: string;
  name: string;
  active: boolean;
}

/** A `clinic_closures` row as it is read, with the doctor's name through their membership. */
export interface ClosureRow {
  id: string;
  doctor_id: string | null;
  starts_on: string;
  ends_on: string;
  reason: string;
  doctor: { member: { profile: { full_name: string } | null } | null } | null;
}

/** A holiday (the whole clinic) or one doctor's leave (plan §9): its days, both ends included. */
export interface Closure {
  id: string;
  /** None for the whole clinic. */
  doctorId: string | null;
  doctorName: string | null;
  startsOn: string;
  endsOn: string;
  reason: string;
}
