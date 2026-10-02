import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { getServerEnv } from "@/lib/env/server";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NODE_ENV: "test",
} as NodeJS.ProcessEnv;

describe("getServerEnv", () => {
  it("reads what the server needs", () => {
    expect(getServerEnv(base)).toEqual({ ...base });
  });

  it("counts a missing NODE_ENV as development", () => {
    const withoutNodeEnv = Object.fromEntries(Object.entries(base).filter(([key]) => key !== "NODE_ENV"));
    expect(getServerEnv(withoutNodeEnv as NodeJS.ProcessEnv).NODE_ENV).toBe("development");
  });

  it("refuses a missing or malformed value, naming it for the operator", () => {
    expect(() => getServerEnv({ ...base, NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow(AppError);
    try {
      getServerEnv({ ...base, SUPABASE_SERVICE_ROLE_KEY: "" });
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: "CONFIG_INVALID", kind: "INTERNAL" });
      expect((error as AppError).details).toEqual([expect.objectContaining({ path: "SUPABASE_SERVICE_ROLE_KEY" })]);
    }
  });

  it("reads process.env when given nothing", () => {
    expect(() => getServerEnv()).not.toThrow(TypeError);
  });
});
