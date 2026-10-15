import type { FollowUp, FollowUpRow, Treatment, TreatmentRow } from "@/features/treatments/types";

/** A treatment as read (0024): Dr. Maya Rao's root canal, in progress, one session. */
export function aTreatmentRow(overrides: Partial<TreatmentRow> = {}): TreatmentRow {
  return {
    id: "t-1",
    patient_id: "p-1",
    doctor_id: "d-1",
    name: "Root canal",
    description: null,
    status: "IN_PROGRESS",
    estimated_cost_paise: 450000,
    started_on: "2026-10-12",
    completed_on: null,
    next_due_on: null,
    cancel_reason: null,
    cancelled_at: null,
    started_visit_id: "v-0",
    created_at: "2026-10-12T05:00:00+00:00",
    doctor: { member: { profile: { full_name: "Maya Rao" } } },
    sessions: [
      {
        id: "s-1",
        visit_id: "v-0",
        note: "Access opened",
        created_at: "2026-10-12T05:10:00+00:00",
        visit: { visit_date: "2026-10-12", doctor: { member: { profile: { full_name: "Maya Rao" } } } },
      },
    ],
    ...overrides,
  };
}

/** A treatment as the screens hold it: the row above. */
export function aTreatment(overrides: Partial<Treatment> = {}): Treatment {
  return {
    id: "t-1",
    patientId: "p-1",
    doctorId: "d-1",
    doctorName: "Maya Rao",
    name: "Root canal",
    description: null,
    status: "IN_PROGRESS",
    estimatedCostPaise: 450000,
    startedOn: "2026-10-12",
    completedOn: null,
    nextDueOn: null,
    cancelReason: null,
    cancelledOn: null,
    startedVisitId: "v-0",
    sessions: [{ id: "s-1", visitId: "v-0", day: "2026-10-12", doctorName: "Maya Rao", note: "Access opened" }],
    ...overrides,
  };
}

/** A follow-up as 0027 hands it back: Anita Rao's root canal with Dr. Maya Rao, due today, not yet contacted. */
export function aFollowUpRow(overrides: Partial<FollowUpRow> = {}): FollowUpRow {
  return {
    kind: "TREATMENT",
    treatment_id: "t-1",
    visit_id: null,
    patient_id: "p-1",
    patient_name: "Anita Rao",
    patient_number: 42,
    patient_phone: "+919876543210",
    title: "Root canal",
    doctor_id: "d-1",
    doctor_name: "Maya Rao",
    due_on: "2026-10-15",
    last_outcome: null,
    last_contacted_at: null,
    last_note: null,
    last_contacted_by: null,
    ...overrides,
  };
}

/** A follow-up as the screen holds it: the row above. */
export function aFollowUp(overrides: Partial<FollowUp> = {}): FollowUp {
  return {
    kind: "TREATMENT",
    id: "t-1",
    patient: { id: "p-1", name: "Anita Rao", number: 42, phone: "+919876543210" },
    title: "Root canal",
    doctorId: "d-1",
    doctorName: "Maya Rao",
    dueOn: "2026-10-15",
    lastContact: null,
    ...overrides,
  };
}
