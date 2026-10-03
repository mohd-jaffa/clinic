import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT, VALIDATION_MESSAGES } from "@/constants/messages";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, aMobileNumber, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Settings and My account (plan §5.4, §31.2, D71, D72): the index each person
 * may open, and their own account — the name, the mobile and the password
 * each changed in a sheet, and the theme kept on the device — at a phone's
 * width and a desktop's, each checked by axe.
 */
test.afterAll(removeAll);

const { account, settings, nav, theme } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const region = (page: Page, name: string) => page.getByRole("region", { name });

test("the owner's Settings: their account, the clinic's setup, the plan and records, and Sign out", async ({
  page,
}) => {
  const { owner } = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care Dental" });
  await signIn(page, owner.email, owner.password);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: nav.places.settings })).toBeVisible();
  await expect(page).toHaveTitle(`${nav.places.settings} · ${UI_TEXT.appName}`);
  await expect(region(page, settings.groups.clinic).getByRole("link")).toHaveCount(5);
  await expect(region(page, settings.groups.owner).getByRole("link")).toHaveCount(5);
  await expect(page.getByRole("button", { name: UI_TEXT.auth.signOut })).toBeVisible();
  // Nothing on it is wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize()!.width);
  await expectAccessible(page);

  await region(page, settings.you).getByRole("link", { name: "Asha Menon" }).click();
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(page.getByRole("heading", { level: 1, name: nav.myAccount })).toBeVisible();
});

test("My account changes the name, the mobile and the password, each in its sheet", async ({ page }) => {
  const { owner } = await registerClinic({ fullName: "Asha Menon" });
  await signIn(page, owner.email, owner.password);
  await page.goto("/settings/account");
  await expect(page).toHaveTitle(`${nav.myAccount} · ${UI_TEXT.appName}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize()!.width);
  await expectAccessible(page);
  const details = region(page, account.details);

  // The name: saved, and the screen, the shell and a fresh page all have it.
  await details.getByRole("button", { name: account.nameLabel }).click();
  const name = page.getByRole("dialog", { name: account.changeName });
  await expect(name.getByRole("textbox", { name: /^Name/ })).toBeFocused();
  await expectAccessible(page);
  await name.getByRole("textbox", { name: /^Name/ }).fill("Asha M Menon");
  await name.getByRole("button", { name: UI_TEXT.actions.save }).click();
  await expect(name).toBeHidden();
  await expect(details).toContainText("Asha M Menon");
  await page.reload();
  await expect(region(page, account.details)).toContainText("Asha M Menon");

  // The mobile: refused beside the field until it is one, then it signs in.
  const mobile = aMobileNumber();
  await details.getByRole("button", { name: account.phoneLabel }).click();
  const phone = page.getByRole("dialog", { name: account.changePhone });
  await phone.getByRole("textbox", { name: /^Mobile number/ }).fill("12345");
  await phone.getByRole("button", { name: UI_TEXT.actions.save }).click();
  await expect(phone.getByText(VALIDATION_MESSAGES.phone)).toBeVisible();
  await expectAccessible(page);
  await phone.getByRole("textbox", { name: /^Mobile number/ }).fill(mobile);
  await phone.getByRole("button", { name: UI_TEXT.actions.save }).click();
  await expect(phone).toBeHidden();
  await expect(details).toContainText(`${mobile.slice(0, 5)} ${mobile.slice(5)}`);

  // The password: a wrong current one said beside it; then changed, and it signs in.
  await page.getByRole("button", { name: account.changePassword }).click();
  const password = page.getByRole("dialog", { name: account.changePassword });
  await password.getByLabel(/^Current password/).fill("not-the-password");
  await password.getByLabel(/^New password/).fill("A-new-password-3");
  await password.getByRole("button", { name: account.changePassword }).click();
  await expect(password.getByText("Your current password isn't right.")).toBeVisible();
  await expectAccessible(page);
  await password.getByLabel(/^Current password/).fill(owner.password);
  await password.getByRole("button", { name: account.changePassword }).click();
  const changed = page.getByRole("dialog", { name: account.passwordChanged });
  await expect(changed).toBeVisible();
  await expectAccessible(page);
  await changed.getByRole("button", { name: UI_TEXT.actions.close }).click();

  // Still signed in here; and the new mobile and password are the way in.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: nav.myAccount })).toBeVisible();
  await page.context().clearCookies();
  await signIn(page, mobile, "A-new-password-3");
});

test("the theme is chosen for this device, and kept from the first paint", async ({ page }) => {
  const { owner } = await registerClinic({ fullName: "Asha Menon" });
  await signIn(page, owner.email, owner.password);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/settings/account");

  const themes = page.getByRole("radiogroup", { name: theme.label });
  await expect(themes.getByRole("radio", { name: theme.system })).toBeChecked();
  await themes.getByRole("radio", { name: theme.dark }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectAccessible(page);

  // Drawn dark before any script of the app's runs: the boot script set it.
  await page.reload({ waitUntil: "commit" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(themes.getByRole("radio", { name: theme.dark })).toBeChecked();

  await themes.getByRole("radio", { name: theme.system }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
});

test("a member who may set nothing up sees only their account and Sign out", async ({ page }) => {
  const { clinicId } = await registerClinic();
  const member = await addMember(clinicId, { permissions: ["patients.view"] });
  await signIn(page, member.email, member.password);

  await page.goto("/settings");
  await expect(region(page, settings.you)).toBeVisible();
  await expect(region(page, settings.groups.clinic)).toHaveCount(0);
  await expect(region(page, settings.groups.owner)).toHaveCount(0);
  await expect(page.getByRole("button", { name: UI_TEXT.auth.signOut })).toBeVisible();
  await expectAccessible(page);
});
