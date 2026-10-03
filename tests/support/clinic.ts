import type { ClinicProfile } from "@/features/clinic/types";

/** A clinic's profile as the API answers it, for a component test. */
export function aClinicProfile(overrides: Partial<ClinicProfile> = {}): ClinicProfile {
  return {
    id: "clinic-1",
    name: "Smile Care Dental",
    clinicType: "DENTAL",
    phone: null,
    email: null,
    address: "12 MG Road",
    city: "Kochi",
    gstin: null,
    timezone: "Asia/Kolkata",
    paperSize: "A4",
    feeTiming: "AFTER_CONSULTATION",
    logoUrl: "/api/clinic/logo?v=1",
    ...overrides,
  };
}
