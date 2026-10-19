// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { externalServiceError } from "@/lib/errors";
import type { Measure } from "@/lib/pdf/layout";
import type { Tenant } from "@/lib/supabase/tenant";
import { fakeSupabase, postgrestError, type FakeSupabaseOptions } from "@tests/support/supabase";

const { downloadLogo, getBill, getClinicForDocuments, renderPdf, toPng, warn } = vi.hoisted(() => ({
  downloadLogo: vi.fn(),
  getBill: vi.fn(),
  getClinicForDocuments: vi.fn(),
  renderPdf: vi.fn(),
  toPng: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("@/features/clinic/api", () => ({ downloadLogo, getClinicForDocuments }));
vi.mock("@/features/billing/api", () => ({ getBill }));
vi.mock("@/lib/pdf/render", async (actual) => ({ ...(await actual()), renderPdf }));
vi.mock("@/lib/logger", () => ({ logger: { warn, info: vi.fn(), error: vi.fn() } }));
vi.mock("sharp", () => ({ default: vi.fn(() => ({ png: () => ({ toBuffer: toPng }) })) }));

const { getBillPdf, getPrescriptionPdf } = await import("@/features/documents/api");

const measure: Measure = (text, _face, size) => text.length * size * 0.5;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const clinic = {
  id: "clinic-1",
  name: "Smile Care",
  clinicType: "DENTAL",
  phone: "0484 234 5678",
  email: null,
  address: "12 MG Road",
  city: "Kochi",
  gstin: null,
  timezone: "Asia/Kolkata",
  paperSize: "A5",
  feeTiming: "AFTER_CONSULTATION",
  logoUrl: null,
};

const ITEM = {
  medicine: "Paracetamol",
  strength: "500 mg",
  dose: "1 tab",
  frequency: "1-0-1",
  timing: "AFTER_FOOD",
  duration_days: 5,
  instructions: null,
};

const aRow = (changes: object = {}) => ({
  visit_date: "2026-10-14",
  diagnosis: "Viral fever",
  follow_up_on: "2026-10-21",
  patient: { full_name: "Rohan Mehta", patient_number: 1002, date_of_birth: "1990-04-12", gender: "MALE" },
  doctor: {
    registration_number: "KMC 12345",
    qualifications: "BDS, MDS",
    specialization: null,
    member: { profile: { full_name: "Maya Rao" } },
  },
  vitals: [
    {
      systolic: 120,
      diastolic: 80,
      pulse: null,
      temperature_f: null,
      spo2: null,
      respiratory_rate: null,
      weight_kg: null,
      height_cm: null,
    },
  ],
  prescription: {
    advice: "Rest",
    print_diagnosis: true,
    items: [
      { ...ITEM, position: 2, medicine: "Cetirizine", strength: "10 mg" },
      { ...ITEM, position: 1 },
    ],
  },
  ...changes,
});

function tenantWith(options: FakeSupabaseOptions): Tenant {
  return {
    supabase: fakeSupabase(options).client,
    clinicId: "clinic-1",
    actorId: "user-1",
    memberId: "member-1",
    role: "STAFF",
    permissions: ["visits.view"],
    doctorId: null,
  };
}

const withRow = (row: object | null) => tenantWith({ answer: () => ({ data: row }) });
const get = (tenant: Tenant, download = false) => getPrescriptionPdf(tenant, "v-1", { download, requestId: "req_1" });

/** What the PDF was drawn from: the layout `renderPdf` was handed, laid out. */
const drawn = () => {
  const [{ compose, ...rest }] = renderPdf.mock.calls.at(-1)! as [
    {
      paper: string;
      title: string;
      author: string;
      logo: Buffer | null;
      compose: (measure: Measure) => { ops: { kind: string; text?: string }[] };
    },
  ];
  return { ...rest, lines: compose(measure).ops.flatMap((op) => (op.kind === "text" ? [op.text!] : [])) };
};

beforeEach(() => {
  vi.clearAllMocks();
  getClinicForDocuments.mockResolvedValue({ clinic, logoPath: null });
  renderPdf.mockResolvedValue(Buffer.from("%PDF-1.7"));
  toPng.mockResolvedValue(PNG);
});

describe("getPrescriptionPdf (plan §13, §33; D218 – D224)", () => {
  it("draws the visit's prescription on the clinic's paper, and answers it to open — named, never kept", async () => {
    const answer = await get(withRow(aRow()));
    expect(answer.headers.get("Content-Type")).toBe("application/pdf");
    expect(answer.headers.get("Content-Disposition")).toBe(
      `inline; filename="Rohan Mehta - 14 Oct 2026 - Prescription.pdf"; filename*=UTF-8''${encodeURIComponent("Rohan Mehta - 14 Oct 2026 - Prescription.pdf")}`,
    );
    expect(answer.headers.get("Cache-Control")).toBe("private, no-store");
    expect(answer.headers.get("x-request-id")).toBe("req_1");
    expect(Buffer.from(await answer.arrayBuffer()).toString()).toBe("%PDF-1.7");

    const { paper, title, author, logo, lines } = drawn();
    expect({ paper, title, author, logo }).toEqual({
      paper: "A5",
      title: "Prescription for Rohan Mehta, 14 Oct 2026",
      author: "Smile Care",
      logo: null,
    });
    // The medicines in their places, the vitals taken, the diagnosis ticked to print.
    expect(lines.indexOf("Paracetamol 500 mg")).toBeLessThan(lines.indexOf("Cetirizine 10 mg"));
    expect(lines).toEqual(
      expect.arrayContaining(["Dr. Maya Rao", "BDS, MDS", "Reg. KMC 12345", "BP 120/80 mmHg", "Viral fever"]),
    );
    expect(getClinicForDocuments).toHaveBeenCalledOnce();
  });

  it("answers it to save when asked to download it", async () => {
    const answer = await get(withRow(aRow()), true);
    expect(answer.headers.get("Content-Disposition")).toMatch(/^attachment; filename="Rohan Mehta - 14 Oct 2026/);
  });

  it("prints the diagnosis only when the doctor ticked it (D216), and no vitals when none were taken", async () => {
    await get(withRow(aRow({ vitals: null, prescription: { ...aRow().prescription, print_diagnosis: false } })));
    const { lines } = drawn();
    expect(lines).not.toContain("Viral fever");
    expect(lines.some((line) => line.startsWith("BP"))).toBe(false);
  });

  it("names no doctor whose account is gone", async () => {
    await get(withRow(aRow({ doctor: { ...aRow().doctor, member: null } })));
    expect(drawn().lines.some((line) => line.startsWith("Dr."))).toBe(false);
    await get(withRow(aRow({ doctor: { ...aRow().doctor, member: { profile: null } } })));
    expect(drawn().lines.some((line) => line.startsWith("Dr."))).toBe(false);
  });

  it("refuses a visit it cannot find or read, a prescription with no medicine, and a doctor with no registration number", async () => {
    await expect(get(withRow(null))).rejects.toMatchObject({ code: "RECORD_NOT_FOUND" });
    await expect(get(tenantWith({ answer: () => ({ error: postgrestError("42501") }) }))).rejects.toMatchObject({
      code: "AUTH_PERMISSION_DENIED",
    });
    await expect(get(withRow(aRow({ prescription: null })))).rejects.toMatchObject({ code: "PRESCRIPTION_EMPTY" });
    await expect(get(withRow(aRow({ prescription: [] })))).rejects.toMatchObject({ code: "PRESCRIPTION_EMPTY" });
    await expect(get(withRow(aRow({ prescription: { ...aRow().prescription, items: [] } })))).rejects.toMatchObject({
      code: "PRESCRIPTION_EMPTY",
    });
    await expect(get(withRow(aRow({ doctor: { ...aRow().doctor, registration_number: null } })))).rejects.toMatchObject(
      { code: "PRESCRIPTION_NEEDS_REGISTRATION", kind: "BUSINESS_RULE" },
    );
    await expect(get(withRow(aRow({ doctor: null })))).rejects.toMatchObject({
      code: "PRESCRIPTION_NEEDS_REGISTRATION",
    });
    expect(renderPdf).not.toHaveBeenCalled();
  });

  it("takes the prescription as one row or a list of one", async () => {
    await get(withRow(aRow({ prescription: [aRow().prescription], vitals: aRow().vitals[0] })));
    expect(drawn().lines).toEqual(expect.arrayContaining(["Paracetamol 500 mg", "BP 120/80 mmHg"]));
  });
});

describe("getPrescriptionPdf's letterhead logo", () => {
  const logoAt = "clinics/clinic-1/logo/l-1";

  it("draws a PNG or JPEG logo as it is stored", async () => {
    getClinicForDocuments.mockResolvedValue({ clinic, logoPath: logoAt });
    downloadLogo.mockResolvedValue({ file: new Blob([PNG]), type: "image/png" });
    await get(withRow(aRow()));
    expect(downloadLogo).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), logoAt);
    expect(drawn().logo).toEqual(PNG);
    expect(drawn().lines.length).toBeGreaterThan(0);
  });

  it("turns a WebP logo into a PNG, which a PDF can hold", async () => {
    getClinicForDocuments.mockResolvedValue({ clinic, logoPath: logoAt });
    downloadLogo.mockResolvedValue({ file: new Blob(["webp"]), type: "image/webp" });
    toPng.mockResolvedValue(Buffer.from("png"));
    await get(withRow(aRow()));
    expect(drawn().logo).toEqual(Buffer.from("png"));
  });

  it("draws the letterhead without a logo it cannot read, and logs only that — nothing of the patient", async () => {
    getClinicForDocuments.mockResolvedValue({ clinic, logoPath: logoAt });
    downloadLogo.mockRejectedValue(externalServiceError("EXTERNAL_SERVICE_ERROR"));
    await get(withRow(aRow()));
    expect(drawn().logo).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.any(String), { clinicId: "clinic-1", reason: "AppError" });
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/Rohan|Paracetamol|Viral/);

    downloadLogo.mockRejectedValue("gone");
    await get(withRow(aRow()));
    expect(warn).toHaveBeenLastCalledWith(expect.any(String), { clinicId: "clinic-1", reason: "unknown" });
  });
});

const aBill = {
  id: "b-1",
  number: "2026-27/0042",
  issuedAt: "2026-10-14T05:30:00Z",
  issuedOn: "2026-10-14",
  status: "ISSUED",
  patient: {
    id: "p-1",
    name: "Rohan Mehta",
    number: 1002,
    phone: "+919876543210",
    dateOfBirth: "1990-04-12",
    gender: "MALE",
    archived: false,
  },
  visitId: "v-1",
  appointmentId: null,
  doctor: "Maya Rao",
  lines: [
    {
      description: "Consultation",
      quantity: 1,
      unitPricePaise: 80_000,
      amountPaise: 80_000,
      serviceId: "s-1",
      treatmentId: null,
    },
  ],
  subtotalPaise: 80_000,
  discountPaise: 0,
  totalPaise: 80_000,
  notes: null,
  issuedBy: null,
  void: null,
  settlement: { paidPaise: 80_000, duePaise: 0, state: "PAID" },
  balancePaise: 0,
};

describe("getBillPdf (plan §15.5; D315, D316)", () => {
  const getIt = (download = false) => getBillPdf(tenantWith({}), "b-1", { download, requestId: "req_2" });

  it("draws the bill on the clinic's paper, with its GSTIN, and answers it to open — named, never kept", async () => {
    getBill.mockResolvedValue(aBill);
    getClinicForDocuments.mockResolvedValue({
      clinic: { ...clinic, gstin: "32ABCDE1234F1Z5", paperSize: "A4" },
      logoPath: null,
    });
    const answer = await getIt();
    expect(getBill).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), "b-1");
    expect(answer.headers.get("Content-Type")).toBe("application/pdf");
    expect(answer.headers.get("Content-Disposition")).toContain("inline");
    expect(answer.headers.get("Content-Disposition")).toContain(
      encodeURIComponent("Rohan Mehta - Bill 2026-27-0042.pdf"),
    );
    expect(answer.headers.get("Cache-Control")).toBe("private, no-store");
    const { lines, ...rest } = drawn();
    expect(rest).toMatchObject({
      paper: "A4",
      title: "Bill 2026-27/0042 for Rohan Mehta",
      author: "Smile Care",
      logo: null,
    });
    expect(lines).toContain("GSTIN 32ABCDE1234F1Z5");
    expect(lines).toContain("No. 2026-27/0042");
  });

  it("answers it to save when asked to download it, a void one with VOID across it (D315)", async () => {
    getBill.mockResolvedValue({
      ...aBill,
      status: "VOID",
      void: { reason: "Wrong patient", at: "2026-10-15T05:00:00Z", by: null },
      settlement: null,
    });
    const answer = await getIt(true);
    expect(answer.headers.get("Content-Disposition")).toContain("attachment");
    const [{ compose }] = renderPdf.mock.calls.at(-1)! as [{ compose: (measure: Measure) => { stamp?: string } }];
    expect(compose(measure).stamp).toBe("VOID");
  });

  it("draws the clinic's logo on it", async () => {
    getBill.mockResolvedValue(aBill);
    getClinicForDocuments.mockResolvedValue({ clinic, logoPath: "clinics/clinic-1/logo/a" });
    downloadLogo.mockResolvedValue({ file: new Blob([PNG]), type: "image/png" });
    await getIt();
    expect(drawn().logo).toEqual(PNG);
  });
});
