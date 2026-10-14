import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { PRESCRIPTION_TIMING_LABELS } from "@/constants/statuses";
import { addWalkIn } from "@/features/appointments/api";
import { sendIn } from "@/features/appointments/moves";
import { savePrescription } from "@/features/prescriptions/records";
import { savePrescriptionSchema, walkInSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * The prescription (plan §13; R6.3, D210 – D217), at a phone's width and a
 * desktop's. An assistant types Rohan's prescription for Dr. Maya Rao: a
 * medicine taken from the clinic's earlier ones fills its whole line (D211);
 * one that names his penicillin allergy is warned on its line, and Save asks
 * about it (D212); the medicines are moved and saved together (D210), and
 * the doctor finds them typed for her. A visit with Dr. Arjun Shah, who has
 * no registration number yet, says so instead (D213). Each screen checked by
 * axe, nothing wider than the screen.
 */
test.afterAll(removeAll);

const { prescription: words, visit } = UI_TEXT;
const CLINICAL = ["patients.view", "appointments.view", "visits.view", "visits.create", "visits.edit"] as const;

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

const fitsTheScreen = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
const notice = (page: Page, title: string) => page.getByRole("status").filter({ hasText: title });

/**
 * Smile Care: Dr. Maya Rao (with her registration number) and Dr. Arjun Shah
 * (without), an assistant who types prescriptions, and a front desk. Maya
 * wrote Paracetamol for an earlier patient; Rohan Mehta, allergic to
 * penicillin, is in with her now, and Sunil Nair with Arjun.
 */
async function aClinic() {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  const [maya, arjun, assistant, desk] = await Promise.all([
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: [...CLINICAL, "appointments.edit"] }),
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
    admin().from("profiles").update({ full_name: "Arjun Shah" }).eq("id", arjun.userId),
    admin().from("profiles").update({ full_name: "Priya Nair" }).eq("id", assistant.userId),
    admin().from("doctors").update({ registration_number: "KMC 12345" }).eq("member_id", maya.memberId),
  ]);
  const [{ data: mayaDoctor }, { data: arjunDoctor }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id").eq("member_id", maya.memberId).single(),
    admin().from("doctors").select("id").eq("member_id", arjun.memberId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const patientOf = async (name: string) => {
    const { data, error } = await desk
      .tenant!.supabase.rpc("create_patient", {
        p_patient: { full_name: name, phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
        p_idempotency_key: randomUUID(),
      })
      .single<{ patient_id: string }>();
    if (error) throw error;
    return data.patient_id;
  };
  const visitOf = async (patientId: string, doctorId: string) => {
    const arrival = await addWalkIn(
      desk.tenant!,
      walkInSchema.parse({ patient: { mode: "FOUND", id: patientId }, doctorId, typeId: type!.id }),
      randomUUID(),
    );
    return (await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" })).visitId;
  };

  const earlier = await visitOf(await patientOf("Kiran Das"), mayaDoctor!.id);
  await savePrescription(
    maya.tenant!,
    earlier,
    savePrescriptionSchema.parse({
      prescription: {
        items: [
          {
            medicine: "Paracetamol",
            strength: "500 mg",
            dose: "1 tab",
            frequency: "1-0-1",
            timing: "AFTER_FOOD",
            durationDays: "5",
            instructions: "",
          },
        ],
        advice: "",
        printDiagnosis: false,
      },
      seen: null,
    }),
  );
  const rohan = await patientOf("Rohan Mehta");
  await admin()
    .from("patient_alerts")
    .insert({ clinic_id: clinic.clinicId, patient_id: rohan, kind: "ALLERGY", label: "Penicillin" });
  const rohansVisit = await visitOf(rohan, mayaDoctor!.id);
  const sunilsVisit = await visitOf(await patientOf("Sunil Nair"), arjunDoctor!.id);
  return { maya, assistant, rohansVisit, sunilsVisit };
}

test("an assistant types the prescription for the doctor, warned of an allergy, and it waits for a registration number", async ({
  page,
}) => {
  const { maya, assistant, rohansVisit, sunilsVisit } = await aClinic();

  await signIn(page, assistant.email, assistant.password);
  await page.goto(`/visits/${rohansVisit}`);
  const card = page.getByRole("region", { name: words.title });
  await expect(card).toContainText(words.allergiesLabel);
  await expect(card.getByRole("list", { name: UI_TEXT.alerts.title })).toContainText("Penicillin");
  await expect(card.getByRole("button", { name: words.save })).toBeHidden();

  // A medicine written before fills its whole line (D211).
  await card.getByRole("button", { name: words.addMedicine }).click();
  const first = card.getByRole("group", { name: words.medicineN(1) });
  const name = first.getByRole("combobox", { name: words.medicineLabel });
  await expect(name).toBeFocused();
  await name.pressSequentially("para");
  const suggestions = page.getByRole("listbox", { name: words.suggestions });
  await expect(suggestions.getByRole("option")).toHaveCount(1);
  await expect(suggestions).toContainText("1 tab · 1-0-1 · After food · 5 days");
  await expectAccessible(page);
  await suggestions.getByRole("option", { name: /Paracetamol 500 mg/ }).click();
  await expect(name).toHaveValue("Paracetamol");
  await expect(first.getByLabel(words.strengthLabel)).toHaveValue("500 mg");
  await expect(first.getByLabel(words.doseLabel)).toHaveValue("1 tab");
  await expect(first.getByRole("radio", { name: "1-0-1" })).toBeChecked();
  await expect(first.getByRole("radio", { name: PRESCRIPTION_TIMING_LABELS.AFTER_FOOD })).toBeChecked();
  await expect(first.getByLabel(words.daysLabel)).toHaveValue("5");

  // A medicine naming his allergy is warned on its line (D212); its frequency typed under Other (D214).
  await card.getByRole("button", { name: words.addMedicine }).click();
  const second = card.getByRole("group", { name: words.medicineN(2) });
  await second.getByRole("combobox", { name: words.medicineLabel }).fill("Penicillin V");
  await expect(second).toContainText(words.allergy("Penicillin"));
  await second.getByLabel(words.strengthLabel).fill("250 mg");
  await second.getByRole("radio", { name: words.otherFrequency }).click();
  await second.getByLabel(words.otherFrequencyLabel).fill("Once a week");
  await second.getByRole("radio", { name: PRESCRIPTION_TIMING_LABELS.BEFORE_FOOD }).click();
  await second.getByLabel(words.daysLabel).fill("7");
  await card.getByLabel(words.adviceLabel).fill("Plenty of fluids");
  await expectAccessible(page);
  await fitsTheScreen(page);

  // Save asks about the allergy; Cancel saves nothing.
  await card.getByRole("button", { name: words.save }).click();
  const asked = page.getByRole("alertdialog", { name: words.allergyConfirmTitle });
  await expect(asked).toContainText(words.allergyLine("Penicillin V", "Penicillin"));
  await expectAccessible(page);
  await asked.getByRole("button", { name: UI_TEXT.actions.cancel }).click();
  await expect(card.getByRole("button", { name: words.save })).toBeVisible();

  // Moved first, and saved anyway — the medicines, the advice, together (D210).
  await second.getByRole("button", { name: words.moveUp(2) }).click();
  await expect(card.getByRole("group", { name: words.medicineN(1) }).getByLabel(words.strengthLabel)).toHaveValue(
    "250 mg",
  );
  await card.getByRole("button", { name: words.save }).click();
  await page
    .getByRole("alertdialog", { name: words.allergyConfirmTitle })
    .getByRole("button", { name: words.saveAnyway })
    .click();
  await expect(notice(page, words.saved)).toBeVisible();
  await expect(card.getByRole("button", { name: words.save })).toBeHidden();

  // The doctor finds it typed for her, in that order.
  await signIn(page, maya.email, maya.password);
  await page.goto(`/visits/${rohansVisit}`);
  await expect(card).toContainText(words.typedBy("Priya Nair"));
  await expect(card.getByRole("group", { name: words.medicineN(1) }).getByRole("combobox")).toHaveValue("Penicillin V");
  await expect(card.getByRole("group", { name: words.medicineN(1) }).getByLabel(words.otherFrequencyLabel)).toHaveValue(
    "Once a week",
  );
  await expect(card.getByRole("group", { name: words.medicineN(2) }).getByRole("combobox")).toHaveValue("Paracetamol");
  await expect(card.getByLabel(words.adviceLabel)).toHaveValue("Plenty of fluids");
  await expectAccessible(page);

  // Dr. Arjun Shah has no registration number yet (D213).
  await signIn(page, assistant.email, assistant.password);
  await page.goto(`/visits/${sunilsVisit}`);
  await expect(page.getByRole("heading", { level: 1, name: "Sunil Nair" })).toBeVisible();
  await expect(card).toContainText(words.needsRegistration("Arjun Shah"));
  await expect(card.getByRole("button", { name: words.addMedicine })).toBeHidden();
  await expect(card).toContainText(words.none);
  await expect(page.getByRole("region", { name: visit.notesTitle })).toBeVisible();
  await expectAccessible(page);
  await fitsTheScreen(page);
});
