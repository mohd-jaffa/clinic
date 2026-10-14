import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { UI_TEXT } from "@/constants/messages";
import { addWalkIn } from "@/features/appointments/api";
import { sendIn } from "@/features/appointments/moves";
import { savePrescription } from "@/features/prescriptions/records";
import { todayKey } from "@/lib/dates/calendar";
import { formatDate } from "@/lib/format/date";
import { savePrescriptionSchema, walkInSchema } from "@/lib/validation";
import { expectAccessible } from "@tests/support/e2e";
import { addMember, admin, registerClinic, removeAll } from "@tests/support/integration";

/**
 * The prescription's PDF (plan §13, §33; R6.4, D218 – D224), at a phone's
 * width and a desktop's. Rohan's prescription is saved; whoever reads his
 * visit finds **Print**, which opens the PDF itself beside the app (D221),
 * and **Download**, which saves it as "Rohan Mehta - {day} -
 * Prescription.pdf" (D223) — on the clinic's A5 paper. The doctor typing a
 * change sees Save in their place until it is saved (D222). Each screen
 * checked by axe.
 */
test.afterAll(removeAll);

const { prescription: words } = UI_TEXT;
const CLINICAL = ["patients.view", "appointments.view", "visits.view", "visits.create", "visits.edit"] as const;
const A5 = "/MediaBox [0 0 419.53 595.28]";

async function signIn(page: Page, identifier: string, password: string) {
  const answer = await page.request.post("/api/auth/login", { data: { identifier, password } });
  expect(answer.ok()).toBe(true);
}

/** Smile Care on A5: Dr. Maya Rao, a reader, and Rohan Mehta in with her, his prescription saved. */
async function aClinic() {
  const clinic = await registerClinic({ fullName: "Asha Menon", clinicName: "Smile Care" });
  await admin().from("clinics").update({ paper_size: "A5" }).eq("id", clinic.clinicId);
  const [maya, reader, desk] = await Promise.all([
    addMember(clinic.clinicId, { role: "DOCTOR", permissions: [...CLINICAL, "appointments.edit"] }),
    addMember(clinic.clinicId, { permissions: ["patients.view", "appointments.view", "visits.view"] }),
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
    admin()
      .from("doctors")
      .update({ registration_number: "KMC 12345", qualifications: "BDS, MDS" })
      .eq("member_id", maya.memberId),
  ]);
  const [{ data: doctor }, { data: type }] = await Promise.all([
    admin().from("doctors").select("id").eq("member_id", maya.memberId).single(),
    admin().from("appointment_types").select("id").eq("clinic_id", clinic.clinicId).eq("name", "Consultation").single(),
  ]);
  const { data: patient, error } = await desk
    .tenant!.supabase.rpc("create_patient", {
      p_patient: { full_name: "Rohan Mehta", phone: "+919876543210", date_of_birth: "1990-04-12", gender: "MALE" },
      p_idempotency_key: randomUUID(),
    })
    .single<{ patient_id: string }>();
  if (error) throw error;
  const arrival = await addWalkIn(
    desk.tenant!,
    walkInSchema.parse({ patient: { mode: "FOUND", id: patient.patient_id }, doctorId: doctor!.id, typeId: type!.id }),
    randomUUID(),
  );
  const { visitId } = await sendIn(desk.tenant!, { appointmentId: arrival.id, others: "KEEP" });
  await savePrescription(
    maya.tenant!,
    visitId,
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
        advice: "Plenty of fluids",
        printDiagnosis: false,
      },
      seen: null,
    }),
  );
  return { maya, reader, visitId };
}

test("whoever reads the visit prints and downloads the saved prescription; the doctor saves first", async ({
  page,
}) => {
  const { maya, reader, visitId } = await aClinic();
  const name = `Rohan Mehta - ${formatDate(todayKey())} - Prescription.pdf`;

  await signIn(page, reader.email, reader.password);
  await page.goto(`/visits/${visitId}`);
  const card = page.getByRole("region", { name: words.title });
  await expect(card).toContainText("Paracetamol 500 mg");
  await expectAccessible(page);

  // Print opens the PDF itself beside the app (D221): inline, A5, never kept.
  const print = card.getByRole("link", { name: words.printOf("Rohan Mehta") });
  await expect(print).toHaveAttribute("target", "_blank");
  const answer = await page.request.get((await print.getAttribute("href"))!);
  expect(answer.headers()["content-type"]).toBe("application/pdf");
  expect(answer.headers()["content-disposition"]).toContain(`inline; filename="${name}"`);
  expect(answer.headers()["cache-control"]).toContain("no-store");
  const opened = (await answer.body()).toString("latin1");
  expect(opened.startsWith("%PDF")).toBe(true);
  expect(opened).toContain(A5);
  // Followed, it opens in a tab of its own, which asks for the PDF.
  const [tab, asked] = await Promise.all([
    page.waitForEvent("popup"),
    page.context().waitForEvent("request", (sent) => sent.url().includes(`/api/visits/${visitId}/prescription.pdf`)),
    print.click(),
  ]);
  expect(asked.frame().page()).toBe(tab);
  await tab.close();

  // Download saves it under its name (D223).
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    card.getByRole("button", { name: words.downloadOf("Rohan Mehta") }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(name);
  expect((await readFile((await download.path())!)).toString("latin1")).toContain(A5);
  await expect(page.getByRole("status").filter({ hasText: words.downloaded })).toBeVisible();

  // The doctor typing a change: Save until it is saved (D222).
  await signIn(page, maya.email, maya.password);
  await page.goto(`/visits/${visitId}`);
  await expect(card.getByRole("link", { name: words.printOf("Rohan Mehta") })).toBeVisible();
  await card.getByLabel(words.adviceLabel).fill("Plenty of fluids. Rest.");
  await expect(card.getByRole("link", { name: words.printOf("Rohan Mehta") })).toBeHidden();
  await expect(card.getByRole("button", { name: words.downloadOf("Rohan Mehta") })).toBeHidden();
  await card.getByRole("button", { name: words.save }).click();
  await expect(page.getByRole("status").filter({ hasText: words.saved })).toBeVisible();
  await expect(card.getByRole("link", { name: words.printOf("Rohan Mehta") })).toBeVisible();
  await expectAccessible(page);
});
