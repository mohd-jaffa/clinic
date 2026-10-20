/** An embedded row as PostgREST may give it: one, a list of at most one, or none. */
export type Embedded<Row> = Row | Row[] | null;

/**
 * An embedded row, however PostgREST gives it: one, a list of at most one,
 * or none — a one-to-one it cannot prove from the keys comes as a list.
 */
export const oneOf = <Row>(embedded: Embedded<Row> | undefined): Row | null =>
  Array.isArray(embedded) ? (embedded[0] ?? null) : (embedded ?? null);
