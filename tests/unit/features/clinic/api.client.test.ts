import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClinicClient } from "@/features/clinic/api.client";
import { apiRoutes } from "@/lib/query/keys";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { name: "Smile Care" } }) });
});

const sent = () => {
  const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
  return { url, method: init.method, body: init.body, headers: new Headers(init.headers) };
};

describe("ClinicClient", () => {
  it("changes the clinic with what it is given", async () => {
    expect(await ClinicClient.update({ paperSize: "A5" })).toEqual({ name: "Smile Care" });
    expect(sent()).toMatchObject({ url: apiRoutes.clinic.profile, method: "PATCH", body: '{"paperSize":"A5"}' });
  });

  it("sends a logo as the file itself, with its own type", async () => {
    const logo = new File(["png"], "logo.png", { type: "image/png" });
    await ClinicClient.uploadLogo(logo);
    const { url, method, body, headers } = sent();
    expect({ url, method, body }).toEqual({ url: apiRoutes.clinic.logo, method: "POST", body: logo });
    expect(headers.get("Content-Type")).toBe("image/png");
  });

  it("removes the logo", async () => {
    await ClinicClient.removeLogo();
    expect(sent()).toMatchObject({ url: apiRoutes.clinic.logo, method: "DELETE" });
  });
});
