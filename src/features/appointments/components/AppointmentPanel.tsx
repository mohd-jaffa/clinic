"use client";

import { useState } from "react";

import { WaitingVitalsSheet } from "@/features/visits/components/WaitingVitalsSheet";

import type { AppointmentDetail, CalendarAppointment } from "../types";
import { AppointmentSheet } from "./AppointmentSheet";
import { BookingSheet } from "./BookingSheet";
import { CancelSheet } from "./CancelSheet";
import { NotesSheet } from "./NotesSheet";

type Step = "DETAIL" | "CANCEL" | "MOVE" | "NOTES" | "VITALS";

/**
 * An appointment opened (plan §11.2; D160 – D165), from the calendar or a
 * patient's profile: its detail, and the sheet each of its actions opens over
 * the screen in its place — the booking sheet to reschedule it, its notes,
 * the reason it is cancelled, a waiting patient's vitals (D203). Closing one of those goes back to the detail;
 * done, everything closes, and the card says so. The screen keys it by the
 * appointment, so each opens afresh.
 */
export function AppointmentPanel({
  appointment,
  open,
  onClose,
  linkProfile = true,
}: {
  appointment: CalendarAppointment | null;
  open: boolean;
  onClose: () => void;
  /** Offer **Open profile** — not on the profile itself. */
  linkProfile?: boolean;
}) {
  const [step, setStep] = useState<Step>("DETAIL");
  // The detail a reschedule or a notes sheet was opened on, and how many times — each opens on it afresh.
  const [held, setHeld] = useState<{ detail: AppointmentDetail; count: number } | null>(null);
  if (appointment === null) return null;
  const hold = (at: Step) => (detail: AppointmentDetail) => {
    setHeld((was) => ({ detail, count: (was?.count ?? 0) + 1 }));
    setStep(at);
  };
  const back = () => setStep("DETAIL");
  const done = () => {
    setStep("DETAIL");
    onClose();
  };

  return (
    <>
      <AppointmentSheet
        appointment={appointment}
        open={open && step === "DETAIL"}
        onClose={done}
        onReschedule={hold("MOVE")}
        onEditNotes={hold("NOTES")}
        onTakeVitals={hold("VITALS")}
        onCancel={() => setStep("CANCEL")}
        linkProfile={linkProfile}
      />
      <CancelSheet appointment={appointment} open={open && step === "CANCEL"} onClose={back} onDone={done} />
      {held && (
        <>
          <BookingSheet
            key={`move-${held.count}`}
            moving={held.detail}
            open={open && step === "MOVE"}
            onClose={back}
            onMoved={done}
          />
          <NotesSheet
            key={`notes-${held.count}`}
            appointment={held.detail}
            open={open && step === "NOTES"}
            onClose={back}
            onDone={done}
          />
          <WaitingVitalsSheet
            key={`vitals-${held.count}`}
            appointment={held.detail}
            open={open && step === "VITALS"}
            onClose={back}
            onDone={done}
          />
        </>
      )}
    </>
  );
}
