import { describe, expect, it } from "vitest";

import { PRESCRIPTION_DAYS } from "@/constants/clinical";
import { PRESCRIPTION_MAX_ITEMS, TEXT_LIMITS } from "@/constants/limits";
import { isErrorMessageCode } from "@/constants/messages";
import { PRESCRIPTION_TIMINGS } from "@/constants/statuses";
import {
  betweenBounds,
  checkedValues,
  cleanTextLimit,
  columnLine,
  functionBody,
  quoted,
  readMigration,
  tableBody,
} from "@tests/support/sql";

const sql = readMigration("0023_prescription_templates.sql");
const templates = tableBody(sql, "prescription_templates");
const items = tableBody(sql, "prescription_template_items");

/** A policy's whole statement, by its name. */
const policy = (name: string) => new RegExp(`create policy ${name} [\\s\\S]*?;`).exec(sql)![0];

describe("0023 a prescription template (plan §13, §28.5; D240 – D243)", () => {
  it("hangs from the clinic and is one doctor's own", () => {
    expect(templates).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(templates).toContain("doctor_id uuid not null,");
    expect(templates).toContain("foreign key (doctor_id, clinic_id) references public.doctors (id, clinic_id)");
    expect(templates).toContain("unique (id, clinic_id)");
  });

  it("bounds its name and advice as the screen does, and is archived rather than deleted (D242)", () => {
    expect(cleanTextLimit(sql, "prescription_templates", "name")).toBe(TEXT_LIMITS.templateName);
    expect(columnLine(sql, "prescription_templates", "name")).toContain("text not null");
    expect(cleanTextLimit(sql, "prescription_templates", "advice")).toBe(TEXT_LIMITS.advice);
    expect(columnLine(sql, "prescription_templates", "advice")).toContain("is_clean_text");
    expect(columnLine(sql, "prescription_templates", "active")).toContain("boolean not null default true");
    for (const actor of ["created_by", "updated_by"]) {
      expect(columnLine(sql, "prescription_templates", actor)).toContain(
        "references public.profiles (id) on delete set null",
      );
    }
    expect(sql).toContain(
      "create trigger set_prescription_templates_actor before insert or update on public.prescription_templates",
    );
    expect(sql).toContain(
      "create trigger set_prescription_templates_updated_at before update on public.prescription_templates",
    );
  });

  it("holds one name in use for each doctor (D243)", () => {
    expect(sql).toContain(
      "create unique index prescription_templates_doctor_name_key\n  on public.prescription_templates (clinic_id, doctor_id, lower(name)) where active;",
    );
  });
});

describe("0023 a template's medicines", () => {
  it("are bounded as a prescription's are, the timing one of PRESCRIPTION_TIMINGS", () => {
    expect(cleanTextLimit(sql, "prescription_template_items", "medicine")).toBe(TEXT_LIMITS.medicine);
    expect(columnLine(sql, "prescription_template_items", "medicine")).toContain("text not null");
    expect(cleanTextLimit(sql, "prescription_template_items", "strength")).toBe(TEXT_LIMITS.strength);
    expect(cleanTextLimit(sql, "prescription_template_items", "dose")).toBe(TEXT_LIMITS.dose);
    expect(cleanTextLimit(sql, "prescription_template_items", "frequency")).toBe(TEXT_LIMITS.frequency);
    expect(cleanTextLimit(sql, "prescription_template_items", "instructions")).toBe(TEXT_LIMITS.instructions);
    expect(checkedValues(items, "timing")).toEqual([...PRESCRIPTION_TIMINGS]);
    expect(betweenBounds(sql, "prescription_template_items", "duration_days")).toEqual(PRESCRIPTION_DAYS);
    expect(betweenBounds(sql, "prescription_template_items", "position")).toEqual({
      min: 1,
      max: PRESCRIPTION_MAX_ITEMS,
    });
  });

  it("go with their template, in order", () => {
    expect(items).toContain("clinic_id uuid not null references public.clinics (id) on delete cascade");
    expect(items).toContain(
      "foreign key (template_id, clinic_id) references public.prescription_templates (id, clinic_id) on delete cascade",
    );
    expect(items).toContain("unique (template_id, position),");
  });
});

describe("0023 indexes (plan §37.1)", () => {
  it("lead with the clinic for a doctor's list, and cover each foreign key", () => {
    for (const index of [
      "create index prescription_templates_clinic_id_doctor_id_idx on public.prescription_templates (clinic_id, doctor_id);",
      "create index prescription_templates_created_by_idx on public.prescription_templates (created_by);",
      "create index prescription_templates_updated_by_idx on public.prescription_templates (updated_by);",
      "create index prescription_template_items_clinic_id_template_id_idx\n  on public.prescription_template_items (clinic_id, template_id);",
    ]) {
      expect(sql).toContain(index);
    }
  });
});

describe("0023 save_prescription_template (D240, D242, D243)", () => {
  const save = functionBody(sql, "save_prescription_template");

  it("is the caller's own, as a doctor, while the clinic can write", () => {
    expect(save).toContain("doctor uuid := public.current_doctor_id();");
    expect(save).toContain("if clinic is null or doctor is null then");
    expect(save).toContain("perform public.require_clinic_write(clinic);");
    expect(save).toContain(
      "where template.id = p_template_id and template.clinic_id = clinic and template.doctor_id = doctor",
    );
  });

  it("holds a medicine or advice, and at most as many medicines as a prescription", () => {
    expect(save).toContain(`jsonb_array_length(items) > ${PRESCRIPTION_MAX_ITEMS}`);
    expect(save).toContain("if jsonb_array_length(items) = 0 and template_advice is null then");
  });

  it("replaces another of the same name only when a new one was asked to (D243)", () => {
    expect(save).toContain("lower(template.name) = lower(template_name) and template.id is distinct from target");
    expect(save).toMatch(
      /if target is not null or not coalesce\(p_replace, false\) then\s+raise exception [^;]*'TEMPLATE_NAME_TAKEN'/,
    );
    expect(save).toContain("target := namesake;");
    expect(save).toMatch(
      /exception when unique_violation then\s+--[^\n]*\n\s+raise exception [^;]*'TEMPLATE_NAME_TAKEN'/,
    );
  });

  it("writes its medicines again in the order given, and hands back it before and after", () => {
    expect(save).toContain("delete from public.prescription_template_items where template_id = target;");
    expect(save).toContain("from jsonb_array_elements(items) with ordinality as line(item, position);");
    expect(save).toContain("'before', before, 'after', public.prescription_template_of(target)");
  });

  it("refuses only in the app's own words", () => {
    for (const hint of quoted(save.match(/hint = '[A-Z_]+'/g)!.join(" "))) {
      expect(isErrorMessageCode(hint)).toBe(true);
    }
  });
});

describe("0023 previous_prescription (D236)", () => {
  const previous = functionBody(sql, "previous_prescription");

  it("runs as the caller, so the policies hold", () => {
    expect(previous).not.toContain("security definer");
  });

  it("is the patient's latest with a medicine, from the visits before this one, on 0022's index", () => {
    expect(previous).toContain("where earlier.clinic_id = p_visit.clinic_id");
    expect(previous).toContain("and earlier.patient_id = p_visit.patient_id");
    expect(previous).toContain("and (earlier.created_at, earlier.id) < (p_visit.created_at, p_visit.id)");
    expect(previous).toContain(
      "and exists (select 1 from public.prescription_items as item where item.prescription_id = prescription.id)",
    );
    expect(previous).toMatch(/order by earlier\.created_at desc, earlier\.id desc\s+limit 1;/);
  });

  it("says its day, its doctor, its advice and its medicines in order", () => {
    for (const part of ["'day', earlier.visit_date", "'doctor_name'", "'advice', prescription.advice", "'items'"]) {
      expect(previous).toContain(part);
    }
    expect(previous).toContain("order by item.position)");
  });
});

describe("0023 policies and grants (plan §27.4)", () => {
  it("reads a template for its doctor and for whoever types for one, its medicines with it (D240, D241)", () => {
    expect(sql).toContain("alter table public.prescription_templates enable row level security;");
    expect(sql).toContain("alter table public.prescription_template_items enable row level security;");
    const read = policy("prescription_templates_select");
    expect(read).toContain("clinic_id = (select public.current_clinic_id())");
    expect(read).toContain(
      "(doctor_id = (select public.current_doctor_id()) or (select public.has_permission('prescriptions.write')))",
    );
    expect(policy("prescription_template_items_select")).toContain(
      "exists (select 1 from public.prescription_templates as template where template.id = template_id)",
    );
  });

  it("archives and restores a template by its doctor alone, while the clinic can write (D242)", () => {
    const change = policy("prescription_templates_update");
    expect(change).toContain("doctor_id = (select public.current_doctor_id())");
    expect(change).toContain("(select public.clinic_can_write())");
    expect(sql).toContain("grant update (active) on public.prescription_templates to authenticated;");
  });

  it("writes everything else only through save_prescription_template; nothing reaches the helper", () => {
    expect(sql).toContain("grant select on public.prescription_templates to authenticated;");
    expect(sql).toContain("grant select on public.prescription_template_items to authenticated;");
    expect(sql).not.toMatch(/grant (insert|delete)/);
    expect(sql.match(/grant update/g)).toHaveLength(1);
    for (const name of ["save_prescription_template(uuid, jsonb, boolean)", "previous_prescription(public.visits)"]) {
      expect(sql).toContain(`revoke all on function public.${name} from public, anon;`);
      expect(sql).toContain(`grant execute on function public.${name} to authenticated;`);
    }
    expect(sql).toContain(
      "revoke all on function public.prescription_template_of(uuid) from public, anon, authenticated;",
    );
  });
});
