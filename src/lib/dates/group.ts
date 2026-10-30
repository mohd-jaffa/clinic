/**
 * Rows grouped by their day, in the order they came: a list already the
 * newest first stays so, each day's rows in their own order — the day's
 * expenses (D332), the clinic's activity (D390).
 */
export function byDay<T>(rows: readonly T[], dayOf: (row: T) => string): { day: string; rows: T[] }[] {
  const days: { day: string; rows: T[] }[] = [];
  for (const row of rows) {
    const day = dayOf(row);
    const last = days.at(-1);
    if (last?.day === day) last.rows.push(row);
    else days.push({ day, rows: [row] });
  }
  return days;
}
