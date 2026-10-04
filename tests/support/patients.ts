import type { Patient, PatientMatch, PatientRow } from "@/features/patients/types";

/** A patient as the database reads them, for a data-function test. */
export function aPatientRow(overrides: Partial<PatientRow> = {}): PatientRow {
  return {
    id: "p-1",
    patient_number: 1012,
    full_name: "Rohan Mehta",
    phone: "+919876543210",
    alt_phone: null,
    email: null,
    date_of_birth: "1990-04-12",
    dob_is_estimated: false,
    gender: "MALE",
    address: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    assigned_doctor_id: "d-1",
    notes: null,
    archived_at: null,
    doctor: { member: { profile: { full_name: "Rahul Nair" } } },
    archiver: null,
    ...overrides,
  };
}

/** A patient as the screens read them, for a component test. */
export function aPatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "p-1",
    number: 1012,
    name: "Rohan Mehta",
    phone: "+919876543210",
    altPhone: null,
    email: null,
    dateOfBirth: "1990-04-12",
    dobIsEstimated: false,
    gender: "MALE",
    address: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    assignedDoctorId: "d-1",
    doctorName: "Rahul Nair",
    notes: null,
    archivedAt: null,
    archivedBy: null,
    ...overrides,
  };
}

/** One of "Already here?" (D106), for a component test. */
export function aPatientMatch(overrides: Partial<PatientMatch> = {}): PatientMatch {
  return {
    id: "p-7",
    number: 1007,
    name: "Anita Mehta",
    dateOfBirth: "1991-06-14",
    gender: "FEMALE",
    archived: false,
    ...overrides,
  };
}
