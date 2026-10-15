import AxeBuilder from "@axe-core/playwright";
import { expect, type Browser, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";

import { admin, aMobileNumber, issueInviteToken } from "./integration";
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

/**
 * The owner invites someone from Team (plan §8.5): a receptionist, a member
 * starting from another preset — an assistant — or a doctor with their own
 * fee and, when given, their registration number. The journeys send no
 * mail, so the invite is kept and the card says so.
 */
export async function inviteMember(
  page: Page,
  who: { name: string; email: string; doctor?: boolean; preset?: string; registration?: string },
): Promise<void> {
  const { team, actions } = UI_TEXT;
  await page.getByRole("button", { name: team.invite, exact: true }).click();
  const sheet = page.getByRole("dialog", { name: team.inviteTitle });
  if (who.doctor) {
    await page.getByRole("radiogroup", { name: team.roleLabel }).getByRole("radio", { name: "Doctor" }).click();
    await sheet.getByRole("textbox", { name: /^Consultation fee/ }).fill("700");
    if (who.registration) {
      await sheet.getByRole("textbox", { name: /^Registration number/ }).fill(who.registration);
    }
  }
  if (who.preset) {
    await sheet.getByRole("radiogroup", { name: team.presetLabel }).getByRole("radio", { name: who.preset }).click();
  }
  await sheet.getByRole("textbox", { name: /^Name/ }).fill(who.name);
  await sheet.getByRole("textbox", { name: /^Email/ }).fill(who.email);
  await sheet.getByRole("button", { name: team.send }).click();
  await page
    .getByRole("alertdialog", { name: team.invitedNoEmail })
    .getByRole("button", { name: actions.close })
    .click();
}

/** The invitee, on a device of their own, follows the link the invite would send, and joins — signed in on Home. */
export async function joinByInvite(browser: Browser, page: Page, email: string): Promise<Page> {
  const device = await browser.newContext({ viewport: page.viewportSize() });
  const invitee = await device.newPage();
  await invitee.goto(`/accept-invite#token=${await issueInviteToken(email)}`);
  await invitee.getByRole("textbox", { name: /^Mobile number/ }).fill(aMobileNumber());
  await invitee.getByLabel(/^Choose a password/).fill("a good long password");
  await invitee.getByRole("button", { name: UI_TEXT.acceptInvite.join }).click();
  await expect(invitee).toHaveURL(/\/home$/);
  return invitee;
}
