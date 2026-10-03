import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

import { admin } from "./integration";
import { followAuthLink } from "./mailpit";

/**
 * Every screen a journey visits is checked for accessibility as it stands
 * (plan §37: zero axe violations), at WCAG 2.2 AA; a failure names the
 * elements at fault.
 */
export async function expectAccessible(page: Page): Promise<void> {
  // A card or menu still fading in is checked as it will stand, not halfway
  // there: its colours mid-fade are blends no one reads. A pulse that never
  // ends is not waited for.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(
    results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.help} — ${violation.nodes.map((node) => `${node.target.join(" ")} (${node.failureSummary})`).join("; ")}`,
    ),
  ).toEqual([]);
}

/**
 * A link from one of the app's emails, as the app makes it (src/features/auth/
 * emails.ts) — a Supabase Auth link for the account, landing on one of the
 * app's screens with its tokens — for a journey to follow as a person taps
 * it. The journeys send no mail, so the link is made here, not read from an
 * inbox.
 */
export async function authLinkTo(type: "magiclink" | "recovery", email: string, landing: string): Promise<string> {
  const { data, error } = await admin().auth.admin.generateLink({ type, email });
  if (error) throw error;
  const { accessToken, refreshToken } = await followAuthLink(data.properties.action_link);
  return `${landing}#access_token=${accessToken}&refresh_token=${refreshToken}&type=${type}`;
}
