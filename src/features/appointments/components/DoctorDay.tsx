"use client";

import { Fragment } from "react";

import { UI_TEXT } from "@/constants/messages";
import { formatTime } from "@/lib/format/date";

import { useBookedTimes } from "../hooks/useBookedTimes";

const { appointments } = UI_TEXT;

/**
 * What the doctor already has on the day being booked (D147), under the
 * time: each taken time, start to end — never whose — or that nothing is
 * booked yet. Said politely as it changes; nothing while it is unknown.
 */
export function DoctorDay({ doctorId, doctorName, date }: { doctorId: string; doctorName: string; date: string }) {
  const { data } = useBookedTimes(doctorId, date);
  const known = data !== undefined && doctorName !== "";
  return (
    <p aria-live="polite" className="-mt-2 text-small text-muted empty:hidden">
      {known && data.length === 0 && appointments.doctorDayFree(doctorName)}
      {known && data.length > 0 && (
        <>
          {appointments.doctorDayLead(doctorName)}{" "}
          {data.map(({ startsAt, endsAt }, index) => (
            // A time is read whole: the line breaks between times, never inside one.
            <Fragment key={startsAt}>
              <span className="whitespace-nowrap">
                {appointments.timeRange(formatTime(startsAt), formatTime(endsAt))}
                {index === data.length - 1 && "."}
              </span>
              {index < data.length - 1 && ", "}
            </Fragment>
          ))}
        </>
      )}
    </p>
  );
}
