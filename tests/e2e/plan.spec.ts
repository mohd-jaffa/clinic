import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { formatDayMonth } from "@/lib/format/date";
import { getPlatformSettings } from "@/lib/platform/settings";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, registerClinic, removeAll, setValidUntil, type TestClinic } from "@tests/support/integration";

/**
 * The plan banner and read-only mode (plan §7.2, D73, D74): a clinic's plan
 * moved through ending soon, ended and view-only, as the admin's Set date
 * would, and the screens drawn afresh each time from the session — at a
 * phone's width and a desktop's, each checked by axe.
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

const { plan, quickActions, account } = UI_TEXT;
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
});
