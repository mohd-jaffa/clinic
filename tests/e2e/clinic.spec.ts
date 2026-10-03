import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Clinic details (plan §9, D78, D79; R3.1): the details changed in their
 * sheet, the paper size and the fee timing saved as they are picked, and the
 * logo added, shown — in the sidebar too — and removed, asked first; a member
 * without settings.manage is told the screen is not theirs. At a phone's
 * width and a desktop's, each checked by axe.
 */
test.afterAll(removeAll);

const { clinic, actions, settings } = UI_TEXT;

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });

test("the owner changes the clinic's details, how its bills print, and its logo", async ({ page }, { project }) => {
  const { owner } = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  await signIn(page, owner.email, owner.password);

  await page.goto("/settings");
  await page.getByRole("link", { name: settings.items.clinic.label }).click();
  await expect(page).toHaveURL(/\/settings\/clinic$/);
  await expect(page.getByRole("heading", { level: 1, name: settings.items.clinic.label })).toBeVisible();
  await expect(page).toHaveTitle(`${settings.items.clinic.label} · ${UI_TEXT.appName}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize()!.width);
  await expectAccessible(page);

  // The details, in their one sheet.
  const details = page.getByRole("region", { name: clinic.details });
  await details.getByRole("button", { name: clinic.nameLabel }).click();
  const sheet = page.getByRole("dialog", { name: clinic.changeDetails });
  await expect(sheet.getByRole("textbox", { name: /^Clinic name/ })).toBeFocused();
  await sheet.getByRole("textbox", { name: /^Clinic name/ }).fill("Smile Care Dental");
  await sheet.getByRole("textbox", { name: /^GSTIN/ }).fill("32abcde1234f1z5");
  await expectAccessible(page);
  await sheet.getByRole("button", { name: actions.save }).click();
  await expect(sheet).toBeHidden();
  await expect(notice(page, clinic.detailsSaved)).toBeVisible();
  await expect(details).toContainText("Smile Care Dental");
  await expect(details).toContainText("32ABCDE1234F1Z5");

  // How bills and prescriptions are made: saved as picked, and still so after a reload.
  await page.getByRole("radiogroup", { name: clinic.paperSize }).getByRole("radio", { name: "A5" }).click();
  await expect(notice(page, clinic.paperSizeSaved("A5"))).toBeVisible();
  await page.getByRole("radiogroup", { name: clinic.feeTiming }).getByRole("radio", { name: "At arrival" }).click();
  await expect(notice(page, clinic.feeTimingSaved("At arrival"))).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: "A5" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "At arrival" })).toBeChecked();

  // The logo: added, shown here and — on a desktop — at the top of the sidebar.
  const logo = page.getByRole("region", { name: clinic.logo });
  await logo.locator("input[type=file]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(notice(page, clinic.logoSaved)).toBeVisible();
  await expect(logo.getByRole("img", { name: clinic.logoAlt("Smile Care Dental") })).toBeVisible();
  if (project.name === "desktop") {
    await expect(
      page.getByRole("complementary").getByRole("img", { name: clinic.logoAlt("Smile Care Dental") }),
    ).toBeVisible();
  }
  await expectAccessible(page);

  // Removed, asked first.
  await logo.getByRole("button", { name: clinic.removeLogo }).click();
  const ask = page.getByRole("alertdialog", { name: clinic.removeLogoTitle });
  await expectAccessible(page);
  await ask.getByRole("button", { name: clinic.removeLogo }).click();
  await expect(notice(page, clinic.logoRemoved)).toBeVisible();
  await expect(logo.getByRole("img")).toHaveCount(0);
  await expect(logo.getByRole("button", { name: clinic.addLogo })).toBeVisible();
});

test("a member without settings.manage is told the screen is not theirs", async ({ page }) => {
  const { clinicId } = await registerClinic();
  const member = await addMember(clinicId, { permissions: ["patients.view"] });
  await signIn(page, member.email, member.password);

  await page.goto("/settings/clinic");
  await expect(page.getByRole("heading", { level: 1, name: UI_TEXT.system.noAccessTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: UI_TEXT.system.toHome })).toBeVisible();
  await expectAccessible(page);
});
