import { AppError, externalServiceError } from "@/lib/errors";

/**
 * A mail server's failure as a person is told it: the outside service's,
 * never in the server's own words (AGENTS.md §13), with the server's error
 * kept as the cause for the log. An app error — mail not configured — is said
 * as itself.
 */
export function asMailFailure(error: unknown): AppError {
  return error instanceof AppError ? error : externalServiceError("EXTERNAL_SERVICE_ERROR", undefined, error);
}
