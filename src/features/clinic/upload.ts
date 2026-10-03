import type { ErrorMessageCode } from "@/constants/messages";
import { MAX_LOGO_BYTES } from "@/constants/uploads";

import { isLogoMimeType } from "./logo";

/**
 * The browser's own look at a chosen logo, so an obvious mistake is caught
 * before anything is sent. It is a courtesy: the server reads the file's
 * bytes and its size again, and only that protects the bucket (AGENTS.md §20).
 */
export function checkLogoFile(file: File): ErrorMessageCode | null {
  if (!isLogoMimeType(file.type)) return "LOGO_TYPE_NOT_ALLOWED";
  if (file.size > MAX_LOGO_BYTES) return "LOGO_TOO_LARGE";
  return null;
}
