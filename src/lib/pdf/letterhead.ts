import { UI_TEXT } from "@/constants/messages";

import type { Composer } from "./layout";

/**
 * The clinic's letterhead (plan §33, D28, D218): what heads the bill and the
 * prescription — the clinic's own logo, name, address and phone, never the
 * app's. The app is credited only in the footer (D30).
 */
export interface Letterhead {
  name: string;
  /** As typed, on as many lines as it was. */
  address: string;
  city: string;
  phone: string | null;
  /** On a bill, when the clinic has one (plan §15.5). */
  gstin?: string | null;
  /** Whether a logo is drawn beside the name. */
  logo: boolean;
}

/** How large the logo is drawn, and the room beside it. */
const LOGO = 44;
const LOGO_GAP = 12;

/**
 * Lays the letterhead out at the top: the logo on the left — when there is
 * one — and beside it the name, then the address and the city on a line, then
 * the phone and the GSTIN, when given; a rule under the taller of the two.
 */
export function layoutLetterhead(page: Composer, letterhead: Letterhead) {
  const top = page.y;
  const x = letterhead.logo ? LOGO + LOGO_GAP : 0;
  if (letterhead.logo) page.logo(0, LOGO);
  page.text(letterhead.name, { face: "bold", size: 15, color: "ink" }, { x });
  page.space(1);
  const where = [...letterhead.address.split("\n"), letterhead.city]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  page.text(where, { face: "regular", size: 8, color: "muted" }, { x });
  if (letterhead.phone) page.text(letterhead.phone, { face: "regular", size: 8, color: "muted" }, { x });
  if (letterhead.gstin) {
    page.text(UI_TEXT.documents.gstin(letterhead.gstin), { face: "regular", size: 8, color: "muted" }, { x });
  }
  page.reach(top + (letterhead.logo ? LOGO : 0));
  page.space(10);
  page.rule({ color: "ink", weight: 0.8 });
}
