/**
 * The shapes Next.js hands a route segment, named once so no route writes
 * `{ params }: { params: Promise<{ id: string }> }` again.
 */
export interface RouteParams<K extends string> {
  params: Promise<Record<K, string>>;
}

/** A repeated query parameter given as one comma-separated value: `?products=a,b`. */
export function listParam(request: Request, name: string): string[] | undefined {
  const raw = new URL(request.url).searchParams.get(name);
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}
