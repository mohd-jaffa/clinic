import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reading the migrations and the Supabase config as text, for the DB contract
 * tests (AGENTS.md §25): each keeps a CHECK, a default or a bound equal to the
 * constant the app holds for it.
 */
const MIGRATIONS = join(process.cwd(), "supabase/migrations");

/** Every migration's file name, in the order they apply. */
export function migrationNames(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

/** A migration's text, by its file name. */
export function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS, name), "utf8");
}

/** Every migration's text, one after the other. */
export function allMigrations(): string {
  return migrationNames().map(readMigration).join("\n");
}

/** The quoted words in a piece of SQL, in order: `'A', 'B'` → ["A", "B"]. */
export function quoted(sql: string): string[] {
  return [...sql.matchAll(/'([^']*)'/g)].map((match) => match[1]);
}

/** The values a column's `check (column in (...))` allows, in order. */
export function checkedValues(sql: string, column: string): string[] {
  const match = new RegExp(`check \\(${column} in \\(([^)]*)\\)\\)`).exec(sql);
  if (!match) throw new Error(`No CHECK lists the values of ${column}`);
  return quoted(match[1]);
}

/** A column's definition, up to the end of its line. */
export function columnLine(sql: string, table: string, column: string): string {
  const body = tableBody(sql, table);
  const line = body.split("\n").find((text) => new RegExp(`^\\s*${column} `).test(text));
  if (!line) throw new Error(`No column ${column} in ${table}`);
  return line;
}

/** The text of a table's `create table` statement, columns and constraints. */
export function tableBody(sql: string, table: string): string {
  const match = new RegExp(`create table public\\.${table} \\(\\n([\\s\\S]*?)\\n\\);`).exec(sql);
  if (!match) throw new Error(`No table ${table}`);
  return match[1];
}

/** The `max` a column's is_clean_line / is_clean_text check bounds it to. */
export function cleanTextLimit(sql: string, table: string, column: string): number {
  const match = /is_clean_(?:line|text)\(\w+, (\d+)\)/.exec(columnLine(sql, table, column));
  if (!match) throw new Error(`${table}.${column} is not checked as clean text`);
  return Number(match[1]);
}

/** The bounds of a column's `check (column between min and max)`. */
export function betweenBounds(sql: string, table: string, column: string): { min: number; max: number } {
  const match = new RegExp(`check \\(${column} between (\\d+) and (\\d+)\\)`).exec(columnLine(sql, table, column));
  if (!match) throw new Error(`${table}.${column} has no between check`);
  return { min: Number(match[1]), max: Number(match[2]) };
}

/** A function's whole definition, from `create or replace function` to its closing `$$;`. */
export function functionBody(sql: string, name: string): string {
  const match = new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`).exec(sql);
  if (!match) throw new Error(`No function ${name}`);
  return match[0];
}

/** supabase/config.toml's text. */
export function readSupabaseConfig(): string {
  return readFileSync(join(process.cwd(), "supabase/config.toml"), "utf8");
}

/** The settings of one `[section]` of a TOML file, up to the next section. */
export function tomlSection(toml: string, section: string): string {
  const start = toml.indexOf(`\n[${section}]\n`);
  if (start < 0) throw new Error(`No [${section}] section`);
  const rest = toml.slice(start + section.length + 4);
  const end = rest.search(/\n\[/);
  return end < 0 ? rest : rest.slice(0, end);
}

/** A setting's raw value in a TOML section's text: `key = value`. */
export function tomlValue(section: string, key: string): string {
  const match = new RegExp(`^${key} = (.+)$`, "m").exec(section);
  if (!match) throw new Error(`No ${key}`);
  return match[1].trim();
}
