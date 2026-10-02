import type { ZodType } from "zod";
import { ZodError } from "zod";

import type { ErrorMessageCode } from "@/constants/messages";
import { captureError } from "@/lib/audit/errorLog";
import { AppError, toAppError, validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

import { errorResponse, successResponse } from "./responses";

/**
 * What every route handler is wrapped in (AGENTS.md §26). One place decides
 * the response envelope, the request id that ties a failure to its log line,
 * and how a thrown value becomes an HTTP status — so no route repeats any of
 * it, and no route can answer in a shape the client does not expect.
 */
export interface ApiContext {
  requestId: string;
  /** Who is asking, once a guard knows: a failure is logged against them. */
  asker?: { userId: string; clinicId: string | null };
}

interface HandlerOptions {
  /** The status a success answers with; 200 unless the route creates something. */
  successStatus?: number;
}

/** The id this request is known by in the logs and in the error payload. */
export function createRequestId(headers?: Headers): string {
  return headers?.get("x-request-id")?.trim() || `req_${crypto.randomUUID()}`;
}

/**
 * The request's JSON body, parsed by `schema` when one is given. Validating
 * here rather than in each route means a malformed body and an invalid body
 * both answer with the same envelope and neither reaches the data layer.
 */
export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T>;
export async function readJson(request: Request): Promise<unknown>;
export async function readJson<T>(request: Request, schema?: ZodType<T>): Promise<T | unknown> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    throw validationError("VALIDATION_INVALID_JSON", { cause: String(error) });
  }
  return schema ? schema.parse(body) : body;
}

/**
 * The request's query, parsed by `schema`: each parameter's value as a string,
 * an empty one as absent. A list's filters, its search and its page are read
 * here, so a bad one answers with the same envelope as a bad body.
 */
export function readQuery<T>(request: Request, schema: ZodType<T>): T {
  const values: Record<string, string> = {};
  for (const [name, value] of new URL(request.url).searchParams) {
    if (value !== "" && !(name in values)) values[name] = value;
  }
  return schema.parse(values);
}

/**
 * A request's raw body, refused with `tooLarge` once it passes `maxBytes`.
 * The declared length is checked first, so an honest oversized upload is
 * turned away before any of it is read; the count is kept while reading too,
 * because a client may leave the length out or state it falsely.
 */
export async function readBody(
  request: Request,
  { maxBytes, tooLarge }: { maxBytes: number; tooLarge: ErrorMessageCode },
): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw validationError(tooLarge);
  if (!request.body) return new Uint8Array(0);

  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = request.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw validationError(tooLarge);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** Any thrown value as an AppError — a Zod failure keeps which field went wrong. */
export function normalizeApiError(error: unknown): AppError {
  if (error instanceof ZodError) {
    return validationError(
      "VALIDATION_ERROR",
      error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }
  return toAppError(error);
}

export async function withApiHandler<TData>(
  request: Request,
  handler: (context: ApiContext) => Promise<TData>,
  options: HandlerOptions = {},
) {
  const requestId = createRequestId(request.headers);
  const context: ApiContext = { requestId };

  try {
    const data = await handler(context);
    // A route that answers with a file (the logo) builds its own response; a
    // failure on the way still answers in the envelope below.
    if (data instanceof Response) return data;
    return successResponse(data, requestId, options.successStatus ?? 200);
  } catch (error) {
    const appError = normalizeApiError(error);
    const where = {
      kind: appError.kind,
      code: appError.code,
      httpStatus: appError.httpStatus,
      method: request.method,
      path: new URL(request.url).pathname,
      userId: context.asker?.userId,
      clinicId: context.asker?.clinicId,
    };

    // The cause is logged, never returned: it is the driver's own text, and it
    // names tables, columns and sometimes values (AGENTS.md §13). A fault of
    // the server's own also goes to the error log, under the reference the
    // person is shown (plan §36); a refusal — a 4xx — is the app working, and
    // goes to the output only.
    if (appError.httpStatus >= 500) {
      await captureError({
        source: "API",
        message: "API request failed",
        error: appError.cause ?? appError,
        reference: requestId,
        ...where,
        context: { traceId: appError.traceId, details: appError.details },
      });
    } else {
      logger.warn(
        "API request refused",
        {
          ...where,
          traceId: appError.traceId,
          details: appError.details,
          cause: appError.cause instanceof Error ? appError.cause.message : appError.cause,
        },
        requestId,
      );
    }

    return errorResponse(appError, requestId);
  }
}
