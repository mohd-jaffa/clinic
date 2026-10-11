import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { ALL_NAV, MORE_NAV, placesFor } from "@/constants/navigation";
import { PERMISSION_PRESET_SETS, type Permission } from "@/constants/permissions";
import { expectAccessible, inviteMember, joinByInvite } from "@tests/support/e2e";
import { anEmail, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Phase 3’s journey (plan §34; R3.8): the owner invites a receptionist
 * and a doctor — the doctor with their own fee — each accepts their link and
 * signs in, and each sees only what their permissions allow: their places in
 * the app, and no way into the team or the clinic's setup by address. At a
 * phone's width and a desktop's, each checked by axe.
 */
test.afterAll(removeAll);

const { nav, team, system } = UI_TEXT;

/** The places someone with these permissions finds: the sidebar's on a desktop, More's on a phone. */
async function expectPlaces(page: Page, phone: boolean, permissions: readonly Permission[]) {
  const member = { role: "STAFF" as const, permissions };
  if (phone) {
    await page.getByRole("navigation", { name: nav.main }).getByRole("button", { name: nav.more }).click();
    const more = page.getByRole("dialog", { name: nav.more }).getByRole("navigation", { name: nav.more });
    await expect(more.getByRole("link")).toHaveText(placesFor(member, MORE_NAV).map(({ label }) => label));
    await expectAccessible(page);
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByRole("navigation", { name: nav.main }).getByRole("link")).toHaveText(
      placesFor(member, ALL_NAV).map(({ label }) => label),
    );
    await expectAccessible(page);
  }
}

/** Neither the team nor the clinic's setup opens by its address. */
async function expectShutOut(page: Page) {
  for (const path of ["/team", "/settings/price-list", "/settings/closures"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: system.noAccessTitle })).toBeVisible();
  }
}

test("a receptionist and a doctor join, and each sees only what they may", async ({ page, browser }, { project }) => {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const receptionist = { name: "Meera Pillai", email: anEmail() };
  const doctor = { name: "Rahul Nair", email: anEmail(), doctor: true };
  expect(
    (
      await page.request.post("/api/auth/login", {
        data: { identifier: clinic.owner.email, password: clinic.owner.password },
      })
    ).ok(),
  ).toBe(true);

  await page.goto("/team");
  await inviteMember(page, receptionist);
  await inviteMember(page, doctor);
  await expect(page.getByRole("list", { name: team.invitedList })).toContainText("Meera Pillai");
  await expect(page.getByRole("list", { name: team.invitedList })).toContainText("Rahul Nair");

  const phone = project.name === "phone";
  const front = await joinByInvite(browser, page, receptionist.email);
  await expectPlaces(front, phone, PERMISSION_PRESET_SETS.RECEPTIONIST.permissions);
  await expectShutOut(front);

  const consulting = await joinByInvite(browser, page, doctor.email);
  await expectPlaces(consulting, phone, PERMISSION_PRESET_SETS.DOCTOR.permissions);
  await expectShutOut(consulting);

  // Both are on the team now, the doctor with their own fee.
  await page.reload();
  await expect(page.getByRole("list", { name: team.invitedList })).toHaveCount(0);
  await expect(page.getByRole("list", { name: team.people })).toContainText("Meera Pillai");
  await page.getByRole("link", { name: "Rahul Nair" }).click();
  await expect(page.getByText("Fee ₹700")).toBeVisible();
});
