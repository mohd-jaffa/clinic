import { expect, test, type Page } from "@playwright/test";

import { ERROR_MESSAGES, UI_TEXT } from "@/constants/messages";
import { expectAccessible } from "@tests/support/e2e";
import { registerClinic, removeAll } from "@tests/support/integration";

/**
 * Online-only, nothing lost (plan §21, D55, R2.11): when the connection
 * drops, a band across the top says so; a save made meanwhile is refused
 * with the reason and what was typed stays in its sheet; when the connection
 * is back the band goes and the same save goes through — at a phone's width
 * and a desktop's, each checked by axe.
 */
test.afterAll(removeAll);

const { account, actions, offline } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

test("offline: the band says so, a save keeps what was typed, and goes through once the connection is back", async ({
  page,
  context,
}) => {
  const { owner } = await registerClinic({ fullName: "Asha Menon" });
  await signIn(page, owner.email, owner.password);
  await page.goto("/settings/account");
  const band = page.getByRole("status").filter({ hasText: offline.banner });
  await expect(band).toHaveCount(0);

  await context.setOffline(true);
  await expect(band).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize()!.width);
  await expectAccessible(page);

  // A save while offline: refused with the reason, the sheet and its words kept.
  await page.getByRole("region", { name: account.details }).getByRole("button", { name: account.nameLabel }).click();
  const sheet = page.getByRole("dialog", { name: account.changeName });
  const name = sheet.getByRole("textbox", { name: /^Name/ });
  await name.fill("Asha M Menon");
  await sheet.getByRole("button", { name: actions.save }).click();
  const refused = page.getByRole("alertdialog", { name: account.detailsNotSaved });
  await expect(refused).toContainText(ERROR_MESSAGES.NETWORK_OFFLINE);
  await expectAccessible(page);
  await refused.getByRole("button", { name: actions.close }).click();
  await expect(name).toHaveValue("Asha M Menon");

  // Back online: the band goes, and the same save goes through.
  await context.setOffline(false);
  await expect(band).toHaveCount(0);
  await sheet.getByRole("button", { name: actions.save }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("region", { name: account.details })).toContainText("Asha M Menon");
});
