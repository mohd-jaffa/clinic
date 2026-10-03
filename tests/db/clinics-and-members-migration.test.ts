import { describe, expect, it } from "vitest";

import { MAX_AMOUNT_PAISE, TEXT_LIMITS } from "@/constants/limits";
import { PERMISSION_DEPENDENCIES, PERMISSIONS } from "@/constants/permissions";
import { CLINIC_ROLES } from "@/constants/roles";
import { DEFAULT_CLINIC_SETTINGS } from "@/constants/seeds";
import { CLINIC_TYPES, FEE_TIMINGS, MEMBER_STATUSES, PAPER_SIZES } from "@/constants/statuses";
import { CLINIC_TIME_ZONE } from "@/lib/dates/calendar";
import {
  betweenBounds,
  checkedValues,
  cleanTextLimit,
  columnLine,
  functionBody,
  latestFunctionBody,
  quoted,
  readMigration,
} from "@tests/support/sql";

const sql = readMigration("0003_clinics_and_members.sql");

describe("0003 clinics", () => {
  it("knows the clinic types, paper sizes and fee timings the app knows", () => {
    expect(checkedValues(sql, "clinic_type")).toEqual([...CLINIC_TYPES]);
    expect(checkedValues(sql, "paper_size")).toEqual([...PAPER_SIZES]);
    expect(checkedValues(sql, "fee_timing")).toEqual([...FEE_TIMINGS]);
  });

  it("starts a clinic on the settings in seeds.ts, in the clinic timezone", () => {
    expect(columnLine(sql, "clinics", "paper_size")).toContain(`default '${DEFAULT_CLINIC_SETTINGS.paperSize}'`);
    expect(columnLine(sql, "clinics", "fee_timing")).toContain(`default '${DEFAULT_CLINIC_SETTINGS.feeTiming}'`);
    expect(columnLine(sql, "clinics", "timezone")).toContain(`default '${CLINIC_TIME_ZONE}'`);
    expect(checkedValues(sql, "timezone")).toEqual([CLINIC_TIME_ZONE]);
  });

  it("bounds every text as the forms do", () => {
    expect(cleanTextLimit(sql, "clinics", "name")).toBe(TEXT_LIMITS.clinicName);
    expect(cleanTextLimit(sql, "clinics", "address")).toBe(TEXT_LIMITS.address);
    expect(cleanTextLimit(sql, "clinics", "city")).toBe(TEXT_LIMITS.city);
    expect(columnLine(sql, "clinics", "phone")).toContain("public.is_phone_number(phone)");
    expect(columnLine(sql, "clinics", "email")).toContain("public.is_email(email::text)");
    expect(cleanTextLimit(sql, "clinic_members", "job_title")).toBe(TEXT_LIMITS.jobTitle);
    expect(cleanTextLimit(sql, "doctors", "specialization")).toBe(TEXT_LIMITS.doctorDetail);
    expect(cleanTextLimit(sql, "doctors", "qualifications")).toBe(TEXT_LIMITS.doctorDetail);
    expect(cleanTextLimit(sql, "doctors", "registration_number")).toBe(TEXT_LIMITS.registrationNumber);
    expect(betweenBounds(sql, "doctors", "consultation_fee_paise")).toEqual({ min: 0, max: MAX_AMOUNT_PAISE });
  });
});

describe("the permission catalogue, as the latest migration defines it (0003, 0015)", () => {
  const valid = latestFunctionBody("permissions_are_valid");

  it("knows exactly the permissions the app knows, in its order", () => {
    const catalogue = /permissions <@ array\[([\s\S]*?)\]::text\[\]/.exec(valid)![1];
    expect(quoted(catalogue)).toEqual([...PERMISSIONS]);
  });

  it("knows exactly the dependencies the app knows", () => {
    const pairs = /from \(values([\s\S]*?)\) as dependency/.exec(valid)![1];
    const inSql = [...pairs.matchAll(/\('([^']+)', '([^']+)'\)/g)].map(([, permission, needs]) => [permission, needs]);
    const inApp = Object.entries(PERMISSION_DEPENDENCIES).flatMap(([permission, needs]) =>
      needs!.map((needed) => [permission, needed]),
    );
    expect(inSql).toEqual(inApp);
  });

  it("refuses a name twice", () => {
    expect(valid).toContain(
      "cardinality(permissions) = (select count(distinct held) from unnest(permissions) as held)",
    );
  });
});

describe("0003 members", () => {
  it("knows the roles and statuses the app knows", () => {
    expect(checkedValues(sql, "role")).toEqual([...CLINIC_ROLES]);
    expect(checkedValues(sql, "status")).toEqual([...MEMBER_STATUSES]);
  });

  it("keeps the owner whole: every permission implicitly, none stored, always active", () => {
    expect(sql).toContain(
      "constraint clinic_members_owner_is_whole check (role <> 'OWNER' or (permissions = '{}' and status = 'ACTIVE'))",
    );
  });

  it("allows one owner per clinic (D24) and one clinic per person (D23)", () => {
    expect(sql).toContain(
      "create unique index clinic_members_one_owner on public.clinic_members (clinic_id) where role = 'OWNER';",
    );
    expect(sql).toContain(
      "create unique index clinic_members_one_clinic on public.clinic_members (user_id) where status in ('INVITED', 'ACTIVE');",
    );
  });

  it("checks every membership's permissions against the catalogue", () => {
    expect(columnLine(sql, "clinic_members", "permissions")).toContain(
      "check (public.permissions_are_valid(permissions))",
    );
  });

  it("gives a doctor profile only to an owner or doctor, in the membership's own clinic", () => {
    expect(sql).toContain(
      "foreign key (member_id, clinic_id) references public.clinic_members (id, clinic_id) on delete cascade",
    );
    expect(functionBody(sql, "check_doctor_member")).toContain("role in ('OWNER', 'DOCTOR')");
  });

  it("keeps the DEV out of every clinic, both ways (plan §3.2)", () => {
    expect(sql).toMatch(/create trigger clinic_members_not_developer[\s\S]*refuse_developer_membership\(\)/);
    expect(sql).toMatch(/create trigger profiles_developer_has_no_clinic[\s\S]*refuse_member_developer\(\)/);
  });
});

describe("0003 the RLS helpers", () => {
  it("count only an active membership, as security definers", () => {
    for (const helper of [
      "current_member",
      "current_clinic_id",
      "is_clinic_owner",
      "has_permission",
      "current_doctor_id",
    ]) {
      const body = functionBody(sql, helper);
      expect(body, helper).toContain("security definer");
      expect(body, helper).toContain("stable");
      expect(body, helper).toContain("status = 'ACTIVE'");
      expect(sql, helper).toMatch(
        new RegExp(`revoke all on function public\\.${helper}\\([^)]*\\) from public, anon;`),
      );
    }
  });

  it("give the owner every permission, anyone else what is stored", () => {
    expect(functionBody(sql, "has_permission")).toContain(
      "(member.role = 'OWNER' or permission = any (member.permissions))",
    );
  });

  it("let a member read their own clinic, team and doctors, and write none of it", () => {
    for (const table of ["clinics", "clinic_members", "doctors"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
    }
    expect(sql).toContain("grant select on public.clinics, public.clinic_members, public.doctors to authenticated;");
    expect(sql).not.toMatch(/grant (insert|update|delete)/);
    expect(sql).not.toMatch(/for (insert|update|delete|all)/);
  });
});
