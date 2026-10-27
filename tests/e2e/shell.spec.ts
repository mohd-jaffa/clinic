import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { expectAccessible, greetingFor } from "@tests/support/e2e";
import { addMember, registerClinic, removeAll, type TestClinic } from "@tests/support/integration";

/**
 * The shell (plan §31.1, D67–D69): every signed-in screen's frame, at a
 * phone's width and a desktop's, for an owner and for a member who may do
 * little. It signs in through the API, as the sign-in screen does, to stay
 * quick; the screen itself is walked in account.spec.ts.
 */
let clinic: TestClinic;

test.beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care Dental" });
});

test.afterAll(removeAll);

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

const { nav, quickActions, auth } = UI_TEXT;
const main = (page: Page) => page.getByRole("navigation", { name: nav.main });

test("an owner finds every place, the account and what they may add, accessibly", async ({ page }, { project }) => {
  await signIn(page, clinic.owner.email, clinic.owner.password);
  await expect(page.getByRole("heading", { level: 1, name: greetingFor("Asha") })).toBeVisible();
  await expect(page).toHaveTitle(`${nav.places.home} · ${UI_TEXT.appName}`);
  await expect(main(page).getByRole("link", { name: nav.places.home })).toHaveAttribute("aria-current", "page");
  await expectAccessible(page);

  if (project.name === "phone") {
    await expect(main(page).getByRole("link")).toHaveText([nav.places.home, nav.places.queue, nav.places.patients]);
    await main(page).getByRole("button", { name: nav.more }).click();
    const more = page.getByRole("dialog", { name: nav.more });
    await expect(more.getByRole("link", { name: "Asha Menon" })).toBeVisible();
    await expect(more.getByText(nav.membership("Smile Care Dental", "Owner"))).toBeVisible();
    await expect(more.getByRole("navigation", { name: nav.more }).getByRole("link")).toHaveCount(7);
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(more).toBeHidden();
  } else {
    await expect(page.getByText("Smile Care Dental", { exact: true }).first()).toBeVisible();
    await expect(main(page).getByRole("link")).toHaveCount(10);
    await page.getByRole("button", { name: nav.account("Asha Menon") }).click();
    await expect(page.getByRole("link", { name: nav.myAccount })).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("link", { name: nav.myAccount })).toBeHidden();
  }

  await page.getByRole("button", { name: quickActions.title }).click();
  const lobe = page.getByRole("dialog", { name: quickActions.title });
  await expect(lobe.getByRole("link")).toHaveText([
    quickActions.walkIn,
    quickActions.appointment,
    quickActions.patient,
    quickActions.payment,
    quickActions.expense,
  ]);
  await expectAccessible(page);
  // Quick add goes to the action's own screen, its form named (D67).
  await lobe.getByRole("link", { name: quickActions.patient }).click();
  await expect(page).toHaveURL(/\/patients\?add=patient$/);
});

test("signing out asks first, then leaves for sign-in and stays out", async ({ page }, { project }) => {
  await signIn(page, clinic.owner.email, clinic.owner.password);

  if (project.name === "phone") {
    await main(page).getByRole("button", { name: nav.more }).click();
    await page.getByRole("dialog", { name: nav.more }).getByRole("button", { name: auth.signOut }).click();
  } else {
    await page.getByRole("button", { name: nav.account("Asha Menon") }).click();
    await page.getByRole("button", { name: auth.signOut }).click();
  }
  const card = page.getByRole("alertdialog", { name: auth.signOutTitle });
  await expect(card).toBeVisible();
  await expectAccessible(page);
  await card.getByRole("button", { name: auth.staySignedIn }).click();
  await expect(card).toBeHidden();
  await expect(page).toHaveURL(/\/home$/);

  // Still where they were: the More sheet open on a phone; on a desktop, the
  // account button they opened the menu from.
  if (project.name === "phone") {
    await page.getByRole("dialog", { name: nav.more }).getByRole("button", { name: auth.signOut }).click();
  } else {
    await expect(page.getByRole("button", { name: nav.account("Asha Menon") })).toBeFocused();
    await page.getByRole("button", { name: nav.account("Asha Menon") }).click();
    await page.getByRole("button", { name: auth.signOut }).click();
  }
  await page.getByRole("alertdialog", { name: auth.signOutTitle }).getByRole("button", { name: auth.signOut }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/home");
  await expect(page).toHaveURL(/\/login$/);
});

test("a member sees only the places they may open, and no ＋ when they may add nothing", async ({ page }) => {
  const member = await addMember(clinic.clinicId, { permissions: ["patients.view", "expenses.view"] });
  await signIn(page, member.email, member.password);

  await expect(main(page).getByRole("link", { name: nav.places.queue })).toHaveCount(0);
  await expect(main(page).getByRole("link", { name: nav.places.patients })).toBeVisible();
  await expect(page.getByRole("button", { name: quickActions.title })).toHaveCount(0);
  await expectAccessible(page);
});
