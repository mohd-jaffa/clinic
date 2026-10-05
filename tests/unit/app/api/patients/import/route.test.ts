import { beforeEach, describe, expect, it, vi } from "vitest";

import { IDEMPOTENCY_HEADER } from "@/lib/api/client";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, getImportLimits, importPatients } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getImportLimits: vi.fn(),
  importPatients: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/patients/import", () => ({ getImportLimits, importPatients }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET, POST } = await import("@/app/api/patients/import/route");

const auth = { authorization: "Bearer tok" };
const staff = () => {
  const session = aSession();
  return {
    ...session,
    membership: { ...session.membership!, role: "STAFF", permissions: ["patients.view", "patients.create"] },
  };
};
const typed = {
  key: "3f2b1c4d-0a1b-4c2d-8e3f-1a2b3c4d5e6f",
  fullName: " Rohan  Mehta ",
  phone: "98765 43210",
  born: { as: "AGE", years: "34" },
  gender: "MALE",
};

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(aSession());
  getImportLimits.mockResolvedValue({ maxRows: 10_000, batchSize: 200 });
  importPatients.mockResolvedValue({ imported: 1, added: 1 });
});

describe("GET /api/patients/import", () => {
  it("answers the import's limits to the owner, and to no one else", async () => {
    const get = async () => answerOf(await GET(apiRequest("/api/patients/import", { method: "GET", headers: auth })));
    expect(await get()).toMatchObject({ status: 200, body: { data: { maxRows: 10_000, batchSize: 200 } } });
    getSession.mockResolvedValue(staff());
    expect((await get()).status).toBe(403);
  });
});

describe("POST /api/patients/import (plan §10.5)", () => {
  const post = async (body: unknown) =>
    answerOf(await POST(apiRequest("/api/patients/import", { body, headers: auth })));

  it("imports the owner's batch, each row checked as the add sheet checks it", async () => {
    expect(await post({ rows: [typed] })).toMatchObject({ status: 200, body: { data: { imported: 1, added: 1 } } });
    expect(importPatients).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      [expect.objectContaining({ key: typed.key, fullName: "Rohan Mehta", phone: "+919876543210", gender: "MALE" })],
      expect.stringMatching(/^req_/),
    );
  });

  it("needs no Idempotency-Key header: each row carries its own", async () => {
    expect(
      (
        await answerOf(
          await POST(
            apiRequest("/api/patients/import", {
              body: { rows: [typed] },
              headers: { ...auth, [IDEMPOTENCY_HEADER]: "x" },
            }),
          ),
        )
      ).status,
    ).toBe(200);
  });

  it("refuses an empty batch, one too long, a row without its key or one the sheet would refuse", async () => {
    expect((await post({ rows: [] })).status).toBe(400);
    expect((await post({ rows: Array(201).fill(typed) })).status).toBe(400);
    expect((await post({ rows: [{ ...typed, key: undefined }] })).status).toBe(400);
    expect((await post({ rows: [{ ...typed, phone: "123" }] })).status).toBe(400);
    expect(importPatients).not.toHaveBeenCalled();
  });

  it("is the owner's alone, and refused in a view-only clinic", async () => {
    getSession.mockResolvedValue(staff());
    expect((await post({ rows: [typed] })).status).toBe(403);
    const session = aSession();
    getSession.mockResolvedValue({ ...session, subscription: { ...session.subscription!, state: "READ_ONLY" } });
    expect(await post({ rows: [typed] })).toMatchObject({
      status: 422,
      body: { error: { code: "CLINIC_PLAN_EXPIRED" } },
    });
    expect(importPatients).not.toHaveBeenCalled();
  });
});
