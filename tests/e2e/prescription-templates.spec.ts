import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { addWalkIn } from "@/features/appointments/api";
import { markDone, sendIn } from "@/features/appointments/moves";
import { savePrescription } from "@/features/prescriptions/records";
import { todayKey } from "@/lib/dates/calendar";
import { formatNearDate } from "@/lib/format/date";
import { savePrescriptionSchema, walkInSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * Prescription templates and Repeat (plan §13; R6.7, D236 – D243), at a
 * phone's width and a desktop's. Dr. Maya Rao makes a template in My
 * account; on Anita's visit, Repeat names and adds her prescription before,
 * and the template adds after it; saved as a template under a name in use,
 * it asks to replace that one. She archives the template and restores it.
 * Her assistant applies her templates and saves none. Each screen checked
 * by axe.
 */
test.afterAll(removeAll);

const { prescription: rx, templates: words, catalogues } = UI_TEXT;
const CLINICAL = ["patients.view", "visits.view", "visits.create", "visits.edit"] as const;

const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

/** Smile Care: Dr. Maya Rao, her assistant, and Anita — seen this morning, and in again now. */
async function aClinic() {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const [maya, typist, desk] = await Promise.all([
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: [...CLINICAL] }),
    addMember(clinic.clinicId, { permissions: [...CLINICAL, "prescriptions.write"] }),
    addMember(clinic.clinicId, {
      permissions: [
        "patients.view",
        "patients.create",
        "appointments.view",
        "appointments.create",
        "appointments.edit",
      ],
    }),
  ]);
  await Promise.all([
    admin().from("profiles").update({ full_name: "Maya Rao" }).eq("id", maya.userId),
    admin().from("profiles").update({ full_name: "Divya Menon" }).eq("id", typist.userId),
    admin().from("doctors").update({ registration_number: "KMC 12345" }).eq("member_id", maya.memberId),
  ]);
  const [{ data: doctor }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id").eq("member_id", maya.memberId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const { data: patient, error } = await desk
    .tenant!.supabase.rpc("create_patient", {
      p_patient: { full_name: "Anita Rao", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "FEMALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  const visitOf = async () => {
    const arrival = await addWalkIn(
      desk.tenant!,
      walkInSchema.parse({
        patient: { mode: "FOUND", id: patient.patient_id },
        doctorId: doctor!.id,
        typeId: type!.id,
      }),
      randomUUID(),
    );
    const { visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
    return { visitId, appointmentId: arrival.id };
  };
  const line = { strength: "", dose: "", frequency: "", timing: "", durationDays: "", instructions: "" };
  const morning = await visitOf();
  await savePrescription(
    maya.tenant!,
    morning.visitId,
    savePrescriptionSchema.parse({
      prescription: {
        items: [
          { ...line, medicine: "Paracetamol", strength: "500 mg", durationDays: "5" },
          { ...line, medicine: "Cetirizine" },
        ],
        advice: "Rest",
        printDiagnosis: false,
      },
      seen: null,
    }),
  );
  await markDone(desk.tenant!, { appointmentId: morning.appointmentId });
  const now = await visitOf();
  return { maya, typist, visitId: now.visitId };
}

test("a doctor keeps templates and adds them, and Repeat, to a prescription; whoever types for them only applies them", async ({
  page,
}) => {
  const { maya, typist, visitId } = await aClinic();
  await signIn(page, maya.email, maya.password);

  // My account leads a doctor to their templates: none yet (D242).
  await page.goto("/settings/account");
  await page.getByRole("link", { name: new RegExp(`^${words.title}`) }).click();
  await expect(page).toHaveURL("/settings/account/templates");
  await expect(page.getByText(words.emptyTitle)).toBeVisible();
  await expectAccessible(page);

  // A new template: its name, a medicine and advice.
  await page.getByRole("link", { name: words.add }).click();
  await expect(page.getByRole("heading", { level: 1, name: words.newTitle })).toBeVisible();
  await page.getByRole("textbox", { name: new RegExp(`^${rx.templateNameLabel}`) }).fill("Viral fever");
  await page.getByRole("button", { name: rx.addMedicine }).click();
  const dolo = page.getByRole("group", { name: rx.medicineN(1) });
  await dolo.getByRole("combobox", { name: rx.medicineLabel }).fill("Dolo");
  await dolo.getByLabel(rx.strengthLabel).fill("650 mg");
  await dolo.getByRole("radio", { name: "1-1-1", exact: true }).click();
  await page.getByLabel(rx.adviceLabel).fill("Plenty of fluids");
  await expectAccessible(page);
  await page.getByRole("button", { name: UI_TEXT.actions.save, exact: true }).click();
  await expect(notice(page, rx.templateSaved("Viral fever"))).toBeVisible();
  await expect(page).toHaveURL("/settings/account/templates");
  const list = page.getByRole("list", { name: words.title });
  await expect(list).toContainText("Viral fever");
  await expect(list).toContainText("Dolo");
  await expectAccessible(page);

  // On Anita's visit, Repeat names her prescription before and adds it (D236).
  await page.goto(`/visits/${visitId}`);
  const card = page.getByRole("region", { name: rx.title });
  const medicineOf = (n: number) =>
    card.getByRole("group", { name: rx.medicineN(n) }).getByRole("combobox", { name: rx.medicineLabel });
  await card.getByRole("button", { name: rx.repeat(formatNearDate(todayKey()), "Dr. Maya Rao") }).click();
  await expect(medicineOf(1)).toHaveValue("Paracetamol");
  await expect(medicineOf(2)).toHaveValue("Cetirizine");
  await expect(card.getByLabel(rx.adviceLabel)).toHaveValue("Rest");

  // A template adds after them, its advice on a new line (D237, D238, D241).
  await card.getByRole("button", { name: rx.templates, exact: true }).click();
  const sheet = page.getByRole("dialog", { name: rx.templates });
  await expect(sheet).toContainText("Dolo");
  await expectAccessible(page);
  await sheet.getByRole("button", { name: /^Viral fever/ }).click();
  await expect(sheet).toBeHidden();
  await expect(medicineOf(3)).toHaveValue("Dolo");
  await expect(card.getByLabel(rx.adviceLabel)).toHaveValue("Rest\nPlenty of fluids");
  await card.getByRole("button", { name: rx.save }).click();
  await expect(notice(page, rx.saved)).toBeVisible();

  // Saved as a template under a name in use, it asks to replace that one (D243).
  await card.getByRole("button", { name: rx.saveAsTemplate }).click();
  const naming = page.getByRole("dialog", { name: rx.saveAsTemplate });
  await naming.getByRole("textbox", { name: new RegExp(`^${rx.templateNameLabel}`) }).fill("viral fever");
  await naming.getByRole("button", { name: rx.saveAsTemplate }).click();
  const replace = page.getByRole("alertdialog", { name: rx.replaceTitle("viral fever") });
  await expect(replace).toContainText(rx.replaceBody);
  await expectAccessible(page);
  await replace.getByRole("button", { name: rx.replace }).click();
  await expect(notice(page, rx.templateSaved("viral fever"))).toBeVisible();

  // In My account it now holds all three; archived, then restored (D242).
  await page.goto("/settings/account/templates");
  await expect(list).toContainText("Paracetamol, Cetirizine +1");
  await list.getByRole("link", { name: /^viral fever/ }).click();
  await expect(page.getByRole("group", { name: rx.medicineN(3) })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: UI_TEXT.actions.archive }).click();
  await page
    .getByRole("alertdialog", { name: words.archiveTitle("viral fever") })
    .getByRole("button", { name: UI_TEXT.actions.archive })
    .click();
  await expect(page).toHaveURL("/settings/account/templates");
  await expect(page.getByText(words.emptyTitle)).toBeVisible();
  await page.getByRole("button", { name: catalogues.showArchived(1) }).click();
  await page.getByRole("button", { name: catalogues.restoreNamed("viral fever") }).click();
  await expect(notice(page, catalogues.restoredNote("viral fever"))).toBeVisible();
  await expect(list).toContainText("viral fever");

  // Whoever types for her applies her templates and saves none (D240, D241).
  await signIn(page, typist.email, typist.password);
  await page.goto(`/visits/${visitId}`);
  await expect(medicineOf(3)).toHaveValue("Dolo");
  await expect(card.getByRole("button", { name: rx.saveAsTemplate })).toHaveCount(0);
  await card.getByRole("button", { name: rx.templates, exact: true }).click();
  await expect(page.getByRole("dialog", { name: rx.templatesOf("Maya Rao") })).toContainText("viral fever");
  await expectAccessible(page);
  await page.goto("/settings/account");
  await expect(page.getByRole("heading", { level: 1, name: UI_TEXT.nav.myAccount })).toBeVisible();
  await expect(page.getByRole("region", { name: words.section })).toHaveCount(0);
});
