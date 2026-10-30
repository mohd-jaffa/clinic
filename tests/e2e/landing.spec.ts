import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { formatPaise } from "@/lib/format/currency";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platform/settings";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { expectAccessible } from "@tests/support/e2e";
import { makeDeveloper, registerClinic, removeAll } from "@tests/support/integration";

/**
 * The landing page (plan §21; R12.1, D397 – D401), at a phone's width and a
 * desktop's: the day's screens through their lakes, in the visitor's theme;
 * the trial and the prices as the DEV last saved them, read as the page is
 * drawn; the renewal contact once set; and the way in — Start free trial and
 * Sign in, or the clinic itself for someone signed in.
 */
test.afterAll(removeAll);

const { landing: words, appName } = UI_TEXT;

/** A screenshot as drawn: shown, and loaded. */
async function shown(page: Page, alt: string, theme: "light" | "dark") {
  const image = page.locator(`img.for-${theme}[alt="${alt}"]`);
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
}

test("a visitor reads the day, the live prices, and starts a trial or signs in", async ({ page }) => {
  const settings = await getPlatformSettings();
  await page.goto("/");
  await expect(page).toHaveTitle(words.pageTitle(appName));
  await expect(page.getByRole("heading", { level: 1, name: words.headline })).toBeVisible();
  await expect(
    page.getByText(
      words.terms(settings.trialDays, formatPaise(settings.monthlyPricePaise), formatPaise(settings.yearlyPricePaise)),
    ),
  ).toBeVisible();
  await shown(page, words.queueAlt, "light");
  await expect(page.locator("img.for-dark").first()).toBeHidden();
  for (const part of Object.values(words.parts)) {
    await expect(page.getByRole("heading", { level: 2, name: part.title })).toBeAttached();
  }
  await expectAccessible(page);

  // The prices the API tells anyone are the same, and never kept.
  const answer = await page.request.get("/api/public/pricing");
  expect(answer.headers()["cache-control"]).toContain("no-store");
  expect((await answer.json()).data).toMatchObject({
    trialDays: settings.trialDays,
    monthlyPaise: settings.monthlyPricePaise,
    yearlyPaise: settings.yearlyPricePaise,
  });

  // Down the page, each screen arrives as it is reached.
  await page.getByRole("heading", { level: 2, name: words.devices.title }).scrollIntoViewIfNeeded();
  await shown(page, words.devices.alt, "light");
  await page.getByRole("heading", { level: 2, name: words.parts.reports.title }).scrollIntoViewIfNeeded();
  await shown(page, words.parts.reports.alt, "light");

  await page.getByRole("link", { name: words.startTrial }).first().click();
  await expect(page).toHaveURL(/\/register$/);
  await page.goto("/");
  await page.getByRole("link", { name: words.signIn }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("a device set to dark is shown the screens taken in dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await shown(page, words.queueAlt, "dark");
  await expect(page.locator("img.for-light").first()).toBeHidden();
  await expectAccessible(page);
});

test("a price and the contact the DEV saves are on the page at its next load", async ({ page }) => {
  const developer = await makeDeveloper();
  const dev = createSupabaseAnonClient(developer.session.accessToken);
  const saved = await getPlatformSettings();
  try {
    await updatePlatformSettings(
      dev,
      {
        monthlyPricePaise: saved.monthlyPricePaise + 5_000,
        renewalContactName: "Asha Nair",
        renewalContactPhone: "+919876501234",
        renewalContactEmail: "asha.nair@example.com",
      },
      "req_e2e_landing_price",
    );
    await page.goto("/");
    const monthly = formatPaise(saved.monthlyPricePaise + 5_000);
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: words.pricing.title(monthly, formatPaise(saved.yearlyPricePaise)),
      }),
    ).toBeVisible();
    const contact = page.getByRole("region", { name: words.contact.title });
    await expect(contact.getByText(words.contact.talkTo("Asha Nair"))).toBeVisible();
    await expect(contact.getByRole("link", { name: "Call Asha Nair" })).toHaveAttribute("href", "tel:+919876501234");
    await expect(contact.getByRole("link", { name: "WhatsApp Asha Nair" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\/919876501234\?text=/,
    );
    await expect(contact.getByRole("link", { name: "Email Asha Nair" })).toHaveAttribute(
      "href",
      /^mailto:asha\.nair@example\.com/,
    );
    await expectAccessible(page);
  } finally {
    await updatePlatformSettings(
      dev,
      {
        monthlyPricePaise: saved.monthlyPricePaise,
        renewalContactName: saved.renewalContactName,
        renewalContactPhone: saved.renewalContactPhone,
        renewalContactEmail: saved.renewalContactEmail,
      },
      "req_e2e_landing_restore",
    );
  }
});

test("someone signed in is offered their clinic instead of a trial", async ({ page }) => {
  const { owner } = await registerClinic();
  const answer = await page.request.post("/api/auth/login", {
    data: { identifier: owner.email, password: owner.password },
  });
  expect(answer.ok()).toBe(true);
  await page.goto("/");
  await expect(page.getByRole("link", { name: words.startTrial })).toHaveCount(0);
  await page
    .getByRole("link", { name: words.openApp(appName) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/home$/);
});
