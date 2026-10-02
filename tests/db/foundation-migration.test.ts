import { describe, expect, it } from "vitest";

import { PHONE_NUMBER_DIGITS, TEXT_LIMITS } from "@/constants/limits";
import { toE164India } from "@/lib/phone";
import { EMAIL, PHONE_NUMBER } from "@/lib/validation/primitives";
import { functionBody, readMigration } from "@tests/support/sql";

const sql = readMigration("0001_foundation.sql");

describe("0001 foundation", () => {
  it("installs the extensions the schema is built on, in the extensions schema", () => {
    for (const extension of ["pgcrypto", "citext", "pg_trgm", "btree_gist", "pg_cron", "pg_net"]) {
      expect(sql).toContain(`create extension if not exists ${extension} with schema extensions;`);
    }
  });

  it("opens nothing by default: no function to PUBLIC, no table, sequence or function to the API roles", () => {
    expect(sql).toContain("alter default privileges for role postgres revoke execute on functions from public;");
    for (const kind of ["tables", "sequences", "functions"]) {
      expect(sql).toContain(
        `alter default privileges for role postgres in schema public revoke all on ${kind} from anon, authenticated;`,
      );
    }
    expect(sql).toContain("grant usage on schema public to authenticated, service_role;");
  });

  it("names who wrote a row from the session, and keeps who made it", () => {
    const actor = functionBody(sql, "set_actor");
    expect(actor).toContain("new.created_by = coalesce(auth.uid(), new.created_by);");
    expect(actor).toContain("elsif auth.uid() is not null then\n    new.created_by = old.created_by;");
    expect(actor).toContain("new.updated_by = coalesce(auth.uid(), new.updated_by);");
  });

  it("checks text as the app normalises it: trimmed, composed, no control or zero-width character", () => {
    const line = functionBody(sql, "is_clean_line");
    expect(line).toContain("value = btrim(value)");
    expect(line).toContain("value is nfc normalized");
    expect(line).toContain("value !~ '[\\x01-\\x1f\\x7f-\\x9f​-‍﻿]'");
    const text = functionBody(sql, "is_clean_text");
    expect(text).toContain("value = btrim(value, E' \\n')");
    expect(text).toContain("value !~ '[\\x01-\\x09\\x0b-\\x1f\\x7f-\\x9f​-‍﻿]'");
  });

  it("checks a mobile as src/lib/phone.ts stores it", () => {
    const pattern = new RegExp(/value ~ '([^']+)'/.exec(functionBody(sql, "is_indian_mobile"))![1]);
    for (const typed of ["98765 43210", "+91 98765-43210", "09876543210", "6000000000"]) {
      expect(toE164India(typed)).toMatch(pattern);
    }
    for (const stored of ["9876543210", "+915876543210", "+9198765432100"]) expect(stored).not.toMatch(pattern);
  });

  it("checks a phone number and an email by the same patterns and bounds as the forms", () => {
    const phone = functionBody(sql, "is_phone_number");
    expect(phone).toContain(`char_length(value) <= ${TEXT_LIMITS.phoneNumber}`);
    expect(phone).toContain(`value ~ '${PHONE_NUMBER.source}'`);
    expect(phone).toContain(`between ${PHONE_NUMBER_DIGITS.min} and ${PHONE_NUMBER_DIGITS.max}`);

    const email = functionBody(sql, "is_email");
    expect(email).toContain(`char_length(value) <= ${TEXT_LIMITS.email}`);
    expect(email).toContain(`value ~ '${EMAIL.source}'`);
  });

  it("lets a signed-in member's write run the checks, and nothing more", () => {
    for (const fn of [
      "is_clean_line(text, integer)",
      "is_clean_text(text, integer)",
      "is_indian_mobile(text)",
      "is_phone_number(text)",
      "is_email(text)",
    ]) {
      expect(sql).toContain(`grant execute on function public.${fn} to authenticated;`);
    }
  });
});
