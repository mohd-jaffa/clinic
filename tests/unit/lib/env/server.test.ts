import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { getServerEnv } from "@/lib/env/server";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NODE_ENV: "test",
  TRIAL_CLAIM_SECRET: "a-secret-of-at-least-thirty-two-characters",
} as NodeJS.ProcessEnv;

const mail = {
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "55325",
  SMTP_SECURE: "false",
  SMTP_USER: "clinic",
  SMTP_PASSWORD: "secret",
  SMTP_FROM: "ClinicDesk <no-reply@clinicdesk.local>",
};

describe("getServerEnv", () => {
  it("reads what the server needs", () => {
    expect(getServerEnv(base)).toEqual({ ...base });
  });

  it("reads the mail settings as a port and a switch, and blank ones as unset", () => {
    expect(getServerEnv({ ...base, ...mail })).toMatchObject({
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: 55325,
      SMTP_SECURE: false,
      SMTP_FROM: "ClinicDesk <no-reply@clinicdesk.local>",
    });
    expect(getServerEnv({ ...base, ...mail, SMTP_SECURE: "true" }).SMTP_SECURE).toBe(true);
    const blank = getServerEnv({ ...base, SMTP_HOST: "", SMTP_PORT: "", SMTP_SECURE: "", SMTP_FROM: "" });
    expect(blank).toMatchObject({ SMTP_HOST: undefined, SMTP_PORT: undefined, SMTP_SECURE: undefined });
  });

  it("refuses a mail port or switch that is not one", () => {
    expect(() => getServerEnv({ ...base, SMTP_PORT: "70000" })).toThrow(AppError);
    expect(() => getServerEnv({ ...base, SMTP_SECURE: "yes" })).toThrow(AppError);
  });

  it("refuses a trial-claim secret too short to be one", () => {
    expect(() => getServerEnv({ ...base, TRIAL_CLAIM_SECRET: "short" })).toThrow(AppError);
  });

  it("reads the scheduler's secret, a blank one as unset, and refuses one too short (plan §22)", () => {
    const secret = "a-cron-secret-of-at-least-thirty-two-chars";
    expect(getServerEnv({ ...base, CRON_SECRET: secret }).CRON_SECRET).toBe(secret);
    expect(getServerEnv({ ...base, CRON_SECRET: "" }).CRON_SECRET).toBeUndefined();
    expect(() => getServerEnv({ ...base, CRON_SECRET: "short" })).toThrow(AppError);
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
