/**
 * Money is kept as whole paise, everywhere (AGENTS.md §16). Nothing in the app
 * holds an amount as a float: a rupee value typed into a form is converted
 * here, on its digits, and every total is added up in paise.
 */

/**
 * Rounds a rupee amount to the paisa the way the database's round(x, 2) does:
 * half away from zero, on the decimal digits as written.
 */
export function roundToPaise(amount: number): number {
  const magnitude = Math.abs(amount);
  const digits = magnitude.toPrecision(15);
  const paise = digits.includes("e") ? Math.round(magnitude * 100) : Math.round(Number(`${digits}e2`));
  const rounded = paise / 100;
  return amount < 0 && rounded !== 0 ? -rounded : rounded;
}

/**
 * Rupees as whole paise. Given the text a person typed ("499.50"), the digits
 * are read directly, so nothing passes through a float that cannot hold them —
 * `19.99 * 100` is 1998.9999999999998, and that is the bug this avoids.
 */
export function rupeesToPaise(amount: string | number): number {
  const text = typeof amount === "number" ? amount.toFixed(2) : amount.trim();
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return Math.round(roundToPaise(Number(text)) * 100);

  const [, sign, whole, fraction = ""] = match;
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return sign ? -paise : paise;
}

/**
 * Money as people write it — "1500", "₹1,500", "1,00,000.50", "₹ 250" — as whole
 * paise, or null when it is not an amount (AGENTS.md §24). The rupee
 * sign, spaces and commas are dropped wherever they sit, so Indian and
 * Western grouping both read; what is left must be digits with at most two
 * decimals. Never through a float.
 */
export function parseRupees(text: string): number | null {
  const digits = text.trim().replace(/^₹/, "").replace(/[\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(digits)) return null;
  return rupeesToPaise(digits);
}

/**
 * Whole paise as a money field holds them: "1500", "1500.50", "0" — the
 * digits worked out in integers, never through a float, so the field reads
 * back to exactly what was stored.
 */
export function paiseToText(paise: number): string {
  const rupees = Math.trunc(paise / 100);
  const rest = paise % 100;
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, "0")}`;
}

/** Whole paise as a rupee number, for display only — never for adding up. */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** Adds up paise amounts. Integers all the way, so nothing drifts. */
export function sumPaise(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}
