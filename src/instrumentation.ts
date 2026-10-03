import type { Instrumentation } from "next";

import type { ErrorSource } from "@/constants/statuses";

/** Where Next met the failure, as the error log names it. */
const SOURCES: Record<string, ErrorSource> = { render: "SCREEN", route: "API" };

/**
 * What Next catches itself goes to the error log (plan §36, ported from Brio):
 * a screen the server could not draw, the proxy, and anything a route threw
 * before it could answer. A request the API refused or failed is logged by
 * `withApiHandler`, which answers it first. The reference is the digest the
 * error screen shows the person, and the query is left off the path: it is
 * never trusted to hold nothing of a patient (AGENTS.md §12).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureError } = await import("@/lib/audit/errorLog");
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  await captureError({
    source: SOURCES[context.routeType] ?? "SERVER",
    message: "Server could not finish a request",
    error,
    reference: digest,
    method: request.method,
    path: request.path.split("?")[0],
    context: { routePath: context.routePath, routeType: context.routeType, renderSource: context.renderSource },
  });
};
