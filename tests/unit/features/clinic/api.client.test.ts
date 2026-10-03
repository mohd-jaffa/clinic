import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppointmentTypesClient,
  ClinicClient,
  ClosuresClient,
  ExpenseCategoriesClient,
  ServicesClient,
} from "@/features/clinic/api.client";
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

describe("the catalogue clients (plan §30)", () => {
  it("add a service, an appointment type and an expense category to their lists", async () => {
    await ServicesClient.add({ name: "Scaling", category: "PROCEDURE", price: "800" });
    expect(sent()).toMatchObject({
      url: apiRoutes.services.list,
      method: "POST",
      body: '{"name":"Scaling","category":"PROCEDURE","price":"800"}',
    });

    mockFetch.mockClear();
    await AppointmentTypesClient.add({ name: "Root canal", minutes: "45" });
    expect(sent()).toMatchObject({ url: apiRoutes.appointmentTypes.list, method: "POST" });

    mockFetch.mockClear();
    await ExpenseCategoriesClient.add({ name: "Lab fees" });
    expect(sent()).toMatchObject({ url: apiRoutes.expenseCategories.list, method: "POST" });
  });

  it("change one at its own address, sending the change without its id", async () => {
    await ServicesClient.change({ id: "s-1", active: false });
    expect(sent()).toMatchObject({ url: "/api/services/s-1", method: "PATCH", body: '{"active":false}' });

    mockFetch.mockClear();
    await ExpenseCategoriesClient.change({ id: "c-1", details: { name: "Lease" } });
    expect(sent()).toMatchObject({
      url: "/api/expense-categories/c-1",
      method: "PATCH",
      body: '{"details":{"name":"Lease"}}',
    });
  });
});

describe("ClosuresClient (plan §30)", () => {
  it("adds a holiday or leave as typed, and removes one at its own address", async () => {
    await ClosuresClient.add({ who: "CLINIC", startsOn: "2026-10-20", endsOn: "2026-10-22", reason: "Diwali" });
    expect(sent()).toMatchObject({
      url: apiRoutes.closures.list,
      method: "POST",
      body: '{"who":"CLINIC","startsOn":"2026-10-20","endsOn":"2026-10-22","reason":"Diwali"}',
    });

    mockFetch.mockClear();
    await ClosuresClient.remove("c-1");
    expect(sent()).toMatchObject({ url: "/api/closures/c-1", method: "DELETE" });
  });
});
