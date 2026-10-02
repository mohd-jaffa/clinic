import { ERROR_LOG_LIMITS } from "@/constants/limits";
import type { ErrorSource } from "@/constants/statuses";
import { logger, redactSensitive } from "@/lib/logger";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/** One failure, as the code that met it describes it. */
export interface ErrorCapture {
  /** What failed, in words: the line the server's output carries. */
  message: string;
  /** Where it happened; the server's own work unless said. */
  source?: ErrorSource;
  /** The thrown value, when there is one: its message and stack are kept. */
  error?: unknown;
  /** What the person was shown to quote: a request's id, or a screen's digest. */
  reference?: string;
  code?: string;
  kind?: string;
  httpStatus?: number;
  method?: string;
  path?: string;
  userId?: string | null;
  clinicId?: string | null;
  /** Anything else that helps; redacted as the logger redacts it. */
  context?: Record<string, unknown>;
}

function clip(value: string | undefined, max: number): string | null {
  if (value === undefined) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** A thrown value's own message and stack: an Error's, or the value itself written out. */
function describe(error: unknown): { detail?: string; stack?: string } {
  if (error === undefined) return {};
  if (error instanceof Error) return { detail: error.message, stack: error.stack };
  if (typeof error === "string") return { detail: error };
  try {
    return { detail: JSON.stringify(error) };
  } catch {
    return { detail: String(error) };
  }
}

/**
 * The central error logger (plan §36): what failed on the server goes to the
 * server's output, and to `error_logs`, which only the developer console
 * reads. It is written through the service role, and kept
 * `error_log_keep_days` (a platform setting). The context is redacted by key,
 * so a patient's details never reach it (plan §27.6).
 *
 * It never throws: whatever failed has already failed, and a log that cannot
 * be written must not become a second failure. What it could not write is
 * still in the output.
 */
export async function captureError(capture: ErrorCapture): Promise<void> {
  const { message, source = "SERVER", error, reference, context, ...where } = capture;
  const { detail, stack } = describe(error);
  logger.error(message, { source, ...where, ...context, detail }, reference);

  try {
    const { error: failed } = await createSupabaseServiceRoleClient()
      .from("error_logs")
      .insert({
        source,
        message: clip(message, ERROR_LOG_LIMITS.message),
        reference: reference ?? null,
        code: where.code ?? null,
        kind: where.kind ?? null,
        http_status: where.httpStatus ?? null,
        method: where.method ?? null,
        path: clip(where.path, ERROR_LOG_LIMITS.path),
        user_id: where.userId ?? null,
        clinic_id: where.clinicId ?? null,
        detail: clip(detail, ERROR_LOG_LIMITS.detail),
        stack: clip(stack, ERROR_LOG_LIMITS.stack),
        context: context === undefined ? null : redactSensitive(context),
      });
    if (failed) logger.error("Error log not written", { code: failed.code }, reference);
  } catch (thrown) {
    logger.error(
      "Error log not written",
      { reason: thrown instanceof Error ? thrown.message : String(thrown) },
      reference,
    );
  }
}
