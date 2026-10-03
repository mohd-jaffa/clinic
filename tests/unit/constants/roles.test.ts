import { describe, expect, it } from "vitest";

import {
  CLINIC_ROLE_LABELS,
  CLINIC_ROLES,
  INVITE_ROLES,
  PLATFORM_ROLE_LABELS,
  PLATFORM_ROLES,
} from "@/constants/roles";

describe("roles (plan §3)", () => {
  it("are the owner, doctors and staff in a clinic, and the DEV on the platform", () => {
    expect(CLINIC_ROLES).toEqual(["OWNER", "DOCTOR", "STAFF"]);
    expect(PLATFORM_ROLES).toEqual(["DEV"]);
  });

  it("invite a doctor or staff — never another owner (plan §8.4)", () => {
    expect(INVITE_ROLES).toEqual(["DOCTOR", "STAFF"]);
  });

  it("each have words to show", () => {
    expect(Object.keys(CLINIC_ROLE_LABELS)).toEqual([...CLINIC_ROLES]);
    expect(Object.keys(PLATFORM_ROLE_LABELS)).toEqual([...PLATFORM_ROLES]);
  });
});
