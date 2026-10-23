import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { addMonthsKey, monthStartKey, todayKey } from "@/lib/dates/calendar";
import { formatMonthYear } from "@/lib/format/date";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Expenses (plan §16; R9.2, D328 – D333, D343, D344), at a phone's width and
 * a desktop's — the phase's exit: an expense added, corrected and archived
 * shows rightly in the month's totals. Priya keeps the books: Supplies from
 * the ＋, Rent from Add expense; the month's total and each category's; the
 * Supplies corrected from its row; Rent kept to alone, then archived — out
 * of the totals — and restored from Show archived; last month, empty. Anil
 * only reads them: no Add expense, no row to open. Each screen checked by
 * axe, nothing wider than the screen.
 */
test.afterAll(removeAll);

const { expenses: words, quickActions } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });
const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
const spent = (page: Page) =>
  page.getByText(words.spentIn(formatMonthYear(todayKey()))).locator("xpath=following-sibling::p");
const categoryTotal = (page: Page, name: string) =>
  page
    .getByRole("list", { name: words.byCategory })
    .getByRole("button", { name: new RegExp(`^${words.onlyOf(name)}:`) });

test("the books: an expense added, corrected, archived and restored, the month's totals right throughout", async ({
  page,
  browser,
}) => {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const [priya, anil] = await Promise.all([
    addMember(clinic.clinicId, { permissions: ["expenses.view", "expenses.create", "expenses.edit"] }),
    addMember(clinic.clinicId, { permissions: ["expenses.view"] }),
  ]);
  await signIn(page, priya.email, priya.password);

  // Supplies from the ＋ (D67): its sheet open on Expenses; the category picked from the chips (D343).
  await page.goto("/home");
  await page.getByRole("button", { name: quickActions.title }).click();
  await page
    .getByRole("dialog", { name: quickActions.title })
    .getByRole("link", { name: quickActions.expense })
    .click();
  await expect(page).toHaveURL(/\/expenses\?add=expense$/);
  const sheet = page.getByRole("dialog", { name: words.addTitle });
  await sheet.getByRole("radiogroup", { name: words.categoryLabel }).getByRole("radio", { name: "Supplies" }).click();
  await sheet.getByRole("textbox", { name: new RegExp(`^${words.amountLabel}`) }).fill("1,250.50");
  await sheet.getByRole("radiogroup", { name: words.methodLabel }).getByRole("radio", { name: "UPI" }).click();
  await sheet.getByRole("textbox", { name: new RegExp(`^${words.descriptionLabel}`) }).fill("Gloves");
  await expectAccessible(page);
  await sheet.getByRole("button", { name: words.save }).click();
  await expect(notice(page, words.added("₹1,250.50", "Supplies"))).toBeVisible();
  await expect(spent(page)).toHaveText("₹1,250.50");

  // Rent from Add expense, by bank transfer.
  await page.getByRole("button", { name: words.add }).click();
  await sheet.getByRole("radio", { name: "Rent" }).click();
  await sheet.getByRole("textbox", { name: new RegExp(`^${words.amountLabel}`) }).fill("25000");
  await sheet.getByRole("radio", { name: "Bank transfer" }).click();
  await sheet.getByRole("button", { name: words.save }).click();
  await expect(notice(page, words.added("₹25,000", "Rent"))).toBeVisible();
  await expect(spent(page)).toHaveText("₹26,250.50");
  await expect(categoryTotal(page, "Rent")).toContainText("₹25,000");
  const today = page.getByRole("list", { name: words.today });
  await expect(today.getByRole("listitem")).toHaveCount(2);
  await expect(today).toContainText("Gloves · UPI");
  await fitsTheScreen(page);
  await expectAccessible(page);

  // The Supplies corrected from its row (D333, D344): the totals follow.
  await today.getByRole("button", { name: "Supplies" }).click();
  const editing = page.getByRole("dialog", { name: words.editTitle });
  await editing.getByRole("textbox", { name: new RegExp(`^${words.amountLabel}`) }).fill("1300");
  await expectAccessible(page);
  await editing.getByRole("button", { name: words.save }).click();
  await expect(notice(page, words.saved)).toBeVisible();
  await expect(spent(page)).toHaveText("₹26,300");

  // Rent alone (D330), then archived, asked first (D331): out of the totals.
  await categoryTotal(page, "Rent").click();
  await expect(categoryTotal(page, "Rent")).toHaveAttribute("aria-pressed", "true");
  await expect(today.getByRole("listitem")).toHaveCount(1);
  await today.getByRole("button", { name: "Rent" }).click();
  await editing.getByRole("button", { name: UI_TEXT.actions.archive }).click();
  const ask = page.getByRole("alertdialog", { name: words.archiveAsk("₹25,000", "Rent") });
  await expectAccessible(page);
  await ask.getByRole("button", { name: UI_TEXT.actions.archive }).click();
  await expect(notice(page, words.archived)).toBeVisible();
  await expect(spent(page)).toHaveText("₹1,300");
  await page.getByRole("button", { name: words.showAll }).click();
  await expect(page.getByRole("list", { name: words.byCategory }).getByRole("listitem")).toHaveCount(1);

  // Restored from Show archived: back in the totals.
  await page.getByRole("button", { name: words.showArchived }).click();
  await page.getByRole("button", { name: words.restoreOf("₹25,000", "Rent") }).click();
  await expect(notice(page, words.restored)).toBeVisible();
  await expect(spent(page)).toHaveText("₹26,300");
  await expect(page.getByText(words.archivedEmpty)).toBeVisible();
  await fitsTheScreen(page);
  await expectAccessible(page);

  // Last month: nothing; none after this one (D328).
  await expect(page.getByRole("button", { name: words.nextMonth })).toBeDisabled();
  await page.getByRole("button", { name: words.previousMonth }).click();
  await expect(page.getByText(formatMonthYear(addMonthsKey(monthStartKey(todayKey()), -1)))).toBeVisible();
  await expect(page.getByRole("heading", { name: words.empty })).toBeVisible();
  await expectAccessible(page);

  // Anil reads the books, and changes nothing.
  const reader = await browser.newContext({ viewport: page.viewportSize()! });
  const readerPage = await reader.newPage();
  await signIn(readerPage, anil.email, anil.password);
  await readerPage.goto("/expenses");
  await expect(spent(readerPage)).toHaveText("₹26,300");
  await expect(readerPage.getByRole("button", { name: words.add })).toHaveCount(0);
  await expect(readerPage.getByRole("list", { name: words.today }).getByRole("button")).toHaveCount(0);
  await expectAccessible(readerPage);
  await reader.close();
});
