import { describe, expect, it } from "vitest";

import {
  ADMIN_ROUTE,
  AUTH_ROUTES,
  HOME_ROUTE,
  LANDING_ROUTE,
  PRIVACY_ROUTE,
  TERMS_ROUTE,
  isPublicPath,
  returnToPath,
  signInPath,
} from "@/constants/routes";

describe("which screens need a session", () => {
  it("lets a signed-out visitor reach every account screen (plan §31)", () => {
    for (const path of Object.values(AUTH_ROUTES)) expect(isPublicPath(path)).toBe(true);
    expect(Object.values(AUTH_ROUTES)).toEqual([
      "/login",
      "/register",
      "/confirm-email",
      "/forgot-password",
      "/reset-password",
      "/accept-invite",
    ]);
  });

  it("keeps every clinic screen, and the console, behind a session", () => {
    for (const path of [HOME_ROUTE, ADMIN_ROUTE, "/queue", "/patients/p-1", "/settings"]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });

  it("puts the landing page and the legal pages where anyone can reach them", () => {
    expect([LANDING_ROUTE, PRIVACY_ROUTE, TERMS_ROUTE]).toEqual(["/", "/privacy", "/terms"]);
  });
});

describe("the sign-in detour", () => {
  it("remembers where the visitor was heading", () => {
    expect(signInPath("/patients/p-1")).toBe("/login?next=%2Fpatients%2Fp-1");
  });

  it("does not bother remembering Home", () => {
    expect(signInPath(HOME_ROUTE)).toBe(AUTH_ROUTES.signIn);
    expect(signInPath(null)).toBe(AUTH_ROUTES.signIn);
  });

  it("returns them to where they were", () => {
    expect(returnToPath("/billing?tab=OUTSTANDING")).toBe("/billing?tab=OUTSTANDING");
  });

  it("refuses to be turned into a redirect to another site", () => {
    expect(returnToPath("https://elsewhere.example/steal")).toBe(HOME_ROUTE);
    expect(returnToPath("//elsewhere.example/steal")).toBe(HOME_ROUTE);
  });

  it("never sends someone who just signed in back to an account screen", () => {
    expect(returnToPath(AUTH_ROUTES.signIn)).toBe(HOME_ROUTE);
    expect(returnToPath(`${AUTH_ROUTES.register}?x=1`)).toBe(HOME_ROUTE);
    expect(returnToPath(null)).toBe(HOME_ROUTE);
  });
});
