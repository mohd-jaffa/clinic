import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import type { Permission } from "@/constants/permissions";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { addDaysKey, todayKey } from "@/lib/dates/calendar";
import { formatLongDate } from "@/lib/format/date";
import { walkInSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Treatments (plan §14.1; R7.2, D248 – D263), at a phone's width and a
 * desktop's. Dr. Maya Rao starts a root canal in Anita's visit — the price
 * list's procedure filling its name and estimate — with what was done today;
 * sets the next sitting a week on; at the next visit records the last
 * sitting and completes it in one save (D257). Anita's profile shows it under
 * Show closed, its sessions visit by visit, and her history names it (D262).
 * From another patient's profile, a nurse plans a crown, hands it to Dr. Ravi
 * Iyer, puts it on hold and cancels it with a reason (D250, D252); a member
 * who only reads sees it and changes nothing. Each screen checked by axe.
 */
test.afterAll(removeAll);

const { treatments: words } = UI_TEXT;
const CLINICAL: Permission[] = ["patients.view", "visits.view", "visits.create", "visits.edit"];

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });
const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );

/** Smile Care: Dr. Maya Rao, Dr. Ravi Iyer, a nurse, a front desk, a reader, and Root canal on the price list. */
async function aClinic() {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const [maya, ravi, nurse, desk, reader] = await Promise.all([
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: CLINICAL }),
    addMember(clinic.clinicId, { permissions: CLINICAL }),
    addMember(clinic.clinicId, {
      permissions: [
        "patients.view",
        "patients.create",
        "appointments.view",
        "appointments.create",
        "appointments.edit",
      ],
    }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "visits.view"] }),
  ]);
  await Promise.all([
    admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId),
    admin().from("profiles").update({ full_name: "Ravi Iyer" }).eq("id", ravi.userId),
    admin()
      .from("services")
      .insert({ clinic_id: clinic.clinicId, name: "Root canal", category: "PROCEDURE", price_paise: 450000 }),
  ]);
  const [{ data: doctor }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id").eq("member_id", maya.memberId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const addPatient = async (name: string) => {
    const { data, error } = await desk
      .tenant!.supabase.rpc("create_patient", {
        p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    if (error) throw error;
    return data.patient_id;
  };
  /** A visit with Dr. Maya Rao: walked in and sent in. */
  const visitFor = async (patientId: string) => {
    const arrival = await addWalkIn(
      desk.tenant!,
      walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId: doctor!.id, typeId: type!.id }),
      randomUUID(),
    );
    const { visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
    return { visitId, done: () => markDone(desk.tenant!, { appointmentId: arrival.id }) };
  };
  return { maya, ravi, nurse, reader, addPatient, visitFor };
}

test("a doctor starts a treatment in a visit, sets its next sitting, and completes it at the last", async ({
  page,
}) => {
  const { maya, addPatient, visitFor } = await aClinic();
  const anita = await addPatient("Anita Rao");
  const first = await visitFor(anita);
  await signIn(page, maya.email, maya.password);

  // No treatment yet; Add treatment, a procedure from the price list (D258).
  await page.goto(`/visits/${first.visitId}`);
  const card = page.getByRole("region", { name: words.title });
  await expect(card).toContainText(words.none);
  await card.getByRole("button", { name: words.addFor("Anita Rao") }).click();
  const adding = page.getByRole("dialog", { name: words.newTitle });
  await adding.getByRole("combobox", { name: new RegExp(`^${words.nameLabel}`) }).fill("root");
  await page.getByRole("option", { name: /^Root canal/ }).click();
  await expect(adding.getByRole("textbox", { name: new RegExp(`^${words.estimateLabel}`) })).toHaveValue("4500");
  await expect(adding.getByRole("radio", { name: words.startChoices.IN_PROGRESS })).toBeChecked();
  await adding.getByRole("textbox", { name: new RegExp(`^${words.firstNoteLabel}`) }).fill("Access opened");
  await expectAccessible(page);
  await adding.getByRole("button", { name: words.add, exact: true }).click();
  await expect(notice(page, words.created("Root canal"))).toBeVisible();
  const row = card.getByRole("listitem").filter({ hasText: "Root canal" });
  await expect(row).toContainText(words.thisVisit("Access opened"));
  await expect(row).toContainText("In progress");
  await expect(row).toContainText(words.estimate("₹4,500"));
  await fitsTheScreen(page);

  // Its sheet: the next sitting a week on (D259).
  await card.getByRole("button", { name: "Root canal", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Root canal" });
  await expect(sheet.getByRole("textbox", { name: words.noteLabel })).toHaveValue("Access opened");
  await sheet.getByRole("radio", { name: UI_TEXT.visit.followUpChoices["1_WEEK"] }).click();
  await expectAccessible(page);
  await sheet.getByRole("button", { name: words.saveNextDue }).click();
  const due = addDaysKey(todayKey(), 7);
  await expect(notice(page, words.nextDueSaved("Root canal", formatLongDate(due)))).toBeVisible();
  await expect(row).toContainText(words.dueIn(7));

  // The next visit: its last sitting, completing it in one save (D257).
  await first.done();
  const second = await visitFor(anita);
  await page.goto(`/visits/${second.visitId}`);
  await expect(row).not.toContainText(words.thisVisit("Access opened"));
  await card.getByRole("button", { name: "Root canal", exact: true }).click();
  await sheet.getByRole("textbox", { name: words.noteLabel }).fill("Canal filled");
  await sheet.getByRole("checkbox", { name: words.completes }).check();
  await sheet.getByRole("button", { name: words.saveSession }).click();
  await expect(notice(page, words.sessionCompleted("Root canal"))).toBeVisible();
  await expect(row).toContainText("Completed");
  await expect(row).toContainText(words.thisVisit("Canal filled"));
  await expectAccessible(page);

  // Her profile: closed, with its sessions visit by visit; her history names it (D260 – D262).
  await page.goto(`/patients/${anita}`);
  const section = page.getByRole("region", { name: words.title });
  await expect(section).toContainText(words.none);
  await section.getByRole("button", { name: words.showClosed(1) }).click();
  await section.getByRole("button", { name: "Root canal", exact: true }).click();
  const sessions = sheet.getByRole("list", { name: words.sessions });
  await expect(sessions.getByRole("listitem")).toHaveCount(2);
  await expect(sessions).toContainText("Access opened");
  await expect(sessions).toContainText("Canal filled");
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("list", { name: UI_TEXT.patients.history })).toContainText(
    words.worked(["Root canal"], 0),
  );
  await fitsTheScreen(page);
});

test("from the profile a planned treatment is handed on, held and cancelled with a reason; a reader changes nothing", async ({
  page,
}) => {
  const { nurse, reader, addPatient } = await aClinic();
  const kiran = await addPatient("Kiran Shah");
  await signIn(page, nurse.email, nurse.password);

  // Planned for Dr. Maya Rao, with an estimate (D252, D258).
  await page.goto(`/patients/${kiran}`);
  const section = page.getByRole("region", { name: words.title });
  await section.getByRole("button", { name: words.addFor("Kiran Shah") }).click();
  const adding = page.getByRole("dialog", { name: words.newTitle });
  await adding.getByRole("combobox", { name: new RegExp(`^${words.nameLabel}`) }).fill("Crown");
  await adding.getByRole("textbox", { name: new RegExp(`^${words.estimateLabel}`) }).fill("8,000");
  await expect(adding.getByRole("radio", { name: words.startChoices.PLANNED })).toBeChecked();
  await adding.getByRole("combobox", { name: /^Doctor/ }).click();
  await page.getByRole("option", { name: "Maya Rao" }).click();
  await adding.getByRole("button", { name: words.add, exact: true }).click();
  await expect(notice(page, words.created("Crown"))).toBeVisible();
  const row = section.getByRole("listitem").filter({ hasText: "Crown" });
  await expect(row).toContainText("Planned");
  await expect(row).toContainText("Maya Rao");
  await expectAccessible(page);

  // Handed to Dr. Ravi Iyer while open (D252).
  await section.getByRole("button", { name: "Crown", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Crown" });
  await sheet.getByRole("button", { name: words.editOf("Crown") }).click();
  const editing = page.getByRole("dialog", { name: words.editTitle });
  await editing.getByRole("combobox", { name: /^Doctor/ }).click();
  await page.getByRole("option", { name: "Ravi Iyer" }).click();
  await editing.getByRole("button", { name: UI_TEXT.actions.save }).click();
  await expect(notice(page, words.saved("Crown"))).toBeVisible();
  await expect(row).toContainText("Ravi Iyer");

  // On hold, then cancelled with its reason, asked first (D250).
  await section.getByRole("button", { name: "Crown", exact: true }).click();
  await sheet.getByRole("button", { name: words.hold }).click();
  await expect(notice(page, words.moved.ON_HOLD("Crown"))).toBeVisible();
  await section.getByRole("button", { name: "Crown", exact: true }).click();
  await sheet.getByRole("button", { name: words.cancel }).click();
  const why = page.getByRole("dialog", { name: words.cancelTitle("Crown") });
  await why.getByRole("textbox", { name: new RegExp(`^${words.reasonLabel}`) }).fill("Patient declined");
  await why.getByRole("button", { name: words.cancel }).click();
  const ask = page.getByRole("alertdialog", { name: words.cancelTitle("Crown") });
  await expect(ask).toContainText(words.cancelBody("Patient declined"));
  await expectAccessible(page);
  await ask.getByRole("button", { name: words.cancel }).click();
  await expect(notice(page, words.moved.CANCELLED("Crown"))).toBeVisible();
  await expect(section).toContainText(words.none);

  // A member who only reads sees it, and no way to change it.
  await signIn(page, reader.email, reader.password);
  await page.goto(`/patients/${kiran}`);
  await expect(section.getByRole("button", { name: words.addFor("Kiran Shah") })).toHaveCount(0);
  await section.getByRole("button", { name: words.showClosed(1) }).click();
  await section.getByRole("button", { name: "Crown", exact: true }).click();
  await expect(sheet).toContainText("Patient declined");
  await expect(sheet.getByRole("group", { name: words.actions })).toHaveCount(0);
  await expectAccessible(page);
});
