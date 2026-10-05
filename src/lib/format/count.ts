/** A count as India writes it, for a figure on screen: 1,240 · 12,000 · 1,00,000. */
export function formatCount(value: number): string {
  return value.toLocaleString("en-IN");
}
