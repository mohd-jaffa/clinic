/**
 * What an audit row says changed (AGENTS.md §14): each of `columns` whose
 * value differs, from what to what. With no `before` — a row just made —
 * every column is a change from nothing. Only for values that are not
 * clinical; clinical text is audited by its field names alone (plan §27.6).
 */
export function changedValues<Row extends object>(
  before: Row | null,
  after: Row,
  columns: readonly (keyof Row & string)[],
): Record<string, { from: unknown; to: unknown }> {
  return Object.fromEntries(
    columns
      .filter((column) => before === null || before[column] !== after[column])
      .map((column) => [column, { from: before === null ? null : before[column], to: after[column] }]),
  );
}
