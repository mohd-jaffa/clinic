import { describe, expect, it } from "vitest";

import { AppError, externalServiceError } from "@/lib/errors";
import { asMailFailure } from "@/lib/mail/failure";

describe("asMailFailure", () => {
  it("says a mail server's failure as the outside service's, keeping the server's error as the cause", () => {
    const server = new Error("535 5.7.8 Username and Password not accepted");
    const failure = asMailFailure(server);
    expect(failure).toBeInstanceOf(AppError);
    expect(failure).toMatchObject({ code: "EXTERNAL_SERVICE_ERROR", httpStatus: 502, cause: server });
    expect(failure.message).not.toContain("535");
  });

  it("leaves an app error as it is", () => {
    const notConfigured = externalServiceError("MAIL_NOT_CONFIGURED");
    expect(asMailFailure(notConfigured)).toBe(notConfigured);
  });
});
