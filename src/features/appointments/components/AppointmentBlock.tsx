import { cn } from "@/components/ui/cn";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES, type StatusTone } from "@/constants/statuses";
import { formatTime } from "@/lib/format/date";

import { kindOf } from "../describe";
import type { CalendarAppointment } from "../types";

/** The edge each status tone draws down a block's side: the words say it, the edge repeats it. */
const EDGES: Record<StatusTone, string> = {
  live: "border-action",
  attention: "border-coral",
  neutral: "border-edge",
};

/**
 * An appointment as the grid draws it at its time (plan §11.5): its start and
 * the patient on the first line, what kind and where it stands under them
 * when there is room, a status edge down its side. A walk-in, which holds no
 * slot, is drawn on the soft green with its token (D154). Spans all, as it
 * sits inside the button that opens it.
 */
export function AppointmentBlock({ appointment }: { appointment: CalendarAppointment }) {
  return (
    <span
      className={cn(
        "block h-full overflow-hidden rounded-[0.375rem] border-l-4 px-2 py-0.5 text-caption ring-1 ring-line ring-inset",
        appointment.source === "WALK_IN" ? "bg-action-soft" : "bg-surface",
        EDGES[APPOINTMENT_STATUS_TONES[appointment.status]],
      )}
    >
      <span className="block truncate text-ink">
        <span className="tabular-nums">{formatTime(appointment.scheduledAt)}</span>{" "}
        <span className="font-bold">{appointment.patientName}</span>
      </span>
      <span className="block truncate text-muted">
        {kindOf(appointment)} · {APPOINTMENT_STATUS_LABELS[appointment.status]}
      </span>
    </span>
  );
}
