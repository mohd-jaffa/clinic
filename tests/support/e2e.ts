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
  // A card or menu still fading is checked as it will stand, not halfway
  // there: its colours mid-fade are blends no one reads. Neither a pulse that
  // never ends nor a notice's countdown — a clock, whose end only starts the
  // notice's fade — is waited for. A fade that begins during the check makes
  // it run again, on the page as it then stands.
  const settle = () =>
    page.evaluate(async () => {
      const fades = document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity &&
            !(animation.effect as KeyframeEffect | null)?.target?.closest("[data-countdown]"),
        );
      await Promise.all(fades.map((animation) => animation.finished.catch(() => undefined)));
      return fades.length;
    });
  let results: Awaited<ReturnType<AxeBuilder["analyze"]>>;
  let attempt = 0;
  do {
    await settle();
    results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    attempt += 1;
  } while ((await settle()) > 0 && attempt < 3);
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
