import { ERROR_MESSAGES, type ErrorMessageCode } from "@/constants/messages";
import { backOnline, isOnline, NETWORK_RETRY_DELAYS_MS } from "@/lib/network/connection";
import { apiRoutes } from "@/lib/query/keys";

/**
 * How the browser talks to the API. One place unwraps the success envelope,
 * turns a failure envelope back into an error carrying the server's own
 * wording, and sets the headers — so a feature's client module is a list of
 * endpoints and nothing else (AGENTS.md §26).
 *
 * Nothing here attaches a token: the session lives in HttpOnly cookies that
 * the browser sends on its own (AGENTS.md §9). What this does
 * own is the one thing every caller would otherwise repeat — when a request is
 * refused because the access token has expired, the session is refreshed once
 * and the request is sent again, so an hour of work does not end in an error.
 *
 * And when the connection drops (plan §21, D55): a write sent with its
 * idempotency key waits for it and goes again with the same key, so it lands
 * once however often it is sent; anything else is refused at once in the
 * app's own words, and what was typed stays on the screen for another try.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorMessageCode | "UNKNOWN_ERROR",
    message: string,
    readonly requestId?: string,
    /** What the refusal names, when it names something — the appointment it clashed with. */
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: ErrorMessageCode; message?: string; requestId?: string; details?: unknown };
}

const REFRESH_ROUTE = apiRoutes.auth.refresh;

/** The routes that establish or end a session; retrying one of them is nonsense. */
const NEVER_RETRIED = [
  REFRESH_ROUTE,
  apiRoutes.auth.login,
  apiRoutes.auth.logout,
  apiRoutes.auth.confirm,
  apiRoutes.auth.passwordResetComplete,
];

/**
 * At most one refresh is in flight. Several screens load at once, and without
 * this a single expiry would send one refresh per request — each rotating the
 * refresh token out from under the others.
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(REFRESH_ROUTE, { method: "POST" })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

/** Only for tests: forgets an in-flight refresh between cases. */
export function resetSessionRefresh() {
  refreshInFlight = null;
}

/** Sent with a write that must happen once however often it is sent (plan §15.2). */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** The server could not be reached: offline for certain, or online and still not answering. */
function unreached(): ApiError {
  const code = isOnline() ? "NETWORK_UNREACHABLE" : "NETWORK_OFFLINE";
  return new ApiError(0, code, ERROR_MESSAGES[code]);
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a request across the network. One with an idempotency key waits out
 * a dropped connection and goes again; while the device says it is online
 * but the server does not answer, it tries a few more times, a little apart,
 * then gives up. Anything else is refused at once.
 */
async function reach(url: string, init?: RequestInit): Promise<Response> {
  const keyed = new Headers(init?.headers).has(IDEMPOTENCY_HEADER);
  let failedOnline = 0;
  for (;;) {
    if (keyed) await backOnline();
    try {
      return await fetch(url, init);
    } catch (failure) {
      // A request that never reached the server; anything else is not ours to answer.
      if (!(failure instanceof TypeError)) throw failure;
      if (!keyed) throw unreached();
      if (isOnline()) {
        if (failedOnline === NETWORK_RETRY_DELAYS_MS.length) throw unreached();
        await pause(NETWORK_RETRY_DELAYS_MS[failedOnline++]);
      }
    }
  }
}

/** Sends a request; if the access token had expired, refreshes the session once and sends it again. */
async function request(url: string, init?: RequestInit): Promise<Response> {
  const attempt = () => reach(url, init);
  const response = await attempt();
  if (response.status === 401 && !NEVER_RETRIED.some((route) => url.startsWith(route))) {
    if (await refreshSession()) return attempt();
  }
  return response;
}

/** A failure envelope as an error carrying the server's own words. */
function refusal(response: Response, body: ApiEnvelope<unknown>): ApiError {
  return new ApiError(
    response.status,
    body.error?.code ?? "UNKNOWN_ERROR",
    body.error?.message ?? ERROR_MESSAGES.INTERNAL_ERROR,
    body.error?.requestId,
    body.error?.details,
  );
}

export async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await request(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok) throw refusal(response, body);
  return body.data as T;
}

/** A file the API answers with — a bill's or a prescription's PDF — or its refusal, as any other call's. */
export async function getFile(url: string): Promise<Blob> {
  const response = await request(url);
  if (!response.ok) throw refusal(response, await response.json().catch(() => ({})));
  return response.blob();
}

const send =
  <T>(method: string) =>
  (url: string, payload?: unknown, headers?: Record<string, string>): Promise<T> =>
    fetcher<T>(url, { method, headers, body: payload === undefined ? undefined : JSON.stringify(payload) });

export const getJson = <T>(url: string) => fetcher<T>(url);
export const postJson = <T>(url: string, payload?: unknown) => send<T>("POST")(url, payload);
/** A POST that the server makes once per key: a repeat returns what the first made. */
export const postOnce = <T>(url: string, payload: unknown, idempotencyKey: string) =>
  send<T>("POST")(url, payload, { [IDEMPOTENCY_HEADER]: idempotencyKey });
export const patchJson = <T>(url: string, payload?: unknown) => send<T>("PATCH")(url, payload);
export const putJson = <T>(url: string, payload?: unknown) => send<T>("PUT")(url, payload);
export const deleteJson = <T>(url: string) => send<T>("DELETE")(url);

/** A file as the whole body, with its own type: the logo upload (plan §9). */
export const postFile = <T>(url: string, file: Blob) =>
  fetcher<T>(url, {
    method: "POST",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
