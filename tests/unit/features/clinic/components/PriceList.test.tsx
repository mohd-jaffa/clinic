import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aSession, authStub } from "@tests/support/auth";
import { aService } from "@tests/support/clinic";
import { Providers } from "@tests/support/providers";

const { auth, client, query } = vi.hoisted(() => ({
  auth: { current: {} as ReturnType<typeof authStub> },
  client: { add: vi.fn(), change: vi.fn() },
  query: { current: {} as Record<string, unknown> },
}));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => auth.current }));
vi.mock("@/features/clinic/api.client", () => ({ ServicesClient: client }));
vi.mock("@/features/clinic/hooks/useServices", () => ({ useServices: () => query.current }));

const { PriceList } = await import("@/features/clinic/components/PriceList");

const services = [
  aService({ id: "s-0", name: "Consultation", category: "CONSULTATION", pricePaise: 50000 }),
  aService({ id: "s-1", name: "Scaling and polishing", pricePaise: 80000 }),
  aService({ id: "s-2", name: "Dental X-ray", category: "INVESTIGATION", pricePaise: 25050 }),
  aService({ id: "s-3", name: "Root canal", pricePaise: 450000 }),
  aService({ id: "s-9", name: "Old crown", pricePaise: 300000, active: false }),
];

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = authStub();
  query.current = { data: services, isLoading: false };
  client.change.mockImplementation(async ({ id, active }: { id: string; active: boolean }) => ({
    ...services.find((service) => service.id === id)!,
    active,
  }));
});

const draw = () =>
  render(
    <Providers>
      <PriceList />
    </Providers>,
  );

describe("PriceList (plan §9, D82)", () => {
  it("names itself and how many services are offered", () => {
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Price list" })).toBeInTheDocument();
    expect(screen.getByText("4 services")).toBeInTheDocument();
  });

  it("groups the services by category, in the plan's order, each with its price", () => {
    draw();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Consultation",
      "Procedure",
      "Investigation",
    ]);
    const procedures = screen.getByRole("region", { name: "Procedure" });
    expect(
      within(procedures)
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual(["Scaling and polishing₹800", "Root canal₹4,500"]);
    expect(screen.getByRole("region", { name: "Investigation" })).toHaveTextContent("Dental X-ray₹250.50");
  });

  it("finds a service by name, whatever its case, and says when none matches", async () => {
    draw();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search services" }), "ROOT");
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Procedure"]);
    expect(screen.getByRole("region", { name: "Procedure" })).toHaveTextContent("Root canal");

    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "  zirconia ");
    expect(screen.getByText("Nothing matches “zirconia”")).toBeInTheDocument();
  });

  it("opens a service's sheet to change it, and an empty one to add one", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Root canal" }));
    const sheet = screen.getByRole("dialog", { name: "Change service" });
    expect(within(sheet).getByRole("textbox", { name: /^Service name/ })).toHaveValue("Root canal");
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: "Add service" }));
    const adding = screen.getByRole("dialog", { name: "Add a service" });
    expect(within(adding).getByRole("textbox", { name: /^Service name/ })).toHaveValue("");
  });

  it("keeps archived services at the foot, each with its category and price, to be restored (D80)", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Show archived (1)" }));
    expect(screen.getByRole("list", { name: "Archived" })).toHaveTextContent("Old crownProcedure · ₹3,000");
    await userEvent.click(screen.getByRole("button", { name: "Restore Old crown" }));
    expect(client.change).toHaveBeenCalledWith({ id: "s-9", active: true });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Old crown restored"));
  });

  it("in a view-only clinic, shows the price list and changes nothing, saying why", async () => {
    auth.current = authStub({ subscription: { ...aSession().subscription!, state: "READ_ONLY" } });
    draw();
    expect(screen.queryByRole("button", { name: "Add service" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Root canal" })).not.toBeInTheDocument();
    expect(screen.getByText("Your clinic is view-only until its plan is renewed.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show archived (1)" }));
    expect(screen.queryByRole("button", { name: "Restore Old crown" })).not.toBeInTheDocument();
  });

  it("says why when it cannot load", () => {
    query.current = { isLoading: false, error: new Error("down") };
    draw();
    expect(screen.getByText("The price list couldn't be loaded.")).toBeInTheDocument();
  });
});
