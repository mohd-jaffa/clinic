"use client";

import { Table2 } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";

import { cn } from "./cn";
import { Disclosure } from "./disclosure";

/** One column of the chart: its axis label, its name in full, and what rises and falls from the line. */
export interface BarPoint {
  /** Short, under the axis: "14". */
  label: string;
  /** In full, for the readout and the table: "Tue 14 Oct". */
  name: string;
  up: number;
  down: number;
}

/** Plain words around the chart, from the screen. */
export interface BarChartText {
  /** How to read it by keyboard: "Use the left and right arrow keys to read each day." */
  keys: string;
  showTable: string;
  hideTable: string;
  table: string;
  /** The table's first column: "Day". */
  column: string;
}

/** The smallest clean value at or above `value` — 1, 2 or 5 times a power of ten — for the axis's end. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((each) => value <= each * power)!;
  return step * power;
}

/** Each column's place among those beside it, by a key: Home and End the ends, the arrows one along. */
function stepped(key: string, from: number | null, count: number): number | null {
  const at = from ?? count - 1;
  if (key === "ArrowLeft") return Math.max(0, at - 1);
  if (key === "ArrowRight") return Math.min(count - 1, at + 1);
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/**
 * Columns rising above one line and falling below it (plan §18; D66, D354):
 * money in up, money out down, one column a day, on one axis — so a month's
 * days read side by side on a phone. Thin marks with 4 px rounded ends
 * anchored to the line; hairline rules at the axis's clean ends, labelled
 * in short amounts. The rising series is the action green, the falling one
 * the field edge's grey-green — told apart by place as much as by colour,
 * and named in the legend.
 *
 * A column pointed at, or reached with the arrow keys, shows its day and
 * both values in the readout above the plot, said as it changes. Every
 * value is in **Show as table** too, so the readout never gates one.
 */
export function BarChart({
  title,
  hint,
  points,
  upName,
  downName,
  format,
  formatAxis,
  text,
  tickEvery = 7,
}: {
  title: string;
  hint?: string;
  points: readonly BarPoint[];
  upName: string;
  downName: string;
  /** A value in full: "₹12,500". */
  format: (value: number) => string;
  /** A value on the axis: "₹20K". */
  formatAxis: (value: number) => string;
  text: BarChartText;
  /** Every how many columns the axis names one. */
  tickEvery?: number;
}) {
  const titleId = useId();
  const [active, setActive] = useState<number | null>(null);
  const top = niceCeiling(Math.max(0, ...points.map((point) => point.up)));
  const bottom = niceCeiling(Math.max(0, ...points.map((point) => point.down)));
  // One axis: the line sits where the two ends share the plot's height.
  const span = top + bottom || 1;
  const line = (top / span) * 100;
  const shown = active === null ? null : points[active];

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") return setActive(null);
    const next = stepped(event.key, active, points.length);
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  };

  return (
    <figure aria-labelledby={titleId} className="grid min-w-0 gap-3">
      <div>
        <figcaption id={titleId} className="text-title font-bold text-ink">
          {title}
        </figcaption>
        {hint && <p className="text-small text-muted">{hint}</p>}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small text-ink">
        {[
          { name: upName, tone: "bg-action" },
          { name: downName, tone: "bg-edge" },
        ].map((series) => (
          <li key={series.name} className="flex items-center gap-2">
            <span aria-hidden="true" className={cn("size-3 rounded-[3px]", series.tone)} />
            {series.name}
          </li>
        ))}
      </ul>
      {/* The readout: the day pointed at, or nothing — its height kept, so the plot never jumps. */}
      <p aria-live="polite" className="min-h-6 text-small text-ink tabular-nums">
        {shown && (
          <>
            <span className="font-bold">{shown.name}</span>
            {` · ${upName} ${format(shown.up)} · ${downName} ${format(shown.down)}`}
          </>
        )}
      </p>
      <div className="flex gap-2">
        <div aria-hidden="true" className="relative h-40 w-12 shrink-0 text-right text-caption text-muted tabular-nums">
          <span className="absolute right-0 -translate-y-1/2" style={{ top: "0%" }}>
            {formatAxis(top)}
          </span>
          <span className="absolute right-0 -translate-y-1/2" style={{ top: `${line}%` }}>
            {formatAxis(0)}
          </span>
          {bottom > 0 && (
            <span className="absolute right-0 -translate-y-1/2" style={{ top: "100%" }}>
              {formatAxis(bottom)}
            </span>
          )}
        </div>
        <div
          role="group"
          aria-label={`${title}. ${text.keys}`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="relative h-40 min-w-0 flex-1 rounded-sm focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-action"
        >
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-line" />
          <span aria-hidden="true" className="absolute inset-x-0 h-px bg-line" style={{ top: `${line}%` }} />
          {bottom > 0 && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-line" />}
          <div aria-hidden="true" className="absolute inset-0 flex">
            {points.map((point, index) => (
              <div
                key={point.name}
                data-column=""
                onPointerEnter={() => setActive(index)}
                onPointerDown={() => setActive(index)}
                className={cn("relative h-full flex-1", active === index && "bg-ink/5")}
              >
                {point.up > 0 && (
                  <span
                    className="absolute left-1/2 w-[min(70%,24px)] -translate-x-1/2 rounded-t-[4px] bg-action"
                    style={{ bottom: `${100 - line}%`, height: `${(point.up / span) * 100}%` }}
                  />
                )}
                {point.down > 0 && (
                  <span
                    className="absolute left-1/2 w-[min(70%,24px)] -translate-x-1/2 rounded-b-[4px] bg-edge"
                    style={{ top: `${line}%`, height: `${(point.down / span) * 100}%` }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="ml-14 flex text-caption text-muted tabular-nums">
        {points.map((point, index) => (
          <span key={point.name} className="flex-1 text-center">
            {index % tickEvery === 0 ? point.label : ""}
          </span>
        ))}
      </div>
      <Disclosure label={text.table} showLabel={text.showTable} hideLabel={text.hideTable} icon={Table2}>
        <div className="overflow-x-auto">
          <table className="w-full text-small tabular-nums">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th scope="col" className="py-2 font-bold">
                  {text.column}
                </th>
                <th scope="col" className="py-2 text-right font-bold">
                  {upName}
                </th>
                <th scope="col" className="py-2 text-right font-bold">
                  {downName}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.name} className="border-b border-line">
                  <th scope="row" className="py-2 text-left font-normal text-ink">
                    {point.name}
                  </th>
                  <td className="py-2 text-right text-ink">{format(point.up)}</td>
                  <td className="py-2 text-right text-ink">{format(point.down)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
    </figure>
  );
}
