"use client";

import { useState } from "react";

import type { FollowUpTab } from "@/constants/statuses";
import { BookingSheet } from "@/features/appointments/components/BookingSheet";
import { todayKey } from "@/lib/dates/calendar";

import type { FollowUp } from "../types";
import { FollowUpSheet } from "./FollowUpSheet";

/**
 * A follow-up opened (plan §14.3): its sheet, and **Book** in its place — the
 * booking with the patient, the doctor and the day it is due filled in, or
 * today for one overdue (D276). Closing the booking goes back to the sheet;
 * booked, everything closes: the follow-up is done and leaves its list
 * (D268). The screen keys it by the follow-up, so each opens afresh.
 */
export function FollowUpPanel({
  followUp,
  tab,
  clinic,
  notes,
  books,
  open,
  onClose,
}: {
  followUp: FollowUp | null;
  tab: FollowUpTab;
  clinic: { name: string; phone: string | null };
  notes: boolean;
  books: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const [booking, setBooking] = useState({ open: false, count: 0 });
  if (followUp === null) return null;
  const back = () => setBooking((now) => ({ ...now, open: false }));
  const done = () => {
    back();
    onClose();
  };
  const today = todayKey();

  return (
    <>
      <FollowUpSheet
        followUp={followUp}
        tab={tab}
        clinic={clinic}
        notes={notes}
        books={books}
        open={open && !booking.open}
        onClose={done}
        onBook={() => setBooking(({ count }) => ({ open: true, count: count + 1 }))}
      />
      {books && booking.count > 0 && (
        <BookingSheet
          key={booking.count}
          patient={{ id: followUp.patient.id, name: followUp.patient.name, number: followUp.patient.number }}
          prefill={{
            doctorId: followUp.doctorId,
            date: followUp.dueOn < today ? today : followUp.dueOn,
            time: { hour: "", minute: "" },
          }}
          open={open && booking.open}
          onClose={back}
          onBooked={done}
        />
      )}
    </>
  );
}
