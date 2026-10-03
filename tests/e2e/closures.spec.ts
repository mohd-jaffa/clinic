import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { todayKey } from "@/lib/dates/calendar";
import { formatLongDate } from "@/lib/format/date";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Holidays and leave (plan §9; R3.3, D84 – D86): the owner closes the clinic
 * for a day, is refused a second closure of the clinic on it, takes their own
 * leave the same day — a doctor's leave may sit inside a holiday — and removes
 * the holiday, asked first. A member without settings.manage is told the
 * screen is not theirs. At a phone's width and a desktop's, each checked by axe.
 */
test.afterAll(removeAll);

const { actions, closures, settings } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });

async function addToday(page: Page, who: string, reason: string) {
  await page.getByRole("button", { name: closures.add }).click();
  const sheet = page.getByRole("dialog", { name: closures.addTitle });
  if (who !== closures.wholeClinic) {
    await sheet.getByRole("combobox", { name: /^Who’s away/ }).click();
    await page.getByRole("option", { name: who }).click();
  }
  await sheet.getByRole("button", { name: /^First day/ }).click();
  await page.getByRole("button", { name: formatLongDate(todayKey()) }).click();
  await sheet.getByRole("textbox", { name: /^Reason/ }).fill(reason);
  await expectAccessible(page);
  await sheet.getByRole("button", { name: actions.save }).click();
  return sheet;
}

test("the owner closes the clinic for a day, takes leave, and removes the holiday", async ({ page }) => {
  const { owner } = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  await signIn(page, owner.email, owner.password);

  await page.goto("/settings");
  await page.getByRole("link", { name: settings.items.closures.label }).click();
  await expect(page).toHaveURL(/\/settings\/closures$/);
  await expect(page.getByRole("heading", { name: closures.emptyTitle })).toBeVisible();
  await expectAccessible(page);

  // The whole clinic, today: the last day follows the first.
  const sheet = await addToday(page, closures.wholeClinic, "Founders’ day");
  await expect(sheet).toBeHidden();
  await expect(notice(page, closures.added("Founders’ day"))).toBeVisible();
  const coming = page.getByRole("list", { name: closures.upcoming });
  await expect(coming).toContainText("Founders’ dayWhole clinic");
  await expect(coming).toContainText("1 day");
  await expect(page.getByText(closures.count(1))).toBeVisible();

  // Not twice for the same people (D86).
  const again = await addToday(page, closures.wholeClinic, "Holiday");
  await expect(page.getByRole("alertdialog", { name: closures.notSaved })).toContainText("Those days overlap");
  await page.getByRole("alertdialog", { name: closures.notSaved }).getByRole("button", { name: actions.close }).click();
  await again.getByRole("button", { name: actions.close }).click();

  // But the owner's own leave sits inside the holiday.
  await addToday(page, "Asha Menon", "Conference");
  await expect(notice(page, closures.added("Conference"))).toBeVisible();
  await expect(coming).toContainText("ConferenceAsha Menon");

  // Removed, asked first (D84).
  await page.getByRole("button", { name: closures.removeNamed("Founders’ day") }).click();
  const ask = page.getByRole("alertdialog", { name: closures.removeTitle("Founders’ day") });
  await expectAccessible(page);
  await ask.getByRole("button", { name: closures.remove }).click();
  await expect(notice(page, closures.removed("Founders’ day"))).toBeVisible();
  await expect(coming).not.toContainText("Founders’ day");
  await expect(page.getByText(closures.count(1))).toBeVisible();
});

test("a member without settings.manage is told the screen is not theirs", async ({ page }) => {
  const { clinicId } = await registerClinic();
  const member = await addMember(clinicId, { permissions: ["patients.view"] });
  await signIn(page, member.email, member.password);

  await page.goto("/settings/closures");
  await expect(page.getByRole("heading", { level: 1, name: UI_TEXT.system.noAccessTitle })).toBeVisible();
  await expectAccessible(page);
});
