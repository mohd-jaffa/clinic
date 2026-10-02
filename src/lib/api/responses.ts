import { NextResponse } from "next/server";

import { type ErrorMessageCode, getErrorMessage } from "@/constants/messages";
import type { AppError } from "@/lib/errors";

/**
 * The two shapes every endpoint answers with (AGENTS.md §26). Built here and
 * nowhere else, so the contract cannot drift route by route.
 */
export interface ApiSuccessPayload<TData> {
  success: true;
  data: TData;
}

export interface ApiErrorPayload {
  success: false;
  error: {
    code: ErrorMessageCode;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export function buildErrorPayload(error: AppError, requestId: string): ApiErrorPayload {
  return {
    success: false,
    error: {
      code: error.code,
      message: getErrorMessage(error.code),
      requestId,
      details: error.details,
    },
  };
}

/**
 * Every answer names its request, and none is kept by a browser or a proxy:
 * an answer may carry patient data (AGENTS.md §12).
 */
function withRequestId(requestId: string) {
  return { "x-request-id": requestId, "Cache-Control": "no-store" };
}

export function successResponse<TData>(
  data: TData,
  requestId: string,
  status = 200,
): NextResponse<ApiSuccessPayload<TData>> {
  return NextResponse.json({ success: true, data } as const, { status, headers: withRequestId(requestId) });
}

export function errorResponse(error: AppError, requestId: string): NextResponse<ApiErrorPayload> {
  return NextResponse.json(buildErrorPayload(error, requestId), {
    status: error.httpStatus,
    headers: withRequestId(requestId),
  });
}
