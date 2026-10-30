import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { formatPaise } from "@/lib/format/currency";
import { formatDate, formatDayMonth } from "@/lib/format/date";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/platform/settings";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { expectAccessible } from "@tests/support/e2e";
import {
  addMember,
  makeDeveloper,
  registerClinic,
  removeAll,
  setValidUntil,
  type TestClinic,
} from "@tests/support/integration";

/**
 * The plan banner and read-only mode (plan §7.2, D73, D74): a clinic's plan
 * moved through ending soon, ended and view-only, as the admin's Set date
 * would, and the screens drawn afresh each time from the session. Then the
 * owner's Plan screen (plan §7.5; R11.1, D363 – D366): what the DEV set and
 * recorded, as the owner reads it, and How to renew from a view-only
 * clinic. At a phone's width and a desktop's, each checked by axe.
 */
let clinic: TestClinic;
let graceDays: number;

test.beforeAll(async () => {
  const settings = await getPlatformSettings();
  // Each state is reached by a day's distance from today: the live settings must leave room for it.
  expect(settings.expiryWarningDays).toBeGreaterThan(0);
  expect(settings.graceDays).toBeGreaterThan(0);
  graceDays = settings.graceDays;
  clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care Dental" });
});

test.afterAll(removeAll);

const { plan, quickActions, account, system } = UI_TEXT;
const banner = (page: Page) => page.getByRole("region", { name: plan.banner });

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

test("the owner is told as the plan ends, ends, and leaves the clinic view-only", async ({ page }) => {
  const today = todayKey();
  await signIn(page, clinic.owner.email, clinic.owner.password);

  // Ending soon: quiet, with How to renew leading to the Plan screen.
  await setValidUntil(clinic.clinicId, today);
  await page.goto("/home");
  await expect(banner(page)).toHaveText(new RegExp(`^${plan.endsOn(formatDayMonth(today))}`));
  await expect(banner(page).getByRole("link", { name: plan.howToRenew })).toHaveAttribute("href", "/settings/plan");
  await expectAccessible(page);

  // Ended: coral, with the day it becomes view-only; everything still works.
  const yesterday = addDaysKey(today, -1);
  await setValidUntil(clinic.clinicId, yesterday);
  await page.reload();
  await expect(banner(page)).toContainText(
    plan.endedOn(formatDayMonth(yesterday), formatDayMonth(addDaysKey(yesterday, graceDays + 1))),
  );
  await expectAccessible(page);

  // View-only: the banner stays, the ＋ says why its actions are off, and so does My account.
  await setValidUntil(clinic.clinicId, addDaysKey(today, -graceDays - 1));
  await page.reload();
  await expect(banner(page)).toContainText(plan.readOnly);
  await page.getByRole("button", { name: quickActions.title }).click();
  const lobe = page.getByRole("dialog", { name: quickActions.title });
  await expect(lobe).toContainText(plan.readOnlyReason);
  await expect(lobe.getByRole("link")).toHaveCount(0);
  await expect(lobe.getByRole("button", { name: quickActions.patient })).toHaveAttribute("aria-disabled", "true");
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await expect(lobe).toBeHidden();

  await page.goto("/settings/account");
  await expect(banner(page)).toBeVisible();
  const details = page.getByRole("region", { name: account.details });
  await expect(details.getByRole("button", { name: account.nameLabel })).toHaveCount(0);
  await expect(details).toContainText(plan.readOnlyReason);
  await expect(page.getByRole("button", { name: account.changePassword })).toBeVisible();
  await expectAccessible(page);

  // And the server refuses the change the screen no longer offers.
  const refused = await page.request.patch("/api/auth/profile", { data: { fullName: "Asha M" } });
  expect(refused.status()).toBe(422);
  expect((await refused.json()).error.code).toBe("CLINIC_PLAN_EXPIRED");
});

test("a member is told what is happening to the clinic, with nothing to renew", async ({ page }) => {
  const other = await registerClinic();
  const member = await addMember(other.clinicId, { permissions: ["patients.view", "patients.create"] });
  await setValidUntil(other.clinicId, addDaysKey(todayKey(), -graceDays - 1));
  await signIn(page, member.email, member.password);

  await page.goto("/home");
  await expect(banner(page)).toContainText(plan.clinicReadOnly);
  await expect(banner(page).getByRole("link")).toHaveCount(0);
  await expectAccessible(page);

  // The Plan screen is the owner's alone.
  await page.goto("/settings/plan");
  await expect(page.getByRole("heading", { level: 1, name: system.noAccessTitle })).toBeVisible();
});

test("the owner's Plan screen: its last day, how to renew, and every change recorded", async ({ page, context }) => {
  const developer = await makeDeveloper();
  const asDeveloper = createSupabaseAnonClient(developer.session.accessToken);
  const saved = await getPlatformSettings();
  const contact = {
    renewalContactName: "Jaffa",
    renewalContactPhone: "+919845012345",
    renewalContactEmail: "renew@clinicdesk.in",
    renewalUpiId: "clinicdesk@okaxis",
  };
  await updatePlatformSettings(asDeveloper, contact, "req_e2e_plan_contact");
  try {
    const owner = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
    const extend = async (args: Record<string, unknown>) => {
      const { data, error } = await asDeveloper.rpc("extend_clinic_subscription", {
        p_clinic_id: owner.clinicId,
        p_kind: "MONTHLY",
        p_amount_paise: 0,
        p_method: null,
        p_reference: null,
        p_paid_on: null,
        p_valid_until: null,
        p_reason: null,
        p_idempotency_key: randomUUID(),
        ...args,
      });
      expect(error).toBeNull();
      return (data as { payment: { valid_until: string } }).payment.valid_until;
    };
    // Days given for the move, then a month paid for by UPI.
    const given = await extend({
      p_kind: "CUSTOM",
      p_valid_until: addDaysKey(todayKey(), 40),
      p_reason: "Ten days for the move",
    });
    const lastDay = await extend({
      p_amount_paise: saved.monthlyPricePaise,
      p_method: "UPI",
      p_reference: "UPI-4821",
      p_paid_on: todayKey(),
    });

    await signIn(page, owner.owner.email, owner.owner.password);
    await page.goto("/settings");
    await page.getByRole("link", { name: new RegExp(`^${UI_TEXT.settings.items.plan.label}`) }).click();
    await expect(page).toHaveURL(/\/settings\/plan$/);

    // The land: the plan, its last day, and that it is active (D363).
    await expect(page.getByRole("heading", { level: 1, name: plan.named("Monthly") })).toBeVisible();
    await expect(page.getByText(plan.activeUntil)).toBeVisible();
    await expect(page.getByText(formatDate(lastDay), { exact: true })).toBeVisible();

    // How to renew: the live prices, the contact, the words typed (D364, D365).
    const renew = page.getByRole("region", { name: plan.howToRenew });
    await expect(renew).toContainText(formatPaise(saved.monthlyPricePaise));
    await expect(renew).toContainText(formatPaise(saved.yearlyPricePaise));
    await expect(renew).toContainText("+91 98450 12345");
    await expect(renew.getByRole("link", { name: plan.callTo("Jaffa") })).toHaveAttribute("href", "tel:+919845012345");
    await expect(renew.getByRole("link", { name: plan.whatsAppTo("Jaffa") })).toHaveAttribute(
      "href",
      `https://wa.me/919845012345?text=${encodeURIComponent(plan.renewalMessage("Smile Care"))}`,
    );
    await expect(renew.getByRole("link", { name: plan.emailTo("Jaffa") })).toHaveAttribute(
      "href",
      /^mailto:renew@clinicdesk\.in\?subject=/,
    );
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await renew.getByRole("button", { name: plan.copyUpi }).click();
    await expect(page.getByText(plan.upiCopied, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("clinicdesk@okaxis");

    // Every change, the latest first; the free days marked No charge, with the reason (D366).
    await expect(page.getByRole("list", { name: plan.history }).getByRole("listitem")).toHaveText([
      `${plan.until(formatDate(lastDay))}Monthly · ${plan.paidOn(formatDate(todayKey()))} · UPI · UPI-4821${formatPaise(saved.monthlyPricePaise)}`,
      `${plan.until(formatDate(given))}${plan.dateChanged} · ${formatDate(todayKey())} · Ten days for the move${plan.noCharge}`,
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await expectAccessible(page);

    // View-only: How to renew leads here, and the land says so.
    await setValidUntil(owner.clinicId, addDaysKey(todayKey(), -graceDays - 1));
    await page.goto("/home");
    await banner(page).getByRole("link", { name: plan.howToRenew }).first().click();
    await expect(page).toHaveURL(/\/settings\/plan$/);
    await expect(page.getByText(plan.viewOnly, { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: plan.howToRenew })).toBeVisible();
    await expectAccessible(page);
  } finally {
    await updatePlatformSettings(
      asDeveloper,
      {
        renewalContactName: saved.renewalContactName,
        renewalContactPhone: saved.renewalContactPhone,
        renewalContactEmail: saved.renewalContactEmail,
        renewalUpiId: saved.renewalUpiId,
      },
      "req_e2e_plan_restore",
    );
  }
});
