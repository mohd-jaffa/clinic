import { expect, test, type Page } from "@playwright/test";

import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { THEME_COLORS } from "@/lib/theme/themes";
import { authLinkTo, expectAccessible, greetingFor } from "@tests/support/e2e";
import { aMobileNumber, anEmail, deleteAfter, removeAll, userIdOf } from "@tests/support/integration";

/**
 * Phase 2's journey (plan §34, R2.10): an owner signs up through the screens,
 * is turned away until the email is confirmed, confirms by the link the app
 * sends, signs out, signs in again with their mobile number typed as people
 * type it, and lands on Home inside the shell — then Home is looked at across
 * the widths the app is made for (360 – 1440 px) in both themes, each checked
 * by axe. The phone project takes the phones' widths, the desktop project the
 * tablet's and the desktop's.
 */
test.afterAll(removeAll);

const { auth, nav } = UI_TEXT;
const WIDTHS = { phone: [360, 390, 414], desktop: [768, 1024, 1280, 1440] } as const;
const HEIGHTS: Record<number, number> = { 360: 780, 390: 844, 414: 896, 768: 1024, 1024: 768, 1280: 800, 1440: 900 };

const field = (page: Page, name: RegExp) => page.getByRole("textbox", { name });

/** A theme's ground as the browser reports a colour: "#eef3ee" → "rgb(238, 243, 238)". */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(", ")})`;

test("an owner signs up, confirms, signs in with their mobile and lands on Home, at every width and in both themes", async ({
  page,
}, { project }) => {
  const email = anEmail();
  const mobile = aMobileNumber();
  const password = "Journey-pass-1";

  // Sign up: you, then your clinic.
  await page.goto("/register");
  await field(page, /^Your name/).fill("Asha Menon");
  await field(page, /^Email/).fill(email);
  await field(page, /^Mobile number/).fill(mobile);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: auth.next }).click();
  await field(page, /^Clinic name/).fill("Smile Care Dental");
  await page.getByRole("combobox", { name: /^Clinic type/ }).click();
  await page.getByRole("option", { name: "Dental" }).click();
  await field(page, /^City/).fill("Kochi");
  await field(page, /^Address/).fill("12 MG Road");
  await page.getByRole("button", { name: auth.createClinic }).click();
  await expect(page.getByRole("heading", { level: 1, name: auth.checkEmailTitle })).toBeFocused();
  deleteAfter({ userId: await userIdOf(email) });

  // Not yet: the email is confirmed first, and the link is offered again.
  await page.goto("/login");
  await field(page, /Email or mobile number/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: auth.signIn }).click();
  const refused = page.getByRole("alertdialog", { name: auth.signInFailed });
  await expect(refused).toContainText(ERROR_MESSAGES.AUTH_EMAIL_NOT_CONFIRMED);
  await expect(refused.getByRole("link", { name: auth.resendLink })).toHaveAttribute("href", "/confirm-email");
  await expectAccessible(page);
  await refused.getByRole("button", { name: UI_TEXT.actions.close }).click();

  // Confirmed by the link the app emails: signed in, at Home.
  await page.goto(await authLinkTo("magiclink", email, "/confirm-email"));
  await expect(page).toHaveURL(/\/home$/);

  // Signed out from Settings, asked first.
  await page.goto("/settings");
  await page.getByRole("button", { name: auth.signOut }).click();
  await page.getByRole("alertdialog", { name: auth.signOutTitle }).getByRole("button", { name: auth.signOut }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Back in with the mobile number, written with a leading 0 and a space.
  await field(page, /Email or mobile number/).fill(`0${mobile.slice(0, 5)} ${mobile.slice(5)}`);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: auth.signIn }).click();
  await expect(page).toHaveURL(/\/home$/);
  const greeting = page.getByRole("heading", { level: 1, name: greetingFor("Asha") });

  // Home inside the shell: the bottom bar on a phone, the rail and the sidebar beyond it.
  for (const width of WIDTHS[project.name as keyof typeof WIDTHS]) {
    await page.setViewportSize({ width, height: HEIGHTS[width] });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await expect(greeting).toBeVisible();
      // Drawn in that theme: the device decides, as no theme was chosen.
      await expect(page.locator("html")).toHaveCSS("background-color", rgb(THEME_COLORS[colorScheme]));
      if (width < 768) await expect(page.getByRole("button", { name: nav.more })).toBeVisible();
      else await expect(page.getByRole("button", { name: nav.account("Asha Menon") })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width} px`).toBe(width);
      await expectAccessible(page);
    }
  }
});
