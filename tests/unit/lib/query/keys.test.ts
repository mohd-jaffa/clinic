import { describe, expect, it } from "vitest";

import { apiRoutes, withQuery } from "@/lib/query/keys";

describe("apiRoutes", () => {
  it("names every endpoint the browser calls, once", () => {
    expect(apiRoutes.auth).toEqual({
      session: "/api/auth/session",
      login: "/api/auth/login",
      logout: "/api/auth/logout",
      refresh: "/api/auth/refresh",
      confirm: "/api/auth/confirm",
    });
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
