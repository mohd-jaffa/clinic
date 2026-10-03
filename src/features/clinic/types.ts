import type { ClinicType, FeeTiming, PaperSize } from "@/constants/statuses";

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
