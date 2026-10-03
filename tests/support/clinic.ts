import type { AppointmentType, ClinicProfile, ExpenseCategory, Service } from "@/features/clinic/types";

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

/** A line of the price list, for a component test. */
export function aService(overrides: Partial<Service> = {}): Service {
  return {
    id: "s-1",
    name: "Scaling and polishing",
    category: "PROCEDURE",
    pricePaise: 80000,
    active: true,
    ...overrides,
  };
}

/** An appointment type, for a component test. */
export function anAppointmentType(overrides: Partial<AppointmentType> = {}): AppointmentType {
  return { id: "a-1", name: "Consultation", minutes: 15, active: true, ...overrides };
}

/** An expense category, for a component test. */
export function anExpenseCategory(overrides: Partial<ExpenseCategory> = {}): ExpenseCategory {
  return { id: "c-1", name: "Rent", active: true, ...overrides };
}
