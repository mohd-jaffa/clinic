import { describe, expect, it } from "vitest";
import type { z } from "zod";

import * as validation from "@/lib/validation/index";

/**
 * Every message a schema can produce comes from the catalogue (AGENTS.md §24). This feeds each exported schema values a form or a hand-written
 * request could send — missing, blank, the wrong type, far too long, far too
 * large, not a number — at every depth, and fails if any message reads like
 * Zod's own English instead of ours.
 */

// The shapes of Zod's built-in messages ("Invalid input: expected string…",
// "Too big: expected string to have <=100 characters", "Invalid option…").
const ZODS_OWN_WORDING =
  /^(Invalid (input|option|string|email|url|uuid|date|datetime|ISO|element|key|union)|Too (big|small)|Unrecognized|Expected|Required$)|expected [a-z]/i;

const HOSTILE: unknown[] = [
  undefined,
  null,
  "",
  "   ",
  "x".repeat(5000),
  "not a value",
  Number.NaN,
  -1,
  1e15,
  1.5,
  {},
  [],
  true,
];

interface Def {
  type: string;
  innerType?: z.ZodType;
  in?: z.ZodType;
  element?: z.ZodType;
  shape?: Record<string, z.ZodType>;
}

const defOf = (schema: z.ZodType) => (schema as unknown as { _zod: { def: Def } })._zod.def;

/** A value shaped like the schema, with `leaf` in every place a value goes. */
function fill(schema: z.ZodType, leaf: unknown, depth = 0): unknown {
  if (depth > 6) return leaf;
  const def = defOf(schema);
  if (["optional", "nullable", "default", "prefault", "readonly", "catch"].includes(def.type) && def.innerType) {
    return fill(def.innerType, leaf, depth + 1);
  }
  if (def.type === "pipe" && def.in) return fill(def.in, leaf, depth + 1);
  if (def.type === "object" && def.shape) {
    return Object.fromEntries(Object.entries(def.shape).map(([key, field]) => [key, fill(field, leaf, depth + 1)]));
  }
  if (def.type === "array" && def.element) return [fill(def.element, leaf, depth + 1)];
  return leaf;
}

const schemas = Object.entries(validation as Record<string, unknown>).filter(
  (entry): entry is [string, z.ZodType] => typeof entry[1] === "object" && entry[1] !== null && "safeParse" in entry[1],
);

describe("every message comes from the catalogue", () => {
  it("finds the schemas to check", () => {
    expect(schemas.map(([name]) => name)).toEqual(expect.arrayContaining(["listQuerySchema", "cursorParam"]));
  });

  it.each(schemas)("%s never answers in Zod's own words", (_name, schema) => {
    const leaked = new Set<string>();
    for (const leaf of HOSTILE) {
      for (const input of [leaf, fill(schema, leaf)]) {
        const result = schema.safeParse(input);
        if (result.success) continue;
        for (const issue of result.error.issues) {
          if (ZODS_OWN_WORDING.test(issue.message)) leaked.add(`${issue.path.join(".")}: ${issue.message}`);
        }
      }
    }
    expect([...leaked]).toEqual([]);
  });
});
