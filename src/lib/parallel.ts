/**
 * Reads that do not depend on each other, asked at once rather than one after
 * another: each is a round trip to the database, and a screen or a save waits
 * on the sum of the ones in a row.
 *
 * Unlike `Promise.all`, a failure is the first one **listed**, not the first
 * to arrive, once every read has answered. A function that used to check
 * "the order exists" before "the payment is new" still refuses for the order
 * first, whichever answer comes back sooner.
 */
export async function allInOrder<T extends readonly unknown[] | []>(
  values: T,
): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
  const results = (await Promise.allSettled(values)) as PromiseSettledResult<unknown>[];
  for (const result of results) if (result.status === "rejected") throw result.reason;
  return results.map((result) => (result as PromiseFulfilledResult<unknown>).value) as {
    -readonly [P in keyof T]: Awaited<T[P]>;
  };
}
