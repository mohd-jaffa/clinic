import { expect, test } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { CHOSEN_THEME_COLOR, THEME_COLORS, THEME_STORAGE_KEY } from "@/lib/theme/themes";
import { expectAccessible } from "@tests/support/e2e";

/** A token's colour as the browser reports it: "#0d1813" → "rgb(13, 24, 19)". */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(", ")})`;

const ground = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

test.describe("the themes (D36)", () => {
  test("follow a dark device, accessibly", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: UI_TEXT.landing.headline })).toBeVisible();
    expect(await ground(page)).toBe(rgb(THEME_COLORS.dark));
    await expectAccessible(page);
  });

  test("follow a light device", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    expect(await ground(page)).toBe(rgb(THEME_COLORS.light));
  });

  test("draw a chosen Dark from the first paint, on a light device, toolbar included", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.addInitScript((key) => window.localStorage.setItem(key, "dark"), THEME_STORAGE_KEY);
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await ground(page)).toBe(rgb(THEME_COLORS.dark));
    // The chosen colour leads; the device's own stay as Next drew them, and
    // hydration adds none.
    const toolbars = await page
      .locator('meta[name="theme-color"]')
      .evaluateAll(
        (metas, chosen) =>
          metas.map((meta) => [
            meta.hasAttribute(chosen) ? "chosen" : meta.getAttribute("media"),
            meta.getAttribute("content"),
          ]),
        CHOSEN_THEME_COLOR,
      );
    expect(toolbars).toEqual([
      ["chosen", THEME_COLORS.dark],
      ["(prefers-color-scheme: light)", THEME_COLORS.light],
      ["(prefers-color-scheme: dark)", THEME_COLORS.dark],
    ]);
    await expectAccessible(page);
  });

  test("set every word in Figtree", async ({ page }) => {
    await page.goto("/");
    const family = await page
      .getByRole("heading", { level: 1 })
      .evaluate((heading) => getComputedStyle(heading).fontFamily);
    expect(family).toMatch(/Figtree/);
  });
});
