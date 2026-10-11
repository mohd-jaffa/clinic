import { ApiError } from "@/lib/api/client";
import type { BookingInput, PatientMode } from "@/lib/validation";

import type { ChosenPatient } from "./components/PatientPicker";

/**
 * The form a booking, a move and a walk-in are held in: the booking as
 * `bookingSchema` reads it, with every field of a new patient held as a
 * string from the start, though only the mode chosen is read. A walk-in
 * leaves the time, the length and the notes as they start.
 */
export type AppointmentForm = Omit<BookingInput, "patient"> & {
  patient: {
    mode: PatientMode;
    id: string;
    fullName: string;
    phone: string;
    born: { as: string; date: string; years: string };
    gender: string;
  };
  /** When an appointment being moved is now (D161). */
  was?: string;
};

/** No patient yet: none found, and a new one's fields empty. */
export const NO_PATIENT: AppointmentForm["patient"] = {
  mode: "FOUND",
  id: "",
  fullName: "",
  phone: "",
  born: { as: "DATE", date: "", years: "" },
  gender: "",
};

/** What a refusal names (D145, D148): the time it clashed with, the closure it fell on, the patient added. */
export interface Refusal {
  startsAt?: string;
  endsAt?: string;
  reason?: string;
  wholeClinic?: boolean;
  patient?: ChosenPatient;
}

/** What a refusal from the API names, if it names anything. */
export const refusalOf = (failure: unknown) =>
  (failure instanceof ApiError ? failure.details : undefined) as Refusal | undefined;
