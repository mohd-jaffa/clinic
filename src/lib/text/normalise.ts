/**
 * What typed text is turned into before it is checked or stored (AGENTS.md §24).
 * The same rules on every field, so "Anu " and "Anu", or a name pasted from
 * WhatsApp with invisible characters in it, are one value and not two.
 */

// U+200B–U+200D and U+FEFF: invisible, and they arrive with text pasted from
// chat apps. A name that contains one never matches the name typed by hand.
const ZERO_WIDTH = /[​-‍﻿]/g;

// C0 and C1 control characters, other than the tab and the line breaks each
// kind of text deals with itself.
const CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/**
 * One line — a name, a city, a reference. Unicode is composed (NFC), invisible
 * and control characters go, every run of whitespace (tabs, line breaks,
 * non-breaking spaces) becomes one space, and the ends are trimmed.
 */
export function normaliseLine(text: string): string {
  return text.normalize("NFC").replace(ZERO_WIDTH, "").replace(CONTROLS, "").replace(/\s+/g, " ").trim();
}

/**
 * Several lines — an address, notes. As a line, but the line breaks stay:
 * Windows breaks become plain ones, each line loses its trailing spaces, more
 * than one blank line in a row becomes one, and the whole is trimmed.
 */
export function normaliseLines(text: string): string {
  return text
    .normalize("NFC")
    .replace(ZERO_WIDTH, "")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROLS, "")
    .replace(/\t/g, " ")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
