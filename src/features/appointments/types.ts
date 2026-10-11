/**
 * What a booking answers (plan §11.1, D150): the appointment, its patient —
 * the one found, or the one added with it — and when it is. The sheet's card
 * is worded from what was chosen; a booker may not read appointments back.
 */
export interface Booked {
  id: string;
  patientId: string;
  scheduledAt: string;
  minutes: number;
}

/** A doctor's taken time on a day (D147): when it starts and ends — never whose it is. */
export interface BookedTime {
  startsAt: string;
  endsAt: string;
}
