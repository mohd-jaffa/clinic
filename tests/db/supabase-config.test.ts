import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { EMAIL_LINK_VALID_HOURS, PASSWORD_LENGTH } from "@/constants/limits";
import { readSupabaseConfig, tomlSection, tomlValue } from "@tests/support/sql";

/**
 * Supabase Auth's settings the app relies on (plan §5): kept equal to the
 * constants that promise the same thing. The hosted project's Auth settings
 * are set to match when production is set up (R13.8, docs/RELEASE.md).
 */
const config = readSupabaseConfig();
const auth = tomlSection(config, "auth");

describe("supabase/config.toml", () => {
  it("makes accounts only through the app: no one signs up with the public key", () => {
    expect(tomlValue(auth, "enable_signup")).toBe("false");
    expect(tomlValue(auth, "enable_anonymous_sign_ins")).toBe("false");
  });

  it("refuses a password shorter than the forms do", () => {
    expect(Number(tomlValue(auth, "minimum_password_length"))).toBe(PASSWORD_LENGTH.min);
  });

  it("keeps an email's link working as long as the email says", () => {
    expect(Number(tomlValue(tomlSection(config, "auth.email"), "otp_expiry"))).toBe(EMAIL_LINK_VALID_HOURS * 3600);
  });

  it("signs in by mobile with a password, sending no SMS (D39)", () => {
    const sms = tomlSection(config, "auth.sms");
    expect(tomlValue(sms, "enable_signup")).toBe("true");
    expect(tomlValue(sms, "enable_confirmations")).toBe("false");
  });

  it("lands an email's link on the dev server and on the built app the browser tests run", () => {
    expect(tomlValue(auth, "additional_redirect_urls")).toBe(
      '["http://localhost:3000/**", "http://localhost:3100/**"]',
    );
  });

  it("takes the app's mail on the port .env.example sends it to", () => {
    const env = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    const port = /^SMTP_PORT=(\d+)$/m.exec(env)![1];
    expect(tomlValue(tomlSection(config, "local_smtp"), "smtp_port")).toBe(port);
  });
});
