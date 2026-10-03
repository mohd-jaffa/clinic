import type { SupabaseClient } from "@supabase/supabase-js";

/** One query as a data function built it: the table, then each builder call in order. */
export interface RecordedQuery {
  table: string;
  calls: [string, ...unknown[]][];
}

export interface FakeAnswer {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

export interface FakeSupabaseOptions {
  /** What the database answers each query with; a query on any table answers nothing by default. */
  answer?: (query: RecordedQuery) => FakeAnswer;
  /** What each function answers, by name. */
  rpc?: (name: string, args: unknown) => FakeAnswer;
  /** Supabase Auth's methods the test needs, `admin` among them; each a vi.fn() as a rule. */
  auth?: Record<string, unknown>;
  /** What Storage answers each call with — `upload`, `remove`, `download` — by method. */
  storage?: (method: string, bucket: string, args: unknown[]) => FakeAnswer;
}

/** One call to Storage: the method, the bucket and its arguments. */
export interface RecordedStorageCall {
  method: string;
  bucket: string;
  args: unknown[];
}

/** A builder whose every method records itself and chains, and which answers once awaited. */
function chain(calls: [string, ...unknown[]][], settle: () => FakeAnswer): object {
  const builder: object = new Proxy(
    {},
    {
      get(_, property) {
        if (property === "then") {
          return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve()
              .then(() => ({ data: null, error: null, count: null, ...settle() }))
              .then(resolve, reject);
        }
        return (...args: unknown[]) => {
          calls.push([String(property), ...args]);
          return builder;
        };
      },
    },
  );
  return builder;
}

/**
 * A Supabase client for a unit test (ported from Brio). Every builder method
 * records its call and chains; awaiting the query at any point answers with
 * what `answer` says the database returned for it. Tests read `queries` and
 * `rpcs` to see what was asked, and `find` to pick a query out by a call it
 * made.
 */
export function fakeSupabase({
  answer = () => ({ data: null }),
  rpc,
  auth = {},
  storage = () => ({ data: null }),
}: FakeSupabaseOptions = {}) {
  const queries: RecordedQuery[] = [];
  const rpcs: { name: string; args: unknown }[] = [];
  /** What was chained onto each function call, in the order called: `[["select", "id"]]`. */
  const rpcChains: [string, ...unknown[]][][] = [];
  const storageCalls: RecordedStorageCall[] = [];
  const client = {
    auth,
    from(table: string) {
      const query: RecordedQuery = { table, calls: [] };
      queries.push(query);
      return chain(query.calls, () => answer(query));
    },
    // A function answers once awaited, and chains first when a set-returning one is narrowed (`.select()`).
    rpc(name: string, args?: unknown) {
      const calls: [string, ...unknown[]][] = [];
      rpcs.push({ name, args });
      rpcChains.push(calls);
      return chain(calls, () => rpc?.(name, args) ?? {});
    },
    storage: {
      from: (bucket: string) =>
        new Proxy(
          {},
          {
            get:
              (_, method) =>
              async (...args: unknown[]) => {
                storageCalls.push({ method: String(method), bucket, args });
                return { data: null, error: null, ...storage(String(method), bucket, args) };
              },
          },
        ),
    },
  };

  /** The arguments of each call a query made to `method`. */
  const argsOf = (query: RecordedQuery, method: string) =>
    query.calls.filter(([name]) => name === method).map(([, ...args]) => args);

  /** The first query on `table` whose calls include `method` with these leading arguments. */
  const find = (table: string, method: string, ...args: unknown[]) =>
    queries.find(
      (query) =>
        query.table === table &&
        argsOf(query, method).some((given) =>
          args.every(
            (arg, index) => Object.is(given[index], arg) || JSON.stringify(given[index]) === JSON.stringify(arg),
          ),
        ),
    );

  return { client: client as unknown as SupabaseClient, queries, rpcs, rpcChains, storageCalls, argsOf, find };
}

/** A PostgREST error as supabase-js hands it back. */
export function postgrestError(code: string, message = "database said no") {
  return { code, message, details: "", hint: "", name: "PostgrestError" };
}

/** A Supabase Auth error as supabase-js hands it back. */
export function authError(code: string, message = "auth said no") {
  return { code, message, name: "AuthApiError", status: 400 };
}
