import { beforeEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, list, add } = vi.hoisted(() => ({ getSession: vi.fn(), list: vi.fn(), add: vi.fn() }));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/clinic/catalogues", () => ({ expenseCategories: { list, add } }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { GET, POST } = await import("@/app/api/expense-categories/route");

const auth = { authorization: "Bearer tok" };
const staff = (permissions: string[]) => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, role: "STAFF", permissions } };
};
const owner = () => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } };
};

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(owner());
  list.mockResolvedValue([{ id: "e-1", name: "One", active: true }]);
  add.mockResolvedValue({ id: "e-2", name: "Two", active: true });
});

describe("GET /api/expense-categories", () => {
  it("answers any member with the expense categories, read as them", async () => {
    getSession.mockResolvedValue(staff([]));
    const { status, body } = await answerOf(
      await GET(apiRequest("/api/expense-categories", { method: "GET", headers: auth })),
    );
    expect({ status, body }).toMatchObject({ status: 200, body: { data: [{ id: "e-1" }] } });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1", supabase: "anon-client" }));
  });
});

describe("POST /api/expense-categories (D81)", () => {
  it("adds one for settings.manage, the body tidied first, and answers 201", async () => {
    const { status, body } = await answerOf(
      await POST(
        apiRequest("/api/expense-categories", { method: "POST", body: { name: " Lab  fees " }, headers: auth }),
      ),
    );
    expect({ status, body }).toMatchObject({ status: 201, body: { data: { id: "e-2" } } });
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      { name: "Lab fees" },
      expect.stringMatching(/^req_/),
    );
  });

  it("refuses a member without settings.manage, and a body that is not right", async () => {
    getSession.mockResolvedValue(staff(["patients.view"]));
    const refused = await answerOf(
      await POST(
        apiRequest("/api/expense-categories", { method: "POST", body: { name: " Lab  fees " }, headers: auth }),
      ),
    );
    expect(refused).toMatchObject({ status: 403, body: { error: { code: "AUTH_PERMISSION_DENIED" } } });

    getSession.mockResolvedValue(owner());
    const invalid = await answerOf(
      await POST(apiRequest("/api/expense-categories", { method: "POST", body: { name: "" }, headers: auth })),
    );
    expect(invalid).toMatchObject({ status: 400, body: { error: { code: "VALIDATION_ERROR" } } });
    expect(add).not.toHaveBeenCalled();
  });
});
