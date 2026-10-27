import { expect, test } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { expectAccessible, greetingFor } from "@tests/support/e2e";
import { registerClinic, removeAll } from "@tests/support/integration";

/**
 * The system screens (plan §31.2). A screen that fails is checked in the unit
 * tests: the built app has no screen that fails on purpose.
 */
test.afterAll(removeAll);

test("an address the app does not have says so, names the tab, and leads home, accessibly", async ({ page }) => {
  const { owner } = await registerClinic();
  const answer = await page.request.post("/api/auth/login", {
    data: { identifier: owner.email, password: owner.password },
  });
  expect(answer.ok()).toBe(true);

  const response = await page.goto("/no-such-place");
  expect(response?.status()).toBe(404);
  const { system } = UI_TEXT;
  await expect(page.getByRole("heading", { level: 1, name: system.notFoundTitle })).toBeVisible();
  await expect(page).toHaveTitle(`${system.notFoundTitle} · ${UI_TEXT.appName}`);
  expect(await page.locator("title").count()).toBe(1);
  await expectAccessible(page);

  await page.getByRole("link", { name: system.toHome }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 1, name: greetingFor("Test") })).toBeVisible();
});
