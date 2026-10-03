import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, registerClinic, removeAll } from "@tests/support/integration";

/**
 * The clinic's catalogues (plan §9; R3.2, D80 – D83): the price list grouped
 * by category and searched, a service added, changed from its row and
 * archived and restored; the last Consultation kept; an appointment type
 * added at the end; an expense category renamed. A member without
 * settings.manage is told the screens are not theirs. At a phone's width and
 * a desktop's, each checked by axe.
 */
test.afterAll(removeAll);

const { actions, catalogues, priceList, appointmentTypes, expenseCategories, settings } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });

test("the owner keeps the price list", async ({ page }) => {
  const { owner } = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  await signIn(page, owner.email, owner.password);

  await page.goto("/settings");
  await page.getByRole("link", { name: settings.items.priceList.label }).click();
  await expect(page).toHaveURL(/\/settings\/price-list$/);
  await expect(page.getByRole("heading", { level: 1, name: settings.items.priceList.label })).toBeVisible();
  await expect(page.getByText(priceList.count(1))).toBeVisible();
  await expectAccessible(page);

  // Added, in its category, with its price.
  await page.getByRole("button", { name: priceList.add }).click();
  const adding = page.getByRole("dialog", { name: priceList.addTitle });
  await expect(adding.getByRole("textbox", { name: /^Service name/ })).toBeFocused();
  await adding.getByRole("textbox", { name: /^Service name/ }).fill("Root canal");
  await adding.getByRole("combobox", { name: /^Category/ }).click();
  await page.getByRole("option", { name: "Procedure" }).click();
  await adding.getByRole("textbox", { name: /^Price/ }).fill("4,500");
  await expectAccessible(page);
  await adding.getByRole("button", { name: actions.save }).click();
  await expect(adding).toBeHidden();
  await expect(notice(page, priceList.added("Root canal"))).toBeVisible();
  const procedures = page.getByRole("region", { name: "Procedure" });
  await expect(procedures).toContainText("Root canal₹4,500");

  // A tap on the price opens the service too: the row's target lies over it,
  // so the click lands where the price is and the browser decides who gets it.
  await procedures.getByText("₹4,500").click({ force: true });
  const changing = page.getByRole("dialog", { name: priceList.editTitle });
  await changing.getByRole("textbox", { name: /^Price/ }).fill("5000");
  await changing.getByRole("button", { name: actions.save }).click();
  await expect(notice(page, catalogues.savedNote("Root canal"))).toBeVisible();
  await expect(procedures).toContainText("₹5,000");

  // Found by name.
  await page.getByRole("searchbox", { name: priceList.search }).fill("root");
  await expect(page.getByRole("region", { name: "Consultation" })).toHaveCount(0);
  await page.getByRole("searchbox", { name: priceList.search }).fill("");

  // The last Consultation stays (D83).
  await page.getByRole("region", { name: "Consultation" }).getByRole("button", { name: "Consultation" }).click();
  await page
    .getByRole("dialog", { name: priceList.editTitle })
    .getByRole("button", { name: catalogues.archive })
    .click();
  await page
    .getByRole("alertdialog", { name: priceList.archiveTitle("Consultation") })
    .getByRole("button", { name: catalogues.archive })
    .click();
  await expect(page.getByRole("alertdialog", { name: catalogues.notChanged })).toContainText(
    "The price list keeps at least one Consultation",
  );
  await expectAccessible(page);
  await page
    .getByRole("alertdialog", { name: catalogues.notChanged })
    .getByRole("button", { name: actions.close })
    .click();
  await page.keyboard.press("Escape");

  // Archived, asked first, and restored (D80).
  await procedures.getByRole("button", { name: "Root canal" }).click();
  await page
    .getByRole("dialog", { name: priceList.editTitle })
    .getByRole("button", { name: catalogues.archive })
    .click();
  await page
    .getByRole("alertdialog", { name: priceList.archiveTitle("Root canal") })
    .getByRole("button", { name: catalogues.archive })
    .click();
  await expect(notice(page, catalogues.archivedNote("Root canal"))).toBeVisible();
  await expect(page.getByRole("region", { name: "Procedure" })).toHaveCount(0);
  await page.getByRole("button", { name: catalogues.showArchived(1) }).click();
  await expectAccessible(page);
  await page.getByRole("button", { name: catalogues.restoreNamed("Root canal") }).click();
  await expect(notice(page, catalogues.restoredNote("Root canal"))).toBeVisible();
  await expect(page.getByRole("region", { name: "Procedure" })).toContainText("Root canal₹5,000");
});

test("the owner adds an appointment type and renames an expense category", async ({ page }) => {
  const { owner } = await registerClinic();
  await signIn(page, owner.email, owner.password);

  await page.goto("/settings/appointment-types");
  await expect(page.getByRole("heading", { level: 1, name: settings.items.appointmentTypes.label })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: appointmentTypes.add }).click();
  const adding = page.getByRole("dialog", { name: appointmentTypes.addTitle });
  await adding.getByRole("textbox", { name: /^Name/ }).fill("Root canal");
  await adding.getByRole("textbox", { name: /^Length in minutes/ }).fill("45");
  await adding.getByRole("button", { name: actions.save }).click();
  await expect(notice(page, appointmentTypes.added("Root canal"))).toBeVisible();
  // At the end of the list (D81).
  await expect(
    page.getByRole("list", { name: settings.items.appointmentTypes.label }).getByRole("listitem").last(),
  ).toHaveText("Root canal45 min");

  await page.goto("/settings/expense-categories");
  await expect(page.getByRole("heading", { level: 1, name: settings.items.expenseCategories.label })).toBeVisible();
  await page.getByRole("button", { name: "Rent", exact: true }).click();
  const renaming = page.getByRole("dialog", { name: expenseCategories.editTitle });
  await renaming.getByRole("textbox", { name: /^Name/ }).fill("Lease");
  await expectAccessible(page);
  await renaming.getByRole("button", { name: actions.save }).click();
  await expect(notice(page, catalogues.savedNote("Lease"))).toBeVisible();
  await expect(
    page.getByRole("list", { name: settings.items.expenseCategories.label }).getByRole("listitem").first(),
  ).toHaveText("Lease");
});

test("a member without settings.manage is told these screens are not theirs", async ({ page }) => {
  const { clinicId } = await registerClinic();
  const member = await addMember(clinicId, { permissions: ["patients.view"] });
  await signIn(page, member.email, member.password);

  for (const path of ["/settings/price-list", "/settings/appointment-types", "/settings/expense-categories"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: UI_TEXT.system.noAccessTitle })).toBeVisible();
  }
  await expectAccessible(page);
});
