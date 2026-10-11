"use client";

import { useState } from "react";
import type { UseFormSetValue } from "react-hook-form";

import type { PatientPrefill } from "@/features/patients/prefill";

import type { ChosenPatient } from "../components/PatientPicker";
import type { AppointmentForm } from "../form";

/**
 * Who a booking or a walk-in is for (D144, D145): the patient chosen from the
 * search — held to show them with **Change** — or a new one's fields, filled
 * from what was searched (D112).
 */
export function usePatientChoice(setValue: UseFormSetValue<AppointmentForm>, isSubmitted: boolean) {
  const [chosen, setChosen] = useState<ChosenPatient | null>(null);
  return {
    chosen,
    choose: (patient: ChosenPatient | null) => {
      setChosen(patient);
      setValue("patient.mode", "FOUND");
      setValue("patient.id", patient ? patient.id : "", { shouldValidate: isSubmitted && patient !== null });
    },
    addNew: (prefill: PatientPrefill) => {
      setValue("patient.mode", "NEW");
      setValue("patient.fullName", prefill.fullName ?? "");
      setValue("patient.phone", prefill.phone ?? "");
    },
  };
}
