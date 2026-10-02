/**
 * Calling a route handler as the browser does, for its unit test: a JSON body,
 * the session cookie or bearer header when given, and the answer read back.
 */
export function apiRequest(
  path: string,
  { method = "POST", body, headers = {} }: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** A response's status and its parsed envelope. */
export async function answerOf(response: Response): Promise<{ status: number; body: Record<string, unknown> }> {
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

/** The clients a route makes, as stand-ins a test can recognise when they are passed on. */
export const supabaseClients = {
  createSupabaseAnonClient: () => "anon-client",
  createSupabaseServiceRoleClient: () => "service-client",
};
