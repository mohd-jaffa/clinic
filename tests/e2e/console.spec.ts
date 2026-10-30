import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { periodEnd } from "@/features/subscription/state";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { formatDate, formatLongDate } from "@/lib/format/date";
import { paiseToText } from "@/lib/money";
import { getPlatformSettings } from "@/lib/platform/settings";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { expectAccessible } from "@tests/support/e2e";
import { admin, makeDeveloper, registerClinic, removeAll, setValidUntil } from "@tests/support/integration";

/**
 * The developer console (plan §20; R11.2, D367 – D372), at a phone's width
 * and a desktop's: the platform admin finds the clinic waiting for
 * activation from the Overview, searches the clinics, opens one — its plan,
 * its owner with Call, WhatsApp and Email, what was recorded — then the
 * accounts, the error log, opened whole, and the platform audit. It extends
 * a plan (R11.3, D373 – D376): a month paid for activates the clinic waiting,
 * then days given free move its last day — the owner's email, which the
 * journeys never send, said to have not gone. A clinic's owner is sent Home.
 * Each screen checked by axe, nothing wider than it.
 */
test.afterAll(removeAll);

const { console: words, nav } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

/** A place of the console, from wherever the screen's width keeps it: the sidebar, the bar, or behind More. */
async function go(page: Page, label: string) {
  const main = page.getByRole("navigation", { name: nav.main });
  const place = main.getByRole("link", { name: label, exact: true });
  if (await place.isVisible()) return place.click();
  await main.getByRole("button", { name: nav.more }).click();
  await page
    .getByRole("dialog", { name: nav.more })
    .getByRole("link", { name: new RegExp(`^${label}`) })
    .click();
}

test("the platform admin's console: the overview, a clinic waiting, the accounts, the logs and the audit", async ({
  page,
}) => {
  const tag = randomUUID().slice(0, 6);
  const developer = await makeDeveloper();
  const [waiting, paid] = await Promise.all([
    registerClinic({ fullName: "Asha Menon", clinicName: `Smile ${tag}` }),
    registerClinic({ fullName: "Ravi Kumar", clinicName: `City ${tag}` }),
  ]);
  await setValidUntil(waiting.clinicId, addDaysKey(todayKey(), -61));
  const { error } = await createSupabaseAnonClient(developer.session.accessToken).rpc("extend_clinic_subscription", {
    p_clinic_id: paid.clinicId,
    p_kind: "MONTHLY",
    p_amount_paise: 30_000,
    p_method: "UPI",
    p_reference: `UPI-${tag}`,
    p_paid_on: todayKey(),
    p_valid_until: null,
    p_reason: null,
    p_idempotency_key: randomUUID(),
  });
  expect(error).toBeNull();
  const reference = `req_${tag}`;
  await admin()
    .from("error_logs")
    .insert({
      source: "API",
      message: `Request failed ${tag}`,
      reference,
      code: "INTERNAL_ERROR",
      http_status: 500,
      method: "POST",
      path: "/api/bills",
    });

  // The Overview: the clinics, and the one waiting for activation.
  await signIn(page, developer.email, developer.password);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: words.places.overview })).toBeVisible();
  await expect(page.getByRole("region", { name: words.byStanding })).toBeVisible();
  await fitsTheScreen(page);
  await expectAccessible(page);

  // The clinics waiting, from the Overview's figure; one is ours, flagged No trial.
  await page.getByRole("link", { name: words.waiting }).click();
  await expect(page.getByRole("radio", { name: "No trial" })).toBeChecked();
  await page.getByRole("searchbox", { name: words.searchClinicsHint }).fill(tag);
  const rows = page.getByRole("list", { name: words.places.clinics }).getByRole("listitem");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(`Smile ${tag}`);
  await expect(rows.first()).toContainText("No trial");
  await page.getByRole("radio", { name: words.allClinics }).click();
  await expect(rows).toHaveCount(2);
  await fitsTheScreen(page);
  await expectAccessible(page);

  // A clinic's page: its plan, its owner and how to reach them, what was recorded.
  await rows
    .filter({ hasText: `City ${tag}` })
    .getByRole("link")
    .click();
  await expect(page.getByRole("heading", { level: 1, name: `City ${tag}` })).toBeVisible();
  await expect(page.getByRole("region", { name: words.plan, exact: true })).toContainText("Monthly");
  const owner = page.getByRole("region", { name: words.owner });
  await expect(owner.getByRole("link", { name: words.callTo("Ravi Kumar") })).toHaveAttribute(
    "href",
    `tel:${paid.owner.phone}`,
  );
  await expect(owner.getByRole("link", { name: words.emailTo("Ravi Kumar") })).toHaveAttribute(
    "href",
    `mailto:${paid.owner.email}`,
  );
  await expect(page.getByRole("list", { name: words.planHistory })).toContainText(`UPI-${tag}`);
  await fitsTheScreen(page);
  await expectAccessible(page);

  // Accounts: the owner, their clinic and role.
  await go(page, words.places.accounts);
  await page.getByRole("searchbox", { name: words.searchAccountsHint }).fill(paid.owner.email);
  const accounts = page.getByRole("list", { name: words.places.accounts }).getByRole("listitem");
  await expect(accounts).toHaveCount(1);
  await expect(accounts).toContainText(`City ${tag} · Owner`);
  await expectAccessible(page);

  // The error log, an entry opened whole (D372).
  await go(page, words.places.logs);
  await page.getByRole("button", { name: `Request failed ${tag}` }).click();
  const entry = page.getByRole("dialog", { name: words.errorTitle });
  await expect(entry).toContainText(reference);
  await expect(entry).toContainText("POST /api/bills");
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await expect(entry).toBeHidden();

  // The platform audit: the extension, for which clinic.
  await go(page, words.places.audit);
  await expect(page.getByRole("list", { name: words.places.audit })).toContainText(words.planExtended(`City ${tag}`));
  await fitsTheScreen(page);
  await expectAccessible(page);
  await admin().from("error_logs").delete().eq("reference", reference);
});

test("the platform admin extends a plan: a month paid for activates a clinic waiting, then days are given free", async ({
  page,
}) => {
  const tag = randomUUID().slice(0, 6);
  const name = `Waiting ${tag}`;
  const [developer, waiting, settings] = await Promise.all([
    makeDeveloper(),
    registerClinic({ fullName: "Asha Menon", clinicName: name }),
    getPlatformSettings(),
  ]);
  const before = addDaysKey(todayKey(), -61);
  await setValidUntil(waiting.clinicId, before);

  await signIn(page, developer.email, developer.password);
  await page.goto(`/admin/clinics/${waiting.clinicId}`);
  const plan = page.getByRole("region", { name: words.plan, exact: true });
  await expect(plan).toContainText("No trial");

  // A month at the live price, paid today by UPI, running on from today (D373, D374).
  await plan.getByRole("button", { name: words.extend }).click();
  const sheet = page.getByRole("dialog", { name: words.extendFor(name) });
  await expect(sheet.getByRole("radio", { name: "Monthly" })).toBeChecked();
  const month = periodEnd("MONTHLY", before, todayKey());
  await expect(sheet.getByText(words.newLastDay(formatDate(month)))).toBeVisible();
  await expect(sheet.getByRole("textbox", { name: new RegExp(`^${words.amountLabel}`) })).toHaveValue(
    paiseToText(settings.monthlyPricePaise),
  );
  await expect(sheet.getByRole("radio", { name: "UPI" })).toBeChecked();
  await sheet.getByRole("textbox", { name: new RegExp(`^${words.referenceLabel}`) }).fill(`UPI-${tag}`);
  await fitsTheScreen(page);
  await expectAccessible(page);
  await sheet.getByRole("button", { name: words.extend }).click();

  // The card asks first, then says the new last day and that the owner is emailed (D376).
  const ask = page.getByRole("alertdialog", { name: words.extendAsk(name, formatDate(month)) });
  await expect(ask).toContainText(words.paidAsk(formatPaise(settings.monthlyPricePaise), "UPI"));
  await expectAccessible(page);
  await ask.getByRole("button", { name: words.extendConfirm }).click();
  // The journeys send no mail, so the card says the owner's email didn't go; the plan is changed all the same.
  const unsent = page.getByRole("alertdialog", { name: words.notEmailed(name) });
  await expect(unsent).toContainText(words.notEmailedBody(formatDate(month)));
  await unsent.getByRole("button", { name: UI_TEXT.actions.close }).click();
  await expect(plan).toContainText("Monthly");
  await expect(plan).toContainText(formatDate(month));
  await expect(plan).not.toContainText("No trial");
  await expect(page.getByRole("list", { name: words.planHistory })).toContainText(`UPI-${tag}`);

  // Ten days given free: a date set by hand, with its reason, at ₹0 (D374).
  const free = addDaysKey(month, 10);
  await plan.getByRole("button", { name: words.extend }).click();
  await sheet.getByRole("radio", { name: "Set date" }).click();
  await expect(sheet.getByRole("radio", { name: "UPI" })).toBeHidden();
  await sheet.getByRole("button", { name: new RegExp(`^${words.newLastDayLabel}`) }).click();
  const calendar = page.getByRole("dialog", { name: UI_TEXT.datePicker.calendar(words.newLastDayLabel) });
  const day = calendar.getByRole("button", { name: formatLongDate(free) });
  for (let step = 0; step < 3 && !(await day.isVisible()); step++) {
    await calendar.getByRole("button", { name: UI_TEXT.datePicker.nextMonth }).click();
  }
  await day.click();
  const reason = `Ten days for the move ${tag}`;
  await sheet.getByRole("textbox", { name: new RegExp(`^${words.reasonLabel}`) }).fill(reason);
  await expectAccessible(page);
  await sheet.getByRole("button", { name: words.extend }).click();
  const given = page.getByRole("alertdialog", { name: words.extendAsk(name, formatDate(free)) });
  await expect(given).toContainText(words.freeAsk);
  await given.getByRole("button", { name: words.extendConfirm }).click();
  await expect(unsent).toContainText(words.notEmailedBody(formatDate(free)));
  await unsent.getByRole("button", { name: UI_TEXT.actions.close }).click();
  await expect(plan).toContainText(formatDate(free));
  await expect(page.getByRole("list", { name: words.planHistory })).toContainText(reason);
  await fitsTheScreen(page);
  await expectAccessible(page);
});

test("the console is the platform admin's alone: a clinic's owner is sent Home", async ({ page }) => {
  const clinic = await registerClinic();
  await signIn(page, clinic.owner.email, clinic.owner.password);
  await page.goto("/admin/clinics");
  await expect(page).toHaveURL(/\/home$/);
});
