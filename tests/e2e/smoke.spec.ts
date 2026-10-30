import { expect, test } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { expectAccessible } from "@tests/support/e2e";

test("the built app serves its first page, accessibly", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: UI_TEXT.landing.headline })).toBeVisible();
  await expect(page).toHaveTitle(UI_TEXT.landing.pageTitle(UI_TEXT.appName));
  await expectAccessible(page);
});
