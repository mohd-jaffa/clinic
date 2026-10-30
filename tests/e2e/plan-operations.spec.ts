import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { recordPayment } from "@/features/billing/payments";
import { createPatient } from "@/features/patients/api";
import { periodEnd } from "@/features/subscription/state";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { paiseToText } from "@/lib/money";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platform/settings";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { patientSchema, paymentSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { makeDeveloper, registerClinic, removeAll, setValidUntil } from "@tests/support/integration";

/**
 * The plan's operations end to end (plan §7.4, §20, §34; R11.7), at a
 * phone's width and a desktop's: the platform admin finds a clinic whose
 * plan has ended, extends it by a month paid by UPI and raises the monthly
 * price — and on every console screen on the way sees nothing of the
 * clinic's patients, nor reaches a clinic screen or API. The owner's Plan
 * screen then shows the new last day, the payment and the new price; and
 * the patient the console never showed is on the owner's own screen.
 */
test.afterAll(removeAll);

const { console: words, plan } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

/** A place of the console, from wherever the screen's width keeps it: the sidebar, the bar, or behind More. */
async function go(page: Page, label: string) {
  const main = page.getByRole("navigation", { name: UI_TEXT.nav.main });
  const place = main.getByRole("link", { name: label, exact: true });
  if (await place.isVisible()) return place.click();
  await main.getByRole("button", { name: UI_TEXT.nav.more }).click();
  await page
    .getByRole("dialog", { name: UI_TEXT.nav.more })
    .getByRole("link", { name: new RegExp(`^${label}`) })
    .click();
}

test("the DEV extends a plan and raises a price, seeing no patient; the owner's Plan screen shows both", async ({
  page,
  browser,
}) => {
  const tag = randomUUID().slice(0, 6);
  const name = `Ops ${tag}`;
  const [developer, saved, clinic] = await Promise.all([
    makeDeveloper(),
    getPlatformSettings(),
    registerClinic({ fullName: "Asha Menon", clinicName: name }),
  ]);
  // The clinic's own records: a patient and a payment — nothing of which the console may show.
  const patientName = `Zara Quill ${tag}`;
  const patient = await createPatient(
    clinic.owner.tenant,
    patientSchema.parse({
      fullName: patientName,
      phone: "99000 77123",
      born: { as: "AGE", years: "33" },
      gender: "FEMALE",
    }),
    randomUUID(),
  );
  await recordPayment(
    clinic.owner.tenant,
    paymentSchema.parse({
      patientId: patient.id,
      kind: "PAYMENT",
      amount: "4,321",
      paidOn: todayKey(),
      method: "CASH",
      reference: "",
      note: "",
    }),
    randomUUID(),
  );
  const ended = addDaysKey(todayKey(), -1);
  await setValidUntil(clinic.clinicId, ended);
  const price = saved.monthlyPricePaise + 10_000;
  const month = periodEnd("MONTHLY", ended, todayKey());

  /** Nothing of the clinic's patients on the screen: not their name, number, mobile or money. */
  const seesNoPatient = async () => {
    const body = page.locator("body");
    await expect(body).not.toContainText(patientName);
    await expect(body).not.toContainText(`P-${patient.number}`);
    await expect(body).not.toContainText("99000 77123");
    await expect(body).not.toContainText("₹4,321");
  };

  try {
    await signIn(page, developer.email, developer.password);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: words.places.overview })).toBeVisible();
    await seesNoPatient();

    // The clinic, found and opened: its plan and owner, nothing of its patients.
    await go(page, words.places.clinics);
    await page.getByRole("searchbox", { name: words.searchClinicsHint }).fill(tag);
    const rows = page.getByRole("list", { name: words.places.clinics }).getByRole("listitem");
    await expect(rows).toHaveCount(1);
    await rows.first().getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await seesNoPatient();
    await expectAccessible(page);

    // A month by UPI (D373); the journeys send no mail, so the card says the email didn't go (D376).
    const planned = page.getByRole("region", { name: words.plan, exact: true });
    await planned.getByRole("button", { name: words.extend }).click();
    const sheet = page.getByRole("dialog", { name: words.extendFor(name) });
    await sheet.getByRole("textbox", { name: new RegExp(`^${words.referenceLabel}`) }).fill(`UPI-${tag}`);
    await sheet.getByRole("button", { name: words.extend }).click();
    await page
      .getByRole("alertdialog", { name: words.extendAsk(name, formatDate(month)) })
      .getByRole("button", { name: words.extendConfirm })
      .click();
    const unsent = page.getByRole("alertdialog", { name: words.notEmailed(name) });
    await expect(unsent).toBeVisible();
    await unsent.getByRole("button", { name: UI_TEXT.actions.close }).click();
    await expect(planned).toContainText(formatDate(month));

    // The monthly price raised, asked first (D381).
    await go(page, words.places.settings);
    await page
      .getByRole("region", { name: words.settingGroups.trialAndPricing })
      .getByRole("button", { name: words.changeGroup(words.settingGroups.trialAndPricing) })
      .click();
    const pricing = page.getByRole("dialog", { name: words.settingGroups.trialAndPricing });
    await pricing.getByRole("textbox", { name: words.settingNames.monthlyPricePaise }).fill(paiseToText(price));
    await pricing.getByRole("button", { name: UI_TEXT.actions.save }).click();
    await page
      .getByRole("alertdialog", { name: words.saveAsk })
      .getByRole("button", { name: words.saveConfirm })
      .click();
    await expect(page.getByRole("region", { name: words.settingGroups.trialAndPricing })).toContainText(
      formatPaise(price),
    );

    // Accounts, the error log, the audit: still nothing of the patients.
    for (const place of [words.places.accounts, words.places.logs, words.places.audit]) {
      await go(page, place);
      await expect(page.getByRole("heading", { level: 1, name: place })).toBeVisible();
      await seesNoPatient();
    }
    await expect(page.getByRole("list", { name: words.places.audit })).toContainText(words.planExtended(name));

    // No clinic screen, and no clinic API, is the DEV's.
    for (const path of ["/patients", "/billing", "/settings/activity"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin$/);
    }
    for (const path of [
      `/api/patients/${patient.id}`,
      "/api/payments?from=2026-01-01&to=2026-12-31",
      "/api/activity",
    ]) {
      expect((await page.request.get(path)).status(), path).toBe(403);
    }
    // A patient search goes in the body, never the address (D98): refused all the same.
    expect((await page.request.post("/api/patients/search", { data: { search: patientName } })).status()).toBe(403);

    // The owner's Plan screen: the new last day, the payment, the new price.
    const ownerContext = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
      viewport: page.viewportSize(),
    });
    const owner = await ownerContext.newPage();
    const answer = await owner.request.post("/api/auth/login", {
      data: { identifier: clinic.owner.email, password: clinic.owner.password },
    });
    expect(answer.ok()).toBe(true);
    await owner.goto("/settings/plan");
    await expect(owner.getByRole("heading", { level: 1, name: plan.named("Monthly") })).toBeVisible();
    await expect(owner.getByText(formatDate(month), { exact: true })).toBeVisible();
    await expect(owner.getByRole("list", { name: plan.history })).toContainText(`UPI-${tag}`);
    await expect(owner.getByRole("region", { name: plan.howToRenew })).toContainText(formatPaise(price));
    await expectAccessible(owner);
    // The patient the console never showed is there, for the clinic's own owner.
    await owner.goto(`/patients/${patient.id}`);
    await expect(owner.getByRole("heading", { level: 1, name: patientName })).toBeVisible();
    await ownerContext.close();
  } finally {
    await updatePlatformSettings(
      createSupabaseAnonClient(developer.session.accessToken),
      { monthlyPricePaise: saved.monthlyPricePaise },
      "req_e2e_restore_price",
    );
  }
});
