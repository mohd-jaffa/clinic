import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { addWalkIn } from "@/features/appointments/api";
import { walkInSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * The queue's moves and the visit (plan §11.4, §12.1; R6.1, D192 – D198).
 * On a phone the desk sends a patient in, marks the next one stepped out,
 * moves on with Next patient — which skips them — sends them in on their
 * return beside the patient still in, keeping both, puts one back to waiting
 * and marks the other done. On a desktop the same from the columns. A doctor,
 * at either width, runs a session from the visit screen with Next patient
 * alone: the room free, the visit with the patient's allergy in view, the
 * next one's, and no one left. Each checked by axe, nothing wider than the
 * screen.
 */
test.afterAll(removeAll);

const { queue } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

/** Asha Menon's clinic, Maya Rao its doctor, a front desk, and patients walked in to Maya by token, in the order named. */
async function aSessionWithMaya(names: readonly string[]) {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const maya = await addMember(clinic.clinicId, {
    role: "DOCTOR",
    permissions: ["patients.view", "appointments.view", "appointments.edit", "visits.view"],
  });
  await admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId);
  const desk = await addMember(clinic.clinicId, {
    permissions: ["patients.view", "patients.create", "appointments.view", "appointments.create", "appointments.edit"],
  });
  const [{ data: doctor }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id").eq("member_id", maya.memberId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const patients: Record<string, string> = {};
  for (const name of names) {
    const { data, error } = await desk
      .tenant!.supabase.rpc("create_patient", {
        p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    if (error) throw error;
    patients[name] = data.patient_id;
    await addWalkIn(
      desk.tenant!,
      walkInSchema.parse({ patient: { mode: "FOUND", id: data.patient_id }, doctorId: doctor!.id, typeId: type!.id }),
      randomUUID(),
    );
  }
  return { clinic, maya, desk, patients };
}

const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });
const lake = (page: Page, name: string) => page.getByRole("region", { name: `${queue.withDoctor}: ${name}` });
const waitingRow = (page: Page, name: string) =>
  page.getByRole("list", { name: queue.waiting }).getByRole("listitem").filter({ hasText: name });

test("on a phone the desk sends in, skips one stepped out, keeps two in, and moves them on", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "the lake is the phone's");
  const { desk } = await aSessionWithMaya(["Rohan Mehta", "Kiran Das", "Sunil Nair"]);
  await signIn(page, desk.email, desk.password);
  await page.goto("/queue");

  await waitingRow(page, "Rohan Mehta")
    .getByRole("button", { name: queue.sendInOf("Rohan Mehta") })
    .click();
  await expect(notice(page, queue.sentIn("Rohan Mehta", "Maya Rao"))).toBeVisible();
  await expect(lake(page, "Rohan Mehta")).toContainText("01");
  await expectAccessible(page);

  // Kiran steps out: Next patient skips them, and sends in Sunil.
  await waitingRow(page, "Kiran Das").getByRole("button", { name: "Kiran Das", exact: true }).click();
  await page.getByRole("dialog", { name: "Kiran Das" }).getByRole("button", { name: queue.stepOut }).click();
  await expect(notice(page, queue.steppedOutCard("Kiran Das"))).toBeVisible();
  await expect(waitingRow(page, "Kiran Das")).toContainText(queue.steppedOut);
  await expectAccessible(page);

  await lake(page, "Rohan Mehta")
    .getByRole("button", { name: queue.nextPatientAfter("Rohan Mehta") })
    .click();
  await expect(notice(page, queue.sentIn("Sunil Nair", "Maya Rao"))).toBeVisible();
  await expect(lake(page, "Sunil Nair")).toBeVisible();
  await expect(lake(page, "Rohan Mehta")).toBeHidden();

  // Back, Kiran goes in beside Sunil — a second chair.
  await waitingRow(page, "Kiran Das")
    .getByRole("button", { name: queue.sendInOf("Kiran Das") })
    .click();
  const busy = page.getByRole("alertdialog", { name: queue.roomBusy("Sunil Nair", false, "Maya Rao") });
  await expect(busy).toBeVisible();
  await expectAccessible(page);
  await busy.getByRole("button", { name: queue.keepBothIn }).click();
  await expect(lake(page, "Kiran Das")).toBeVisible();
  await expect(lake(page, "Sunil Nair")).toBeVisible();
  await fitsTheScreen(page);

  // Kiran back to waiting, from their detail, opened from the lake; Sunil done.
  await lake(page, "Kiran Das").getByRole("button", { name: "Kiran Das", exact: true }).click();
  await page.getByRole("dialog", { name: "Kiran Das" }).getByRole("button", { name: queue.backToWaiting }).click();
  await expect(notice(page, queue.waitingAgain("Kiran Das"))).toBeVisible();
  await expect(waitingRow(page, "Kiran Das")).toBeVisible();
  await lake(page, "Sunil Nair")
    .getByRole("button", { name: queue.doneOf("Sunil Nair") })
    .click();
  await expect(notice(page, queue.markedDone("Sunil Nair"))).toBeVisible();
  await expect(page.getByRole("button", { name: queue.doneCount(2) })).toBeVisible();
  await expectAccessible(page);
});

test("on a desktop the desk moves the queue from its columns", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the columns are the wider screens' queue");
  const { desk } = await aSessionWithMaya(["Rohan Mehta", "Kiran Das"]);
  await signIn(page, desk.email, desk.password);
  await page.goto("/queue");

  await waitingRow(page, "Rohan Mehta")
    .getByRole("button", { name: queue.sendInOf("Rohan Mehta") })
    .click();
  const withDoctor = page.getByRole("list", { name: queue.withDoctor });
  await expect(withDoctor.getByRole("listitem").filter({ hasText: "Rohan Mehta" })).toBeVisible();

  await waitingRow(page, "Kiran Das")
    .getByRole("button", { name: queue.sendInOf("Kiran Das") })
    .click();
  const busy = page.getByRole("alertdialog", { name: queue.roomBusy("Rohan Mehta", false, "Maya Rao") });
  // Its three actions stand within the card, none cut off at its edge, and nothing scrolls sideways in it.
  const card = (await busy.boundingBox())!;
  for (const name of [queue.finishAndSendIn, queue.keepBothIn, UI_TEXT.actions.cancel]) {
    const button = (await busy.getByRole("button", { name }).boundingBox())!;
    expect(button.x).toBeGreaterThanOrEqual(card.x);
    expect(button.x + button.width).toBeLessThanOrEqual(card.x + card.width);
  }
  expect(await busy.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await busy.getByRole("button", { name: queue.finishAndSendIn }).click();
  await expect(notice(page, queue.sentIn("Kiran Das", "Maya Rao"))).toBeVisible();
  await expect(withDoctor.getByRole("listitem")).toHaveCount(1);
  await expect(withDoctor).toContainText("Kiran Das");
  await expectAccessible(page);

  // Back to waiting from the detail — the desk does not read visits, so the row opens it.
  await withDoctor.getByRole("button", { name: "Kiran Das", exact: true }).click();
  await page.getByRole("dialog", { name: "Kiran Das" }).getByRole("button", { name: queue.backToWaiting }).click();
  await expect(notice(page, queue.waitingAgain("Kiran Das"))).toBeVisible();
  await expect(waitingRow(page, "Kiran Das")).toBeVisible();
  await expect(page.getByText(queue.noneWithDoctor)).toBeVisible();
  await expectAccessible(page);
  await fitsTheScreen(page);
});

test("a doctor runs a session with Next patient alone, from the queue to each visit and back", async ({
  page,
}, info) => {
  const { maya, clinic, patients } = await aSessionWithMaya(["Rohan Mehta", "Kiran Das"]);
  await admin()
    .from("patient_alerts")
    .insert({ clinic_id: clinic.clinicId, patient_id: patients["Rohan Mehta"], kind: "ALLERGY", label: "Penicillin" });
  await signIn(page, maya.email, maya.password);
  await page.goto("/queue");

  // The room is free: Next patient sends in the lowest token.
  await page.getByRole("button", { name: queue.nextPatientFor("Maya Rao") }).click();
  await expect(notice(page, queue.sentIn("Rohan Mehta", "Maya Rao"))).toBeVisible();
  await (
    info.project.name === "phone"
      ? page.getByRole("link", { name: queue.openVisitOf("Rohan Mehta") })
      : page.getByRole("list", { name: queue.withDoctor }).getByRole("link", { name: "Rohan Mehta", exact: true })
  ).click();

  await expect(page).toHaveURL(/\/visits\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Rohan Mehta" })).toBeVisible();
  await expect(page.getByRole("list", { name: UI_TEXT.alerts.title })).toContainText("Penicillin");
  await expect(lake(page, "Rohan Mehta")).toContainText("01");
  await expectAccessible(page);
  await fitsTheScreen(page);
  const first = page.url();

  await lake(page, "Rohan Mehta")
    .getByRole("button", { name: queue.nextPatientAfter("Rohan Mehta") })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Kiran Das" })).toBeVisible();
  expect(page.url()).not.toBe(first);
  await expect(lake(page, "Kiran Das")).toContainText("02");

  await lake(page, "Kiran Das")
    .getByRole("button", { name: queue.nextPatientAfter("Kiran Das") })
    .click();
  await expect(notice(page, queue.noOneWaiting)).toBeVisible();
  await expect(page).toHaveURL(/\/queue$/);
  await expectAccessible(page);

  // The first visit, closed and waiting to be billed.
  await page.goto(first);
  await expect(page.getByRole("term").filter({ hasText: UI_TEXT.visit.doneLabel })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "To bill" })).toBeVisible();
  await expect(lake(page, "Rohan Mehta")).toBeHidden();
});
