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

/**
 * Which of `columns` changed, by name alone — for clinical text and a
 * patient's own details, whose words never reach the trail (plan §27.6). With
 * no `before`, those given a value.
 */
export function changedFields<Row extends object>(
  before: Row | null,
  after: Row,
  columns: readonly (keyof Row & string)[],
): string[] {
  return columns.filter((column) => (before === null ? after[column] !== null : before[column] !== after[column]));
}

/**
 * An audit row's changes for a write of `columns`: the values of each, except
 * those in `named`, listed by name alone under `fields` when any changed.
 */
export function auditedChanges<Row extends object>(
  before: Row | null,
  after: Row,
  columns: readonly (keyof Row & string)[],
  named: readonly string[] = [],
): Record<string, unknown> {
  const fields = changedFields(
    before,
    after,
    columns.filter((column) => named.includes(column)),
  );
  return {
    ...changedValues(
      before,
      after,
      columns.filter((column) => !named.includes(column)),
    ),
    ...(fields.length > 0 && { fields }),
  };
}
