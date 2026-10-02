import { ERROR_MESSAGES, type ErrorMessageCode } from "@/constants/messages";

import { AppError } from "./AppError";

/**
 * The message to show for a failure. An AppError already speaks the app's
 * words — every error the data layer throws is one — so its message is shown.
 * Anything else (a dropped connection's TypeError, a library's own error) is
 * internals no one at the clinic should read, so the catalogue's text for what was
 * being attempted is shown instead (AGENTS.md §13).
 */
export function errorMessage(err: unknown, fallback: ErrorMessageCode = "INTERNAL_ERROR"): string {
  if (err instanceof AppError && err.message) return err.message;
  if (err instanceof Error && "code" in err && typeof err.code === "string" && err.message) {
    // An ApiError from the browser fetcher: the server already chose the words.
    return err.message;
  }
  return ERROR_MESSAGES[fallback];
}
