import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { apiRoutes, withQuery } from "@/lib/query/keys";

describe("apiRoutes", () => {
  it("names every endpoint the browser calls, once", () => {
    expect(apiRoutes.auth).toEqual({
      register: "/api/auth/register",
      session: "/api/auth/session",
      login: "/api/auth/login",
      logout: "/api/auth/logout",
      refresh: "/api/auth/refresh",
      confirm: "/api/auth/confirm",
      resendConfirmation: "/api/auth/resend-confirmation",
      passwordReset: "/api/auth/password-reset",
      passwordResetComplete: "/api/auth/password-reset/complete",
      password: "/api/auth/password",
      profile: "/api/auth/profile",
    });
  });

  it("names the catalogues, each one entry at its own address", () => {
    expect(apiRoutes.services.one("s-1")).toBe("/api/services/s-1");
    expect(apiRoutes.appointmentTypes.one("a-1")).toBe("/api/appointment-types/a-1");
    expect(apiRoutes.expenseCategories.one("c-1")).toBe("/api/expense-categories/c-1");
  });

  it("names only routes that exist", () => {
    for (const named of Object.values(apiRoutes).flatMap(Object.values)) {
      const route = typeof named === "function" ? named("[id]") : named;
      expect(existsSync(join(process.cwd(), "src/app", route, "route.ts")), route).toBe(true);
    }
  });
});

describe("withQuery", () => {
  it("adds the values given, and nothing for one left empty", () => {
    expect(withQuery("/api/patients", { tab: "OWING", search: "", doctor: null, from: undefined })).toBe(
      "/api/patients?tab=OWING",
    );
    expect(withQuery("/api/patients", { search: "Anu Sharma" })).toBe("/api/patients?search=Anu+Sharma");
  });

  it("asks for exactly the route when nothing is given", () => {
    expect(withQuery("/api/patients", { search: "" })).toBe("/api/patients");
  });

  it("adds to a query the route already has", () => {
    expect(withQuery("/api/patients?tab=OWING", { cursor: "20" })).toBe("/api/patients?tab=OWING&cursor=20");
  });
});
