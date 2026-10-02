import { cn } from "./cn";

const SIZES = {
  sm: "size-9 text-caption",
  md: "size-11 text-small",
  lg: "size-14 text-title",
} as const;

/** On the ground a person is a small island of land; on the land, an ink chip. */
const ON = {
  ground: "bg-land text-land-ink",
  land: "bg-chip text-on-chip",
} as const;

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
// Each word has at least one letter: the name is split on its spaces, and empty words dropped.
const firstGrapheme = (word: string) => graphemes.segment(word)[Symbol.iterator]().next().value!.segment;

/**
 * Up to two initials: the first letters of the first and last words, so
 * "Priya Menon" is "PM" and "Asha" is "A". Whole letters, not code units, so
 * a name written in Devanagari keeps its first character whole.
 */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const picked = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return picked.map(firstGrapheme).join("").toLocaleUpperCase();
}

/**
 * A person as their initials (plan §32.2, Q13: no pictures). Decorative,
 * since the name is always written beside it.
 */
export function Avatar({
  name,
  size = "md",
  on = "ground",
}: {
  name: string;
  size?: keyof typeof SIZES;
  on?: keyof typeof ON;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold", SIZES[size], ON[on])}
    >
      {initials(name)}
    </span>
  );
}
