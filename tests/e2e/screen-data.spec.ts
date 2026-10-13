import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { createPatient } from "@/features/patients/api";
import { patientSchema } from "@/lib/validation";
import { aMobileNumber, registerClinic, removeAll, type TestClinic } from "@tests/support/integration";

/**
 * The data a screen arrives with (AGENTS.md §9, plan §37.1, D190): a screen
 * opened again shows what the server has just read for it — not the copy the
 * browser kept from the last time — and does not ask for it again. Gone back
 * to through the browser's history, it is the page as it was first read, so
 * the screen asks for its data again.
 */
let clinic: TestClinic;

test.beforeAll(async () => {
  clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care Dental" });
});

test.afterAll(removeAll);

const { nav } = UI_TEXT;
const main = (page: Page) => page.getByRole("navigation", { name: nav.main });
const patientLink = (page: Page, name: string) => page.getByRole("link", { name: new RegExp(`^${name}`) });

/** A patient added by someone else at the desk while this screen is away. */
async function added(name: string) {
  const typed = { fullName: name, phone: aMobileNumber(), born: { as: "DATE", date: "1985-04-12" }, gender: "FEMALE" };
  await createPatient(clinic.owner.tenant, patientSchema.parse(typed), randomUUID());
}

/**
 * What the browser asks the API for the patients screen while `step` runs,
 * and until the frame after it, when SWR asks for what a screen mounted with.
 */
async function asked(page: Page, step: () => Promise<void>): Promise<string[]> {
  const reads: string[] = [];
  const note = (request: { url: () => string }) => {
    const { pathname } = new URL(request.url());
    if (pathname === "/api/patients/search" || pathname === "/api/doctors") reads.push(pathname);
  };
  page.on("request", note);
  await step();
  await page.evaluate(
    () => new Promise((settle) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(settle, 300)))),
  );
  page.off("request", note);
  return reads;
}

async function toQueue(page: Page) {
  await main(page).getByRole("link", { name: nav.places.queue }).click();
  await expect(page).toHaveURL(/\/queue$/);
}

test("a screen opened again shows what the server just read, and asks for nothing more", async ({ page }) => {
  await added("Ravi Kumar");
  const answer = await page.request.post("/api/auth/login", {
    data: { identifier: clinic.owner.email, password: clinic.owner.password },
  });
  expect(answer.ok()).toBe(true);
  await page.goto("/patients");
  await expect(patientLink(page, "Ravi Kumar")).toBeVisible();

  // Back through history: the page as first read, before Lakshmi was added —
  // shown, and the list asked for again.
  await added("Lakshmi Rao");
  await toQueue(page);
  const back = await asked(page, async () => {
    await page.goBack();
    await expect(patientLink(page, "Lakshmi Rao")).toBeVisible();
  });
  expect(back).toContain("/api/patients/search");

  // Coming back to the app reads the list again in the browser, which keeps
  // it — once the screen has been open a few seconds (SWR's focus throttle).
  let reread = false;
  page.on("requestfinished", (request) => {
    if (new URL(request.url()).pathname === "/api/patients/search") reread = true;
  });
  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        return reread;
      },
      { timeout: 15_000, intervals: [1_000] },
    )
    .toBe(true);

  // Opened again, it shows what the server read just now — Meena, added since
  // the browser's copy — and asks for nothing.
  await added("Meena Iyer");
  await toQueue(page);
  const again = await asked(page, async () => {
    await main(page).getByRole("link", { name: nav.places.patients }).click();
    await expect(patientLink(page, "Meena Iyer")).toBeVisible();
  });
  expect(again).toEqual([]);
  await expect(patientLink(page, "Lakshmi Rao")).toBeVisible();
});
