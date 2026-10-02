import { describe, expect, it } from "vitest";

import { ERROR_MESSAGES } from "@/constants/messages";

import { AppError } from "@/lib/errors/AppError";
import { errorMessage } from "@/lib/errors/errorMessage";
import { notFoundError } from "@/lib/errors/kinds";

describe("errorMessage", () => {
  it("shows the app's own wording for its own errors", () => {
    expect(errorMessage(notFoundError("RECORD_NOT_FOUND"))).toBe(ERROR_MESSAGES.RECORD_NOT_FOUND);
  });

  it("falls back to the catalogue for anything else, never the internals", () => {
    expect(errorMessage(new TypeError("Failed to fetch"), "EXTERNAL_SERVICE_ERROR")).toBe(
      ERROR_MESSAGES.EXTERNAL_SERVICE_ERROR,
    );
  });
});

describe("errorMessage, for the browser's own errors", () => {
  it("shows the words an API refusal already carries", () => {
    const refusal = Object.assign(new Error("That slot is taken."), { code: "CONFLICT" });
    expect(errorMessage(refusal)).toBe("That slot is taken.");
  });

  it("falls back when an error has no words, or no code the app chose", () => {
    expect(errorMessage(new AppError({ kind: "INTERNAL", code: "INTERNAL_ERROR", message: "" }))).toBe(
      ERROR_MESSAGES.INTERNAL_ERROR,
    );
    expect(errorMessage(Object.assign(new Error(""), { code: "CONFLICT" }))).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    expect(errorMessage(Object.assign(new Error("boom"), { code: 42 }))).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    expect(errorMessage("a string")).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
  });
});
