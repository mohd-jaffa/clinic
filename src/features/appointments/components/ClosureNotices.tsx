import { CalendarOff } from "lucide-react";

/**
 * Why a day is closed (plan §9, §11.5): the clinic's holiday, a doctor's
 * leave — each a line with its mark, above what the day holds. Booking
 * refuses those days; appointments made before stay listed (D87).
 */
export function ClosureNotices({ notices }: { notices: readonly string[] }) {
  if (notices.length === 0) return null;
  return (
    <ul className="grid gap-2">
      {notices.map((notice) => (
        <li
          key={notice}
          className="flex items-center gap-2.5 rounded-row bg-surface px-3.5 py-2.5 text-small font-bold text-ink ring-1 ring-line ring-inset"
        >
          <CalendarOff size={18} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-muted" />
          {notice}
        </li>
      ))}
    </ul>
  );
}
