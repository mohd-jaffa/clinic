import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { ADD_FORMS } from "@/constants/navigation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Today's queue (plan §11.3, §11.4; R5.5, D168 – D175). On a phone: a walk-in
 * added from the ＋, given their token; a booked patient marked Arrived on
 * their row, given theirs; both waiting by token. On a desktop: the four
 * columns side by side, a late patient marked, one doctor's queue, and a
 * waiting patient marked a no-show from their detail. Each checked by axe,
 * and nothing wider than the screen.
 */
test.afterAll(removeAll);

const { queue, appointment: words } = UI_TEXT;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

/** Now on the clinic's 5-minute steps: today's, whatever the hour the suite runs at. */
const stepNow = () => new Date(Math.floor(Date.now() / 300_000) * 300_000).toISOString();

/** Asha Menon's clinic, Maya Rao its other doctor, a front desk, and two patients booked for now. */
async function aDayAtTheDesk() {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const maya = await addMember(clinic.clinicId, { role: "DOCTOR", permissions: ["patients.view"] });
  await admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId);
  const desk = await addMember(clinic.clinicId, {
    permissions: [
      "patients.view",
      "patients.create",
      "appointments.view",
      "appointments.create",
      "appointments.edit",
      "appointments.cancel",
    ],
  });
  const patient = async (name: string) =>
    (
      await desk
        .tenant!.supabase.rpc("create_patient", {
          p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
          p_idempotency_key: randomUUID(),
        })
        .single<{ patient_id: string }>()
    ).data!.patient_id;
  const [{ data: doctorRows }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id, member_id").eq("clinic_id", clinic.clinicId),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const mayaId = doctorRows!.find((row) => row.member_id === maya.memberId)!.id as string;
  const ashaId = doctorRows!.find((row) => row.member_id !== maya.memberId)!.id as string;
  const [, kiran, sunil] = await Promise.all([patient("Rohan Mehta"), patient("Kiran Das"), patient("Sunil Nair")]);
  // Booked for now — today, whatever the hour — as they stood.
  for (const [patientId, doctorId] of [
    [kiran, mayaId],
    [sunil, ashaId],
  ]) {
    const { error } = await admin().from("appointments").insert({
      clinic_id: clinic.clinicId,
      patient_id: patientId,
      doctor_id: doctorId,
      source: "BOOKED",
      appointment_type_id: type!.id,
      scheduled_at: stepNow(),
      duration_minutes: 15,
    });
    expect(error).toBeNull();
  }
  return { desk };
}

const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });

test("on a phone: a walk-in from the ＋ and a booked patient arrived, each given their token", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "phone", "the stacked queue is the phone's");
  const { desk } = await aDayAtTheDesk();
  await signIn(page, desk.email, desk.password);

  await page.goto(`/queue?add=${ADD_FORMS.walkIn}`);
  const sheet = page.getByRole("dialog", { name: queue.walkInTitle });
  await sheet.getByRole("searchbox").fill("Rohan");
  await sheet.getByRole("button", { name: "Rohan Mehta" }).click();
  await sheet.getByRole("combobox", { name: /^Doctor/ }).click();
  await page.getByRole("option", { name: "Maya Rao" }).click();
  await expectAccessible(page);
  await sheet.getByRole("button", { name: queue.addWalkIn }).click();
  await expect(sheet).toBeHidden();
  await expect(notice(page, queue.tokenGiven("Rohan Mehta", 1, "Maya Rao"))).toBeVisible();
  await expect(page).toHaveURL(/\/queue$/);

  await page.getByRole("button", { name: queue.markArrived("Kiran Das") }).click();
  await expect(notice(page, queue.tokenGiven("Kiran Das", 2, "Maya Rao"))).toBeVisible();
  const waiting = page.getByRole("list", { name: queue.waiting });
  await expect(waiting.getByRole("listitem")).toHaveCount(2);
  await expect(waiting.getByRole("listitem").first()).toContainText("01");
  await expect(waiting.getByRole("listitem").first()).toContainText("Rohan Mehta");
  await expect(waiting.getByRole("listitem").nth(1)).toContainText("Kiran Das");
  await expect(page.getByRole("region", { name: queue.withDoctor })).toContainText(queue.roomFree);
  await fitsTheScreen(page);
  await expectAccessible(page);
});

test("on a desktop: four columns, a late patient marked, one doctor's queue, and a no-show from the detail", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the columns are the wider screens' queue");
  const { desk } = await aDayAtTheDesk();
  // The browser forty minutes on: both patients booked for now are late.
  await page.clock.setFixedTime(new Date(Date.parse(stepNow()) + 40 * 60_000));
  await signIn(page, desk.email, desk.password);

  await page.goto("/queue");
  for (const title of [queue.waiting, queue.withDoctor, queue.stillToCome, queue.done]) {
    await expect(page.getByRole("heading", { name: new RegExp(`^${title}`) })).toBeVisible();
  }
  const coming = page.getByRole("list", { name: queue.stillToCome });
  await expect(coming.getByRole("listitem")).toHaveCount(2);
  await expect(coming.getByRole("listitem").first()).toContainText(queue.late(40));
  await fitsTheScreen(page);
  await expectAccessible(page);

  await page.getByRole("radiogroup", { name: queue.doctors }).getByRole("radio", { name: "Maya Rao" }).click();
  await expect(coming.getByRole("listitem")).toHaveCount(1);
  await expect(coming).toContainText("Kiran Das");

  await coming.getByRole("button", { name: queue.markArrived("Kiran Das") }).click();
  const waiting = page.getByRole("list", { name: queue.waiting });
  await expect(waiting.getByRole("listitem")).toContainText("Kiran Das");
  await waiting.getByRole("button", { name: "Kiran Das", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Kiran Das" });
  await detail.getByRole("button", { name: words.noShow }).click();
  await page
    .getByRole("alertdialog", { name: words.noShowAsk("Kiran Das") })
    .getByRole("button", { name: words.noShow })
    .click();
  await expect(detail).toBeHidden();
  await expect(page.getByText(queue.noneWaiting)).toBeVisible();
});
