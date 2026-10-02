import { ERROR_MESSAGES, type ErrorMessageCode, getErrorMessage } from "@/constants/messages";

/**
 * The one error class the app throws. Every failure a user can reach is one of
 * these — no ad hoc strings, no library error surfacing as it is (AGENTS.md
 * §13). It carries three things:
 *
 * - `code`   the catalogue code the API contract returns, whose wording comes
 *            from src/constants/messages.ts so client and server say the same.
 * - `kind`   the plan's error taxonomy, which fixes the HTTP status.
 * - `traceId` the id the logs carry, so a support report can find the request.
 *
 * Build one through the factories in ./kinds rather than calling this
 * constructor, so the kind and the status can never disagree.
 */
export type ErrorKind =
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS_RULE"
  | "EXTERNAL_SERVICE"
  | "NETWORK"
  | "INTERNAL";

/** The HTTP status each kind answers with. */
export const KIND_STATUS: Record<ErrorKind, number> = {
  VALIDATION: 400,
  AUTHENTICATION: 401,
  AUTHORIZATION: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_RULE: 422,
  EXTERNAL_SERVICE: 502,
  NETWORK: 503,
  INTERNAL: 500,
};

/** What an error looks like once it has crossed the wire. */
export interface AppErrorShape {
  code: ErrorMessageCode;
  message: string;
  traceId: string;
}

function newTraceId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `trace_${Date.now().toString(36)}`;
}

export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly code: ErrorMessageCode;
  readonly httpStatus: number;
  readonly traceId: string;
  readonly details?: unknown;
  readonly cause?: unknown;
  readonly isOperational = true;

  constructor(params: {
    kind: ErrorKind;
    code: ErrorMessageCode;
    message?: string;
    httpStatus?: number;
    traceId?: string;
    details?: unknown;
    cause?: unknown;
  }) {
    super(params.message ?? getErrorMessage(params.code));
    this.name = "AppError";
    this.kind = params.kind;
    this.code = params.code;
    this.httpStatus = params.httpStatus ?? KIND_STATUS[params.kind];
    this.traceId = params.traceId ?? newTraceId();
    this.details = params.details;
    this.cause = params.cause;
  }

  /** What is safe to send to a client: never the cause, never the details of internals. */
  toJSON(): AppErrorShape {
    return { code: this.code, message: this.message, traceId: this.traceId };
  }
}

export { ERROR_MESSAGES };
