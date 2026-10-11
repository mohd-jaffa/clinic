"use client";

import { Plus } from "lucide-react";
import type { ReactNode } from "react";

import { formatClock, formatHour } from "@/lib/format/date";

import { cn } from "./cn";

/** A column of the grid: a doctor's day, or a day of a doctor's week. */
export interface GridColumn {
  key: string;
  title: string;
  /** Under the title: the date, "Today", or why it is closed. */
  subtitle?: string;
  /** Why the column is closed — a holiday, a doctor's leave: shaded, and nothing is booked by tapping it. */
  closed?: string;
  /** Marks today's column (`aria-current="date"`). */
  today?: boolean;
  /** The first minute of the day a tap may book from — none before it (a day passed, today's past). */
  pickableFrom?: number;
}

/** Something at a time in a column, its start and end in minutes from midnight. */
export interface GridItem {
  key: string;
  column: string;
  start: number;
  end: number;
  /** What it says, whole, to a screen reader. */
  label: string;
  content: ReactNode;
}

/** How tall each step is, in pixels: a quarter of an hour reads one line. */
const STEP_PX = 24;

/**
 * Where each item sits across its column: items whose times overlap share it
 * side by side, each in the first lane free at its start, as wide as the
 * busiest moment of their overlap allows. Each is held at least one step
 * tall, so a short one never hides under the next.
 */
export function lanesOf(items: readonly Pick<GridItem, "key" | "start" | "end">[], step: number) {
  const placed = new Map<string, { lane: number; lanes: number }>();
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  let cluster: string[] = [];
  let ends: number[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    for (const key of cluster) placed.get(key)!.lanes = ends.length;
    cluster = [];
    ends = [];
  };
  for (const item of sorted) {
    const end = Math.max(item.end, item.start + step);
    if (item.start >= clusterEnd) close();
    let lane = ends.findIndex((laneEnd) => laneEnd <= item.start);
    if (lane < 0) lane = ends.push(end) - 1;
    else ends[lane] = end;
    placed.set(item.key, { lane, lanes: 1 });
    cluster.push(item.key);
    clusterEnd = Math.max(clusterEnd, end);
  }
  close();
  return placed;
}

const timeOf = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * The calendar grid (plan §11.5, D66): a time down the side, by the hour, and
 * a column for each doctor of a day or each day of a doctor's week, in steps
 * of `step` minutes from `from` to `to`. Each column's items are a list at
 * their times, sharing the column where they overlap. A closed column is
 * shaded and says why.
 *
 * With `onPick`, an empty step is tapped to start something there — a booking
 * at 10:15 with that doctor — showing the time it would be under the pointer.
 * The steps are a pointer's shortcut only, hidden from assistive technology:
 * the screen's own button does the same for a keyboard or a screen reader. A
 * step before a column's `pickableFrom` takes no tap.
 *
 * Columns keep a readable width and the grid scrolls sideways when there are
 * more than the screen holds.
 */
export function CalendarGrid({
  label,
  columns,
  from,
  to,
  step,
  items,
  columnWidth = "wide",
  onPick,
}: {
  /** What the grid shows: "Appointments, Monday 12 Oct 2026". */
  label: string;
  columns: readonly GridColumn[];
  /** The first and last minutes shown, on the hour. */
  from: number;
  to: number;
  step: number;
  items: readonly GridItem[];
  /** How narrow a column may get before the grid scrolls: a doctor's day reads wide; a week's seven fit a desktop. */
  columnWidth?: "wide" | "narrow";
  onPick?: (column: string, minutes: number) => void;
}) {
  const steps = Array.from({ length: (to - from) / step }, (_, index) => from + index * step);
  const hours = steps.filter((minutes) => minutes % 60 === 0);
  const height = steps.length * STEP_PX;
  const top = (minutes: number) => ((minutes - from) / step) * STEP_PX;
  const template = {
    gridTemplateColumns: `4rem repeat(${columns.length}, minmax(${columnWidth === "wide" ? "10rem" : "7.5rem"}, 1fr))`,
  };

  return (
    <section aria-label={label} className="overflow-x-auto rounded-row bg-surface ring-1 ring-line ring-inset">
      <div className="grid min-w-max" style={template}>
        <div className="sticky left-0 z-[2] border-b border-line bg-surface" />
        {columns.map((column) => (
          <div
            key={column.key}
            aria-current={column.today ? "date" : undefined}
            className="border-b border-l border-line px-3 py-2.5"
          >
            <p className={cn("truncate text-small font-bold", column.today ? "text-action" : "text-ink")}>
              {column.title}
            </p>
            {(column.closed ?? column.subtitle) && (
              <p className="truncate text-caption text-muted">{column.closed ?? column.subtitle}</p>
            )}
          </div>
        ))}

        <div aria-hidden="true" className="sticky left-0 z-[2] bg-surface" style={{ height }}>
          {hours.map((minutes) => (
            <span
              key={minutes}
              className="absolute right-2 -translate-y-1/2 text-caption text-muted tabular-nums first:translate-y-0"
              style={{ top: top(minutes) }}
            >
              {formatHour(timeOf(minutes).slice(0, 2))}
            </span>
          ))}
        </div>

        {columns.map((column) => {
          const own = items.filter((item) => item.column === column.key);
          const placed = lanesOf(own, step);
          const pickable = onPick && !column.closed;
          return (
            <div
              key={column.key}
              className={cn("relative border-l border-line", column.closed && "bg-ink/5")}
              style={{ height }}
            >
              <div aria-hidden="true" className="absolute inset-0">
                {steps.map((minutes) => {
                  const open = pickable && minutes >= (column.pickableFrom ?? -Infinity);
                  return (
                    <div
                      key={minutes}
                      onClick={open ? () => onPick(column.key, minutes) : undefined}
                      className={cn(
                        "group flex items-center gap-1 px-2 text-caption text-action",
                        minutes % 60 === 0 && "border-t border-line",
                        open && "cursor-pointer hover:bg-action-soft",
                      )}
                      style={{ height: STEP_PX }}
                    >
                      {open && (
                        <span className="hidden items-center gap-1 font-bold group-hover:flex">
                          <Plus size={14} strokeWidth={2.5} />
                          {formatClock(timeOf(minutes))}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <ul aria-label={column.title} className="pointer-events-none absolute inset-0">
                {own.map((item) => {
                  const { lane, lanes } = placed.get(item.key)!;
                  return (
                    <li
                      key={item.key}
                      className="pointer-events-auto absolute p-0.5"
                      style={{
                        top: top(item.start),
                        height: Math.max(item.end - item.start, step) * (STEP_PX / step),
                        left: `${(lane / lanes) * 100}%`,
                        width: `${100 / lanes}%`,
                      }}
                    >
                      <span className="sr-only">{item.label}</span>
                      <div aria-hidden="true" className="h-full">
                        {item.content}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
