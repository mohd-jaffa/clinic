// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_LOGO_BYTES } from "@/constants/uploads";
import { notFoundError } from "@/lib/errors";
import { PERMISSIONS } from "@/constants/permissions";
import { aSession } from "@tests/support/auth";
import { answerOf, apiRequest, supabaseClients } from "@tests/support/routes";

const { getSession, readLogo, replaceLogo, removeLogo } = vi.hoisted(() => ({
  getSession: vi.fn(),
  readLogo: vi.fn(),
  replaceLogo: vi.fn(),
  removeLogo: vi.fn(),
}));
vi.mock("@/features/auth/session", async (actual) => ({ ...(await actual()), getSession }));
vi.mock("@/features/clinic/api", () => ({ readLogo, replaceLogo, removeLogo }));
vi.mock("@/lib/supabase/server", () => supabaseClients);

const { DELETE, GET, POST } = await import("@/app/api/clinic/logo/route");

const auth = { authorization: "Bearer tok" };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const upload = (body: Uint8Array<ArrayBuffer>) =>
  new Request("http://localhost/api/clinic/logo", { method: "POST", headers: auth, body });

/** The owner, as the session reads them: every permission (plan §8.2). */
const owner = () => {
  const session = aSession();
  return { ...session, membership: { ...session.membership!, permissions: [...PERMISSIONS] } };
};

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue(owner());
  replaceLogo.mockResolvedValue({ logoUrl: "/api/clinic/logo?v=1" });
  removeLogo.mockResolvedValue({ logoUrl: null });
});

describe("GET /api/clinic/logo", () => {
  it("answers a member with the image itself, never kept", async () => {
    const session = aSession();
    getSession.mockResolvedValue({
      ...session,
      membership: { ...session.membership!, role: "STAFF", permissions: [] },
    });
    readLogo.mockResolvedValue({ file: new Blob([PNG]), type: "image/png" });

    const answer = await GET(apiRequest("/api/clinic/logo", { method: "GET", headers: auth }));
    expect(answer.status).toBe(200);
    expect(answer.headers.get("Content-Type")).toBe("image/png");
    expect(answer.headers.get("Cache-Control")).toBe("no-store");
    expect(new Uint8Array(await answer.arrayBuffer())).toEqual(PNG);
  });

  it("answers in the envelope when there is no logo", async () => {
    readLogo.mockRejectedValue(notFoundError());
    const { status, body } = await answerOf(
      await GET(apiRequest("/api/clinic/logo", { method: "GET", headers: auth })),
    );
    expect({ status, body }).toMatchObject({ status: 404, body: { error: { code: "NOT_FOUND" } } });
  });
});

describe("POST /api/clinic/logo", () => {
  it("stores the file the body is, for settings.manage", async () => {
    const { status, body } = await answerOf(await POST(upload(PNG)));
    expect({ status, body }).toMatchObject({ status: 200, body: { data: { logoUrl: "/api/clinic/logo?v=1" } } });
    expect(replaceLogo).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: "clinic-1" }),
      PNG,
      expect.stringMatching(/^req_/),
    );
  });

  it("turns away a file over 500 KB before it is stored", async () => {
    const { status, body } = await answerOf(await POST(upload(new Uint8Array(MAX_LOGO_BYTES + 1))));
    expect({ status, body }).toMatchObject({ status: 400, body: { error: { code: "LOGO_TOO_LARGE" } } });
    expect(replaceLogo).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/clinic/logo (D79)", () => {
  it("removes the logo for settings.manage, and refuses anyone else", async () => {
    const { status } = await answerOf(
      await DELETE(apiRequest("/api/clinic/logo", { method: "DELETE", headers: auth })),
    );
    expect(status).toBe(200);
    expect(removeLogo).toHaveBeenCalledWith(expect.objectContaining({ clinicId: "clinic-1" }), expect.any(String));

    const session = aSession();
    getSession.mockResolvedValue({
      ...session,
      membership: { ...session.membership!, role: "STAFF", permissions: [] },
    });
    const refused = await answerOf(await DELETE(apiRequest("/api/clinic/logo", { method: "DELETE", headers: auth })));
    expect(refused.status).toBe(403);
  });
});
